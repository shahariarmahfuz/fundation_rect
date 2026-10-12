from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text, or_, func, desc, asc
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from backend.app.database import get_db
from backend.app.models import Donation, User, Group, GroupFundTransaction
from backend.app.schemas import (
    DonationCreate,
    DonationUpdate,
    DonationCancelRequest,
    DonationOut,
    DonationReportSummary,
    DonationPaymentMethodSummary,
    DonationPeriodicSummary,
)
from backend.app.security import require_permission, get_current_user

router = APIRouter(prefix="/api/donations", tags=["donations"])


@router.get("/active-groups-with-balance")
def get_active_groups_for_donation(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    user_perms = {p.code for p in current_user.role.permissions} if current_user.role else set()
    required = ["donations.create", "donations.view", "group_funds.view"]
    if not any(p in user_perms for p in required):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access Denied: Missing required permission.")

    groups = db.query(Group).filter(Group.status == "Active").order_by(Group.code.asc()).all()
    result = []
    for g in groups:
        recv = db.query(func.coalesce(func.sum(GroupFundTransaction.amount), Decimal("0.00"))).filter(
            GroupFundTransaction.group_id == g.id,
            GroupFundTransaction.transaction_type == "Received"
        ).scalar()
        spent = db.query(func.coalesce(func.sum(GroupFundTransaction.amount), Decimal("0.00"))).filter(
            GroupFundTransaction.group_id == g.id,
            GroupFundTransaction.transaction_type == "Spent"
        ).scalar()
        balance = Decimal(str(recv)) - Decimal(str(spent))
        result.append({
            "id": g.id,
            "code": g.code,
            "name": g.name,
            "status": g.status,
            "available_balance": str(balance),
            "total_received": str(recv),
            "total_spent": str(spent)
        })
    return result


def get_next_donation_id(db: Session) -> str:
    """Concurrency-safe sequential donation ID generation using Postgres sequence."""
    from backend.app.models import FoundationSetting
    setting = db.query(FoundationSetting).filter(FoundationSetting.id == 1).first()
    prefix = setting.donation_prefix if setting and setting.donation_prefix else "D-"
    res = db.execute(text("SELECT nextval('donation_id_seq')")).scalar()
    did = f"{prefix}{int(res):04d}"
    while db.query(Donation).filter(Donation.donation_id == did).first() is not None:
        res = db.execute(text("SELECT nextval('donation_id_seq')")).scalar()
        did = f"{prefix}{int(res):04d}"
    return did


def serialize_donation(d: Donation) -> DonationOut:
    return DonationOut(
        id=d.id,
        donation_id=d.donation_id,
        donation_date=d.donation_date,
        donor_name=d.donor_name,
        amount=Decimal(str(d.amount)),
        group_id=d.group_id,
        group_code=d.group.code if d.group else None,
        group_name=d.group.name if d.group else None,
        payment_method=d.payment_method,
        transaction_reference=d.transaction_reference,
        notes=d.notes,
        recorded_by_id=d.recorded_by_id,
        recorded_by_name=d.recorded_by.full_name if d.recorded_by else None,
        status=d.status,
        cancelled_at=d.cancelled_at,
        cancelled_by_id=d.cancelled_by_id,
        cancelled_by_name=d.cancelled_by.full_name if d.cancelled_by else None,
        cancel_reason=d.cancel_reason,
        created_at=d.created_at,
        updated_at=d.updated_at,
    )


@router.post("", response_model=DonationOut, status_code=status.HTTP_201_CREATED)
def create_donation(
    payload: DonationCreate,
    current_user: User = Depends(require_permission("donations.create")),
    db: Session = Depends(get_db)
):
    if payload.amount <= Decimal("0.00"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Donation amount must be greater than zero."
        )

    clean_donor = payload.donor_name.strip()
    if not clean_donor:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Donor name is required."
        )

    clean_method = payload.payment_method.strip()
    if not clean_method:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment method is required."
        )

    # Validate receiving group
    group = db.query(Group).filter(Group.id == payload.group_id).first()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Selected receiving group does not exist."
        )
    if group.status != "Active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Receiving Group {group.code} ({group.name}) is inactive. Donations can only be credited to active groups."
        )

    clean_ref = payload.transaction_reference.strip() if payload.transaction_reference else None
    if clean_ref:
        existing_ref = db.query(Donation).filter(Donation.transaction_reference == clean_ref).first()
        if existing_ref:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Transaction reference '{clean_ref}' is already in use by donation {existing_ref.donation_id}."
            )

    did = get_next_donation_id(db)

    # 1. Create donation
    donation = Donation(
        donation_id=did,
        donation_date=payload.donation_date,
        donor_name=clean_donor,
        amount=payload.amount,
        group_id=group.id,
        payment_method=clean_method,
        transaction_reference=clean_ref,
        notes=payload.notes.strip() if payload.notes else None,
        recorded_by_id=current_user.id,
        status="COMPLETED"
    )
    db.add(donation)

    # 2. Credit the selected group's fund ledger
    tx_datetime = datetime.combine(payload.donation_date, datetime.utcnow().time())
    group_tx = GroupFundTransaction(
        reference=did,
        group_id=group.id,
        transaction_date=tx_datetime,
        transaction_type="Received",
        amount=payload.amount,
        description=f"Donation {did} from {clean_donor} ({clean_method})",
        created_by=current_user.full_name
    )
    db.add(group_tx)

    db.commit()
    db.refresh(donation)
    return serialize_donation(donation)


