from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func, or_
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

from backend.app.database import get_db
from backend.app.models import (
    Sadaqah,
    SadaqahAllocation,
    Group,
    GroupFundTransaction,
    Beneficiary,
    BeneficiaryLedger,
    User
)
from backend.app.schemas import (
    SadaqahCreate,
    SadaqahOut,
    SadaqahBeneficiaryOut,
    SadaqahAllocationOut,
    SadaqahCancelRequest,
    SadaqahReportSummary,
    SadaqahGroupDistribution,
    SadaqahBeneficiaryDistribution,
    SadaqahPeriodicSummary,
    ActiveGroupBalanceOut
)
from backend.app.security import get_current_user, require_permission

router = APIRouter(prefix="/api/sadaqah", tags=["sadaqah"])

def get_next_sadaqah_id(db: Session) -> str:
    """Generate sequential Sadaqah ID using postgres sequence atomically."""
    from backend.app.models import FoundationSetting
    setting = db.query(FoundationSetting).filter(FoundationSetting.id == 1).first()
    prefix = setting.sadaqah_prefix if setting and setting.sadaqah_prefix else "S-"
    res = db.execute(text("SELECT nextval('sadaqah_id_seq')")).scalar()
    code = f"{prefix}{int(res):04d}"
    while db.query(Sadaqah).filter(Sadaqah.sadaqah_id == code).first() is not None:
        res = db.execute(text("SELECT nextval('sadaqah_id_seq')")).scalar()
        code = f"{prefix}{int(res):04d}"
    return code

def format_sadaqah_out(s: Sadaqah) -> SadaqahOut:
    """Helper to convert Sadaqah model to SadaqahOut schema with populated relationships."""
    allocations_out = []
    for a in s.allocations:
        allocations_out.append(SadaqahAllocationOut(
            id=a.id,
            group_id=a.group_id,
            group_code=a.group.code if a.group else f"G-{a.group_id}",
            group_name=a.group.name if a.group else "Unknown Group",
            amount=Decimal(str(a.amount)),
            created_at=a.created_at
        ))

    b_out = SadaqahBeneficiaryOut(
        id=s.beneficiary.id if s.beneficiary else s.beneficiary_id,
        beneficiary_id=s.beneficiary.beneficiary_id if s.beneficiary else f"B-{s.beneficiary_id}",
        name=s.beneficiary.name if s.beneficiary else "Unknown Beneficiary",
        phone=s.beneficiary.phone if s.beneficiary else None
    )

    return SadaqahOut(
        id=s.id,
        sadaqah_id=s.sadaqah_id,
        sadaqah_date=s.sadaqah_date,
        total_amount=Decimal(str(s.total_amount)),
        purpose=s.purpose,
        notes=s.notes,
        status=s.status,
        beneficiary=b_out,
        allocations=allocations_out,
        recorded_by_id=s.recorded_by_id,
        recorded_by_name=s.recorded_by.full_name if s.recorded_by else "System",
        cancelled_at=s.cancelled_at,
        cancelled_by_id=s.cancelled_by_id,
        cancelled_by_name=s.cancelled_by.full_name if s.cancelled_by else None,
        cancel_reason=s.cancel_reason,
        created_at=s.created_at,
        updated_at=s.updated_at
    )

@router.get("/next-id", response_model=dict)
def preview_next_sadaqah_id(
    current_user: User = Depends(require_permission("sadaqah.create")),
    db: Session = Depends(get_db)
):
    """Returns preview of the next sequential Sadaqah ID."""
    curr = db.execute(text("SELECT last_value, is_called FROM sadaqah_id_seq")).first()
    if curr and curr[1]:
        next_val = curr[0] + 1
    else:
        next_val = 1
    code = f"S-{int(next_val):04d}"
    return {"next_id": code}