@router.get("", response_model=dict)
def list_donations(
    q: Optional[str] = Query(None, description="Search by Donation ID, Donor Name, or Reference"),
    payment_method: Optional[str] = Query(None, description="Filter by payment method"),
    group_id: Optional[int] = Query(None, description="Filter by receiving group"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (COMPLETED, CANCELLED)"),
    start_date: Optional[date] = Query(None, description="Filter start date"),
    end_date: Optional[date] = Query(None, description="Filter end date"),
    sort_by: str = Query("donation_date", description="Sort column (donation_date, amount, created_at)"),
    order: str = Query("desc", description="Sort direction (asc, desc)"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_permission("donations.view")),
    db: Session = Depends(get_db)
):
    query = db.query(Donation)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Donation.donation_id.ilike(term),
                Donation.donor_name.ilike(term),
                Donation.transaction_reference.ilike(term)
            )
        )

    if payment_method and payment_method.strip():
        query = query.filter(Donation.payment_method == payment_method.strip())

    if group_id:
        query = query.filter(Donation.group_id == group_id)

    if status_filter and status_filter.strip():
        query = query.filter(Donation.status == status_filter.strip())

    if start_date:
        query = query.filter(Donation.donation_date >= start_date)

    if end_date:
        query = query.filter(Donation.donation_date <= end_date)

    # Calculate filtered total sum
    sum_query = query.with_entities(func.coalesce(func.sum(Donation.amount), 0))
    total_filtered_amount = sum_query.scalar() or Decimal("0.00")

    total_count = query.count()

    # Sorting
    sort_column = Donation.donation_date
    if sort_by == "amount":
        sort_column = Donation.amount
    elif sort_by == "created_at":
        sort_column = Donation.created_at
    elif sort_by == "donation_id":
        sort_column = Donation.donation_id

    if order.lower() == "asc":
        query = query.order_by(asc(sort_column), asc(Donation.id))
    else:
        query = query.order_by(desc(sort_column), desc(Donation.id))

    offset = (page - 1) * limit
    items = query.offset(offset).limit(limit).all()

    return {
        "items": [serialize_donation(item) for item in items],
        "total": total_count,
        "total_amount": Decimal(str(total_filtered_amount)),
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }


@router.get("/report/summary", response_model=DonationReportSummary)
def get_donation_report(
    start_date: Optional[date] = Query(None, description="Start date filter"),
    end_date: Optional[date] = Query(None, description="End date filter"),
    payment_method: Optional[str] = Query(None, description="Payment method filter"),
    group_id: Optional[int] = Query(None, description="Group filter"),
    group_by: str = Query("month", description="Grouping period: month or day"),
    current_user: User = Depends(require_permission("donation_reports.view")),
    db: Session = Depends(get_db)
):
    query = db.query(Donation).filter(Donation.status == "COMPLETED")

    if start_date:
        query = query.filter(Donation.donation_date >= start_date)
    if end_date:
        query = query.filter(Donation.donation_date <= end_date)
    if payment_method and payment_method.strip():
        query = query.filter(Donation.payment_method == payment_method.strip())
    if group_id:
        query = query.filter(Donation.group_id == group_id)

    # Overall totals
    totals = query.with_entities(
        func.coalesce(func.sum(Donation.amount), 0),
        func.count(Donation.id)
    ).first()

    total_amount = Decimal(str(totals[0])) if totals else Decimal("0.00")
    total_transactions = int(totals[1]) if totals else 0

    # Breakdown by payment method
    method_rows = query.with_entities(
        Donation.payment_method,
        func.coalesce(func.sum(Donation.amount), 0),
        func.count(Donation.id)
    ).group_by(Donation.payment_method).order_by(desc(func.sum(Donation.amount))).all()

    by_payment_method = [
        DonationPaymentMethodSummary(
            payment_method=row[0],
            total_amount=Decimal(str(row[1])),
            transaction_count=int(row[2])
        )
        for row in method_rows
    ]

    # Periodic summary (day or month)
    date_format = "YYYY-MM-DD" if group_by == "day" else "YYYY-MM"
    period_expr = func.to_char(Donation.donation_date, date_format)

    periodic_rows = query.with_entities(
        period_expr.label("period"),
        func.coalesce(func.sum(Donation.amount), 0),
        func.count(Donation.id)
    ).group_by(period_expr).order_by(asc(period_expr)).all()

    periodic_summary = [
        DonationPeriodicSummary(
            period=row[0],
            total_amount=Decimal(str(row[1])),
            transaction_count=int(row[2])
        )
        for row in periodic_rows
    ]

    return DonationReportSummary(
        total_amount=total_amount,
        total_transactions=total_transactions,
        start_date=start_date,
        end_date=end_date,
        by_payment_method=by_payment_method,
        periodic_summary=periodic_summary
    )


@router.get("/{donation_id}", response_model=DonationOut)
def get_donation(
    donation_id: int,
    current_user: User = Depends(require_permission("donations.view")),
    db: Session = Depends(get_db)
):
    d = db.query(Donation).filter(Donation.id == donation_id).first()
    if not d:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donation not found."
        )
    return serialize_donation(d)


@router.patch("/{donation_id}", response_model=DonationOut)
def update_donation(
    donation_id: int,
    payload: DonationUpdate,
    current_user: User = Depends(require_permission("donations.update")),
    db: Session = Depends(get_db)
):
    d = db.query(Donation).filter(Donation.id == donation_id).first()
    if not d:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donation not found."
        )

    if d.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot edit a cancelled donation."
        )

    if payload.donor_name is not None:
        clean = payload.donor_name.strip()
        if not clean:
            raise HTTPException(status_code=400, detail="Donor name cannot be empty.")
        d.donor_name = clean

    if payload.amount is not None:
        if payload.amount <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Amount must be greater than zero.")
        d.amount = payload.amount

    if payload.payment_method is not None:
        clean_m = payload.payment_method.strip()
        if not clean_m:
            raise HTTPException(status_code=400, detail="Payment method cannot be empty.")
        d.payment_method = clean_m

    if payload.donation_date is not None:
        d.donation_date = payload.donation_date

    if payload.transaction_reference is not None:
        clean_ref = payload.transaction_reference.strip() if payload.transaction_reference else None
        if clean_ref:
            existing = db.query(Donation).filter(
                Donation.transaction_reference == clean_ref,
                Donation.id != donation_id
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Transaction reference '{clean_ref}' is already in use by donation {existing.donation_id}."
                )
        d.transaction_reference = clean_ref

    if payload.notes is not None:
        d.notes = payload.notes.strip() if payload.notes else None

    db.commit()
    db.refresh(d)
    return serialize_donation(d)


@router.post("/{donation_id}/cancel", response_model=DonationOut)
def cancel_donation(
    donation_id: int,
    payload: DonationCancelRequest,
    current_user: User = Depends(require_permission("donations.cancel")),
    db: Session = Depends(get_db)
):
    d = db.query(Donation).filter(Donation.id == donation_id).first()
    if not d:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Donation not found."
        )

    if d.status == "CANCELLED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Donation is already cancelled."
        )

    reason = payload.cancel_reason.strip()
    if not reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A cancellation reason is required."
        )

    d.status = "CANCELLED"
    d.cancelled_at = func.now()
    d.cancelled_by_id = current_user.id
    d.cancel_reason = reason

    # Reverse Group Fund transaction if group was assigned
    if d.group_id:
        rev_tx = GroupFundTransaction(
            reference=f"REV-{d.donation_id}",
            group_id=d.group_id,
            transaction_date=datetime.utcnow(),
            transaction_type="Spent",
            amount=d.amount,
            description=f"Reversal of Donation {d.donation_id}: {reason}",
            created_by=current_user.full_name
        )
        db.add(rev_tx)

    db.commit()
    db.refresh(d)
    return serialize_donation(d)