@router.get("/active-groups-with-balance", response_model=List[ActiveGroupBalanceOut])
def get_active_groups_with_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns active groups with their live calculated balances from GroupFundTransaction.
    Available to users with sadaqah.create, sadaqah.view, or group_funds.view.
    """
    user_perms = {p.code for p in current_user.role.permissions} if current_user.role else set()
    if not any(p in user_perms for p in ["sadaqah.create", "sadaqah.view", "group_funds.view"]):
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
        result.append(ActiveGroupBalanceOut(
            id=g.id,
            code=g.code,
            name=g.name,
            status=g.status,
            available_balance=balance,
            total_received=Decimal(str(recv)),
            total_spent=Decimal(str(spent))
        ))
    return result

@router.post("", response_model=SadaqahOut, status_code=status.HTTP_201_CREATED)
def create_sadaqah(
    payload: SadaqahCreate,
    current_user: User = Depends(require_permission("sadaqah.create")),
    db: Session = Depends(get_db)
):
    """
    Records a Sadaqah distribution payment to a beneficiary funded across one or more groups.
    Enforces atomic transaction, row-level locks, balance checks, and ledger updates.
    """
    total_amount = Decimal(str(payload.total_amount)).quantize(Decimal("0.01"))
    if total_amount <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Total Sadaqah amount must be greater than zero.")

    if not payload.allocations:
        raise HTTPException(status_code=400, detail="At least one funding group must be selected.")

    # Check for duplicate groups
    group_ids = [a.group_id for a in payload.allocations]
    if len(group_ids) != len(set(group_ids)):
        raise HTTPException(status_code=400, detail="Duplicate group allocation found. Each group can only be selected once per transaction.")

    # Validate allocation amounts and total sum
    allocated_sum = Decimal("0.00")
    for a in payload.allocations:
        amt = Decimal(str(a.amount)).quantize(Decimal("0.01"))
        if amt <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail=f"Group allocation amount must be greater than zero.")
        allocated_sum += amt

    if allocated_sum != total_amount:
        raise HTTPException(
            status_code=400,
            detail=f"The sum of group allocations (৳{allocated_sum:,.2f}) must exactly equal the total Sadaqah amount (৳{total_amount:,.2f})."
        )

    # Validate Beneficiary
    beneficiary = db.query(Beneficiary).filter(Beneficiary.id == payload.beneficiary_id).first()
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Selected beneficiary not found.")
    if beneficiary.status != "Active":
        raise HTTPException(status_code=400, detail=f"Cannot distribute Sadaqah to inactive beneficiary {beneficiary.beneficiary_id}.")

    # Atomic execution with pessimistic row-level locking on Groups ordered by id to prevent deadlocks
    try:
        locked_groups = db.query(Group).filter(
            Group.id.in_(group_ids)
        ).order_by(Group.id.asc()).with_for_update().all()

        if len(locked_groups) != len(group_ids):
            raise HTTPException(status_code=400, detail="One or more selected funding groups do not exist.")

        group_map = {g.id: g for g in locked_groups}

        # Check each group status and live available balance inside lock
        for a in payload.allocations:
            g = group_map[a.group_id]
            if g.status != "Active":
                raise HTTPException(status_code=400, detail=f"Funding Group {g.code} ({g.name}) is inactive.")

            # Compute latest balance from transactions
            recv = db.query(func.coalesce(func.sum(GroupFundTransaction.amount), Decimal("0.00"))).filter(
                GroupFundTransaction.group_id == g.id,
                GroupFundTransaction.transaction_type == "Received"
            ).scalar()
            spent = db.query(func.coalesce(func.sum(GroupFundTransaction.amount), Decimal("0.00"))).filter(
                GroupFundTransaction.group_id == g.id,
                GroupFundTransaction.transaction_type == "Spent"
            ).scalar()
            available = Decimal(str(recv)) - Decimal(str(spent))

            alloc_amt = Decimal(str(a.amount)).quantize(Decimal("0.01"))
            if alloc_amt > available:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient balance in Group {g.code} ({g.name}). Available: ৳{available:,.2f}, Allocated: ৳{alloc_amt:,.2f}."
                )

        # Generate unique sequential Sadaqah ID
        sadaqah_id = get_next_sadaqah_id(db)

        # 1. Create Sadaqah record
        sadaqah = Sadaqah(
            sadaqah_id=sadaqah_id,
            beneficiary_id=beneficiary.id,
            sadaqah_date=payload.sadaqah_date,
            total_amount=total_amount,
            purpose=payload.purpose.strip() if payload.purpose else None,
            notes=payload.notes.strip() if payload.notes else None,
            recorded_by_id=current_user.id,
            status="COMPLETED"
        )
        db.add(sadaqah)
        db.flush()

        tx_datetime = datetime.combine(payload.sadaqah_date, datetime.utcnow().time())

        # 2. Create Sadaqah allocations and Group Fund ledger deductions
        for a in payload.allocations:
            alloc_amt = Decimal(str(a.amount)).quantize(Decimal("0.01"))
            alloc_row = SadaqahAllocation(
                sadaqah_id=sadaqah.id,
                group_id=a.group_id,
                amount=alloc_amt
            )
            db.add(alloc_row)

            # Record Group Fund deduction
            desc = f"Sadaqah distribution {sadaqah_id} to beneficiary {beneficiary.beneficiary_id} ({beneficiary.name})"
            if payload.purpose:
                desc += f" - {payload.purpose.strip()}"

            group_tx = GroupFundTransaction(
                reference=sadaqah_id,
                group_id=a.group_id,
                transaction_date=tx_datetime,
                transaction_type="Spent",
                amount=alloc_amt,
                description=desc,
                created_by=current_user.full_name
            )
            db.add(group_tx)

        # 3. Create Beneficiary Ledger entry
        b_desc = f"Sadaqah assistance {sadaqah_id}"
        if payload.purpose:
            b_desc += f" - {payload.purpose.strip()}"

        b_entry = BeneficiaryLedger(
            reference=sadaqah_id,
            beneficiary_id=beneficiary.id,
            transaction_date=tx_datetime,
            transaction_type="Disbursed",
            amount=total_amount,
            description=b_desc,
            created_by=current_user.full_name
        )
        db.add(b_entry)

        db.commit()
        db.refresh(sadaqah)
        return format_sadaqah_out(sadaqah)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record Sadaqah transaction: {str(exc)}")

@router.get("", response_model=dict)
def list_sadaqahs(
    q: Optional[str] = Query(None, description="Search by Sadaqah ID, Beneficiary name or Beneficiary ID"),
    start_date: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    group_id: Optional[int] = Query(None, description="Filter by funding group ID"),
    beneficiary_id: Optional[int] = Query(None, description="Filter by beneficiary ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (COMPLETED, CANCELLED)"),
    sort_by: str = Query("date", description="Sort by: date, amount, id"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_permission("sadaqah.view")),
    db: Session = Depends(get_db)
):
    """Lists Sadaqah transactions with rich filtering, search, and pagination."""
    query = db.query(Sadaqah).join(Beneficiary, Sadaqah.beneficiary_id == Beneficiary.id)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Sadaqah.sadaqah_id.ilike(term),
                Beneficiary.name.ilike(term),
                Beneficiary.beneficiary_id.ilike(term)
            )
        )

    if start_date:
        try:
            s_d = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(Sadaqah.sadaqah_date >= s_d)
        except ValueError:
            pass

    if end_date:
        try:
            e_d = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(Sadaqah.sadaqah_date <= e_d)
        except ValueError:
            pass

    if group_id:
        query = query.join(SadaqahAllocation, Sadaqah.id == SadaqahAllocation.sadaqah_id).filter(
            SadaqahAllocation.group_id == group_id
        ).distinct()

    if beneficiary_id:
        query = query.filter(Sadaqah.beneficiary_id == beneficiary_id)

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(Sadaqah.status == status_filter.upper())

    total_count = query.count()

    # Calculate total sum of completed amounts
    completed_sum_query = query.filter(Sadaqah.status == "COMPLETED")
    total_completed_sum = db.query(func.coalesce(func.sum(Sadaqah.total_amount), Decimal("0.00"))).filter(
        Sadaqah.id.in_(completed_sum_query.with_entities(Sadaqah.id))
    ).scalar()

    # Sorting
    if sort_by == "amount":
        order_col = Sadaqah.total_amount.asc() if sort_order == "asc" else Sadaqah.total_amount.desc()
    elif sort_by == "id":
        order_col = Sadaqah.id.asc() if sort_order == "asc" else Sadaqah.id.desc()
    else:
        order_col = Sadaqah.sadaqah_date.asc() if sort_order == "asc" else Sadaqah.sadaqah_date.desc()

    offset = (page - 1) * limit
    items = query.order_by(order_col, Sadaqah.id.desc()).offset(offset).limit(limit).all()

    return {
        "items": [format_sadaqah_out(s) for s in items],
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1,
        "total_amount_sum": Decimal(str(total_completed_sum))
    }

@router.get("/{id}", response_model=SadaqahOut)
def get_sadaqah_detail(
    id: int,
    current_user: User = Depends(require_permission("sadaqah.view")),
    db: Session = Depends(get_db)
):
    """Retrieves full details of a specific Sadaqah transaction."""
    sadaqah = db.query(Sadaqah).filter(Sadaqah.id == id).first()
    if not sadaqah:
        raise HTTPException(status_code=404, detail="Sadaqah transaction not found.")
    return format_sadaqah_out(sadaqah)

@router.post("/{id}/cancel", response_model=SadaqahOut)
def cancel_sadaqah(
    id: int,
    payload: SadaqahCancelRequest,
    current_user: User = Depends(require_permission("sadaqah.cancel")),
    db: Session = Depends(get_db)
):
    """
    Safely cancels a posted Sadaqah distribution.
    Restores the exact allocated amounts to participating groups in GroupFundTransaction.
    Creates a reversal entry in BeneficiaryLedger.
    Guarantees that repeated cancellations are rejected and reversals occur exactly once.
    """
    if not payload.cancel_reason or not payload.cancel_reason.strip():
        raise HTTPException(status_code=400, detail="A cancellation reason must be provided.")

    try:
        # Lock Sadaqah row
        sadaqah = db.query(Sadaqah).filter(Sadaqah.id == id).with_for_update().first()
        if not sadaqah:
            raise HTTPException(status_code=404, detail="Sadaqah transaction not found.")

        if sadaqah.status == "CANCELLED":
            raise HTTPException(status_code=400, detail="Sadaqah transaction has already been cancelled.")

        # Lock participating groups
        alloc_group_ids = [a.group_id for a in sadaqah.allocations]
        db.query(Group).filter(
            Group.id.in_(alloc_group_ids)
        ).order_by(Group.id.asc()).with_for_update().all()

        now = datetime.utcnow()
        reason = payload.cancel_reason.strip()

        # 1. Restore funds to each participating group
        for a in sadaqah.allocations:
            rev_tx = GroupFundTransaction(
                reference=f"REV-{sadaqah.sadaqah_id}",
                group_id=a.group_id,
                transaction_date=now,
                transaction_type="Received",
                amount=a.amount,
                description=f"Reversal of Sadaqah {sadaqah.sadaqah_id}: {reason}",
                created_by=current_user.full_name
            )
            db.add(rev_tx)

        # 2. Reverse beneficiary ledger disbursement
        rev_b_entry = BeneficiaryLedger(
            reference=f"REV-{sadaqah.sadaqah_id}",
            beneficiary_id=sadaqah.beneficiary_id,
            transaction_date=now,
            transaction_type="Received",
            amount=sadaqah.total_amount,
            description=f"Reversal of Sadaqah {sadaqah.sadaqah_id}: {reason}",
            created_by=current_user.full_name
        )
        db.add(rev_b_entry)

        # 3. Mark Sadaqah as cancelled
        sadaqah.status = "CANCELLED"
        sadaqah.cancelled_at = now
        sadaqah.cancelled_by_id = current_user.id
        sadaqah.cancel_reason = reason

        db.commit()
        db.refresh(sadaqah)
        return format_sadaqah_out(sadaqah)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel Sadaqah transaction: {str(exc)}")

@router.get("/report/summary", response_model=SadaqahReportSummary)
def get_sadaqah_report_summary(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
    beneficiary_id: Optional[int] = Query(None, description="Filter by beneficiary ID"),
    current_user: User = Depends(require_permission("sadaqah_reports.view")),
    db: Session = Depends(get_db)
):
    """
    Computes real SQL aggregates for Sadaqah distributions:
    - Total amount distributed (excluding cancelled)
    - Total completed transactions count
    - Average disbursement ticket
    - Cancelled count and amount
    - Distribution breakdown by group
    - Distribution breakdown by beneficiary
    - Periodic summary (monthly)
    """
    base_query = db.query(Sadaqah)
    parsed_start = None
    parsed_end = None

    if start_date:
        try:
            parsed_start = datetime.strptime(start_date, "%Y-%m-%d").date()
            base_query = base_query.filter(Sadaqah.sadaqah_date >= parsed_start)
        except ValueError:
            pass

    if end_date:
        try:
            parsed_end = datetime.strptime(end_date, "%Y-%m-%d").date()
            base_query = base_query.filter(Sadaqah.sadaqah_date <= parsed_end)
        except ValueError:
            pass

    if group_id:
        base_query = base_query.join(SadaqahAllocation, Sadaqah.id == SadaqahAllocation.sadaqah_id).filter(
            SadaqahAllocation.group_id == group_id
        ).distinct()

    if beneficiary_id:
        base_query = base_query.filter(Sadaqah.beneficiary_id == beneficiary_id)

    # Completed metrics
    completed_query = base_query.filter(Sadaqah.status == "COMPLETED")
    total_distributed = db.query(func.coalesce(func.sum(Sadaqah.total_amount), Decimal("0.00"))).filter(
        Sadaqah.id.in_(completed_query.with_entities(Sadaqah.id))
    ).scalar() or Decimal("0.00")

    completed_count = completed_query.count()
    avg_ticket = (total_distributed / completed_count) if completed_count > 0 else Decimal("0.00")

    # Cancelled metrics
    cancelled_query = base_query.filter(Sadaqah.status == "CANCELLED")
    cancelled_amount = db.query(func.coalesce(func.sum(Sadaqah.total_amount), Decimal("0.00"))).filter(
        Sadaqah.id.in_(cancelled_query.with_entities(Sadaqah.id))
    ).scalar() or Decimal("0.00")
    cancelled_count = cancelled_query.count()

    # Distribution by Group (from completed Sadaqah allocations)
    group_alloc_query = db.query(
        Group.id,
        Group.code,
        Group.name,
        func.sum(SadaqahAllocation.amount).label("total_allocated"),
        func.count(Sadaqah.id).label("tx_count")
    ).join(
        SadaqahAllocation, Group.id == SadaqahAllocation.group_id
    ).join(
        Sadaqah, SadaqahAllocation.sadaqah_id == Sadaqah.id
    ).filter(
        Sadaqah.status == "COMPLETED"
    )

    if parsed_start:
        group_alloc_query = group_alloc_query.filter(Sadaqah.sadaqah_date >= parsed_start)
    if parsed_end:
        group_alloc_query = group_alloc_query.filter(Sadaqah.sadaqah_date <= parsed_end)
    if group_id:
        group_alloc_query = group_alloc_query.filter(Group.id == group_id)
    if beneficiary_id:
        group_alloc_query = group_alloc_query.filter(Sadaqah.beneficiary_id == beneficiary_id)

    group_alloc_rows = group_alloc_query.group_by(Group.id, Group.code, Group.name).order_by(
        func.sum(SadaqahAllocation.amount).desc()
    ).all()

    by_group = []
    for gid, gcode, gname, gtot, gcnt in group_alloc_rows:
        tot_dec = Decimal(str(gtot))
        pct = float((tot_dec / total_distributed * 100)) if total_distributed > 0 else 0.0
        by_group.append(SadaqahGroupDistribution(
            group_id=gid,
            group_code=gcode,
            group_name=gname,
            total_amount=tot_dec,
            percentage=round(pct, 2),
            transaction_count=gcnt
        ))

    # Distribution by Beneficiary
    b_query = db.query(
        Beneficiary.id,
        Beneficiary.beneficiary_id,
        Beneficiary.name,
        func.sum(Sadaqah.total_amount).label("total_received"),
        func.count(Sadaqah.id).label("tx_count")
    ).join(
        Beneficiary, Sadaqah.beneficiary_id == Beneficiary.id
    ).filter(
        Sadaqah.status == "COMPLETED"
    )

    if parsed_start:
        b_query = b_query.filter(Sadaqah.sadaqah_date >= parsed_start)
    if parsed_end:
        b_query = b_query.filter(Sadaqah.sadaqah_date <= parsed_end)
    if group_id:
        b_query = b_query.join(SadaqahAllocation, Sadaqah.id == SadaqahAllocation.sadaqah_id).filter(
            SadaqahAllocation.group_id == group_id
        )
    if beneficiary_id:
        b_query = b_query.filter(Beneficiary.id == beneficiary_id)

    b_rows = b_query.group_by(Beneficiary.id, Beneficiary.beneficiary_id, Beneficiary.name).order_by(
        func.sum(Sadaqah.total_amount).desc()
    ).all()

    by_beneficiary = []
    for bid, bcode, bname, btot, bcnt in b_rows:
        by_beneficiary.append(SadaqahBeneficiaryDistribution(
            beneficiary_id=bid,
            beneficiary_code=bcode,
            beneficiary_name=bname,
            total_amount=Decimal(str(btot)),
            transaction_count=bcnt
        ))

    # Periodic summary (grouped by YYYY-MM)
    period_expr = func.to_char(Sadaqah.sadaqah_date, 'YYYY-MM')
    period_query = db.query(
        period_expr.label("period"),
        func.sum(Sadaqah.total_amount).label("period_total"),
        func.count(Sadaqah.id).label("period_count")
    ).filter(
        Sadaqah.status == "COMPLETED"
    )

    if parsed_start:
        period_query = period_query.filter(Sadaqah.sadaqah_date >= parsed_start)
    if parsed_end:
        period_query = period_query.filter(Sadaqah.sadaqah_date <= parsed_end)
    if group_id:
        period_query = period_query.join(SadaqahAllocation, Sadaqah.id == SadaqahAllocation.sadaqah_id).filter(
            SadaqahAllocation.group_id == group_id
        )
    if beneficiary_id:
        period_query = period_query.filter(Sadaqah.beneficiary_id == beneficiary_id)

    period_rows = period_query.group_by(period_expr).order_by(period_expr.desc()).all()

    periodic_summary = []
    for p_name, p_tot, p_cnt in period_rows:
        periodic_summary.append(SadaqahPeriodicSummary(
            period=p_name,
            total_amount=Decimal(str(p_tot)),
            transaction_count=p_cnt
        ))

    return SadaqahReportSummary(
        total_amount_distributed=Decimal(str(total_distributed)),
        total_transactions=completed_count,
        average_amount=Decimal(str(avg_ticket)).quantize(Decimal("0.01")),
        cancelled_count=cancelled_count,
        cancelled_amount=Decimal(str(cancelled_amount)),
        start_date=parsed_start,
        end_date=parsed_end,
        by_group=by_group,
        by_beneficiary=by_beneficiary,
        periodic_summary=periodic_summary
    )
