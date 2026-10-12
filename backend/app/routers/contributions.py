from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func, or_, and_, desc, asc
from typing import List, Optional
from datetime import datetime, date
from decimal import Decimal
import calendar

from backend.app.database import get_db
from backend.app.models import (
    User, Group, Member, GroupFundTransaction,
    ContributionSetting, MemberContributionReceipt, ContributionMonthAllocation
)
from backend.app.schemas import (
    ContributionSettingOut, ContributionSettingUpdate,
    SingleMemberContributionCreate, BatchMemberContributionCreate,
    ContributionCancelRequest, MemberContributionOut,
    ContributionMonthAllocationOut, DueMemberOut,
    ContributionReportSummary, ContributionGroupSummary,
    ContributionMonthSummary
)
from backend.app.security import require_permission, get_current_user

router = APIRouter(prefix="/api/contributions", tags=["contributions"])

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
]


def get_next_contribution_receipt_id(db: Session) -> str:
    """Generates next sequential receipt ID using postgres sequence."""
    from backend.app.models import FoundationSetting
    setting = db.query(FoundationSetting).filter(FoundationSetting.id == 1).first()
    prefix = setting.contribution_prefix if setting and setting.contribution_prefix else "MC-"
    val = db.execute(text("SELECT nextval('contribution_receipt_seq')")).scalar()
    return f"{prefix}{int(val):04d}"


def get_current_setting(db: Session) -> ContributionSetting:
    setting = db.query(ContributionSetting).filter(ContributionSetting.id == 1).first()
    if not setting:
        setting = ContributionSetting(
            id=1,
            monthly_amount=Decimal("100.00"),
            currency="BDT",
            effective_from=date.today()
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting


def format_contribution_out(c: MemberContributionReceipt) -> MemberContributionOut:
    allocs = [
        ContributionMonthAllocationOut(
            id=a.id,
            month=a.month,
            year=a.year,
            amount=Decimal(str(a.amount)),
            status=a.status,
            month_name=MONTH_NAMES[a.month] if 1 <= a.month <= 12 else f"Month {a.month}"
        )
        for a in c.month_allocations
    ]
    paid_months = [a.month for a in c.month_allocations if a.status == "Paid"]

    return MemberContributionOut(
        id=c.id,
        receipt_id=c.receipt_id,
        member_id=c.member_id,
        member_code=c.member.member_id if c.member else f"M-{c.member_id}",
        member_name=c.member.name if c.member else "Unknown",
        group_id=c.group_id,
        group_code=c.group.code if c.group else f"G-{c.group_id}",
        group_name=c.group.name if c.group else f"Group #{c.group_id}",
        contribution_year=c.contribution_year,
        paid_months=paid_months,
        total_amount=Decimal(str(c.total_amount)),
        payment_date=c.payment_date,
        payment_method=c.payment_method,
        transaction_reference=c.transaction_reference,
        batch_reference=c.batch_reference,
        notes=c.notes,
        status=c.status,
        recorded_by_id=c.recorded_by_id,
        recorded_by_name=c.recorded_by.full_name if c.recorded_by else None,
        cancelled_at=c.cancelled_at,
        cancelled_by_id=c.cancelled_by_id,
        cancelled_by_name=c.cancelled_by.full_name if c.cancelled_by else None,
        cancel_reason=c.cancel_reason,
        month_allocations=allocs,
        created_at=c.created_at,
        updated_at=c.updated_at
    )


# ==========================================
# Global Settings Endpoints
# ==========================================

@router.get("/settings", response_model=ContributionSettingOut)
def get_contribution_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves current global monthly contribution setting."""
    setting = get_current_setting(db)
    return ContributionSettingOut(
        id=setting.id,
        monthly_amount=Decimal(str(setting.monthly_amount)),
        currency=setting.currency,
        effective_from=setting.effective_from,
        updated_by_id=setting.updated_by_id,
        updated_by_name=setting.updated_by.full_name if setting.updated_by else None,
        created_at=setting.created_at,
        updated_at=setting.updated_at
    )


@router.patch("/settings", response_model=ContributionSettingOut)
@router.put("/settings", response_model=ContributionSettingOut)
def update_contribution_settings(
    payload: ContributionSettingUpdate,
    current_user: User = Depends(require_permission("contribution_settings.update")),
    db: Session = Depends(get_db)
):
    """Updates global monthly contribution amount. Preserves historical contributions."""
    amt = Decimal(str(payload.monthly_amount)).quantize(Decimal("0.01"))
    if amt <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Monthly contribution amount must be greater than zero.")

    setting = get_current_setting(db)
    setting.monthly_amount = amt
    if payload.currency:
        setting.currency = payload.currency.strip()
    if payload.effective_from:
        setting.effective_from = payload.effective_from
    setting.updated_by_id = current_user.id

    db.commit()
    db.refresh(setting)
    return ContributionSettingOut(
        id=setting.id,
        monthly_amount=Decimal(str(setting.monthly_amount)),
        currency=setting.currency,
        effective_from=setting.effective_from,
        updated_by_id=setting.updated_by_id,
        updated_by_name=current_user.full_name,
        created_at=setting.created_at,
        updated_at=setting.updated_at
    )


# ==========================================
# Helpers & Previews
# ==========================================

@router.get("/next-receipt-id", response_model=dict)
def preview_next_receipt_id(
    current_user: User = Depends(require_permission("contributions.create")),
    db: Session = Depends(get_db)
):
    """Returns preview of the next sequential contribution receipt ID."""
    curr = db.execute(text("SELECT last_value, is_called FROM contribution_receipt_seq")).first()
    if curr and curr[1]:
        next_val = curr[0] + 1
    else:
        next_val = 1
    return {"next_id": f"MC-{int(next_val):04d}"}


@router.get("/member-paid-months/{member_id}/{year}", response_model=dict)
def get_member_paid_months(
    member_id: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Returns paid months for a member in a specific year and the current monthly amount."""
    setting = get_current_setting(db)
    paid_allocs = db.query(ContributionMonthAllocation.month).filter(
        ContributionMonthAllocation.member_id == member_id,
        ContributionMonthAllocation.year == year,
        ContributionMonthAllocation.status == "Paid"
    ).all()
    paid_months = sorted([row[0] for row in paid_allocs])
    return {
        "member_id": member_id,
        "year": year,
        "paid_months": paid_months,
        "monthly_amount": Decimal(str(setting.monthly_amount))
    }


# ==========================================
# Post Contributions
# ==========================================

@router.post("", response_model=MemberContributionOut, status_code=status.HTTP_201_CREATED)
@router.post("/single", response_model=MemberContributionOut, status_code=status.HTTP_201_CREATED)
def record_single_member_contribution(
    payload: SingleMemberContributionCreate,
    current_user: User = Depends(require_permission("contributions.create")),
    db: Session = Depends(get_db)
):
    """
    Records monthly contribution for a single member across one or multiple months.
    Validates months, prevents duplicate payments for already-paid months,
    credits the member's actual Group Fund in GroupFundTransaction atomically.
    """
    if not payload.months:
        raise HTTPException(status_code=400, detail="At least one contribution month must be selected.")

    # Validate month numbers
    for m in payload.months:
        if m < 1 or m > 12:
            raise HTTPException(status_code=400, detail=f"Invalid month number: {m}. Must be 1 to 12.")

    if len(payload.months) != len(set(payload.months)):
        raise HTTPException(status_code=400, detail="Duplicate months specified in contribution request.")

    # Validate Member
    member = db.query(Member).filter(Member.id == payload.member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Selected member not found.")
    if member.status != "Active":
        raise HTTPException(status_code=400, detail=f"Cannot collect contributions for inactive member {member.member_id}.")
    if not member.group_id or not member.group:
        raise HTTPException(status_code=400, detail=f"Member {member.member_id} does not belong to an active group.")

    group = member.group
    if group.status != "Active":
        raise HTTPException(status_code=400, detail=f"Member's group {group.code} ({group.name}) is inactive.")

    # Check already paid months
    already_paid = db.query(ContributionMonthAllocation.month).filter(
        ContributionMonthAllocation.member_id == member.id,
        ContributionMonthAllocation.year == payload.contribution_year,
        ContributionMonthAllocation.month.in_(payload.months),
        ContributionMonthAllocation.status == "Paid"
    ).all()

    if already_paid:
        paid_names = [MONTH_NAMES[row[0]] for row in already_paid]
        raise HTTPException(
            status_code=400,
            detail=f"Member {member.member_id} has already paid for: {', '.join(paid_names)} {payload.contribution_year}. Duplicate payment rejected."
        )

    # Validate amount
    setting = get_current_setting(db)
    configured_rate = Decimal(str(setting.monthly_amount))
    expected_total = configured_rate * len(payload.months)

    client_total = Decimal(str(payload.total_amount)).quantize(Decimal("0.01"))
    if client_total != expected_total:
        raise HTTPException(
            status_code=400,
            detail=f"Total amount (৳{client_total:,.2f}) does not match expected amount for {len(payload.months)} month(s) at ৳{configured_rate:,.2f}/month (expected: ৳{expected_total:,.2f})."
        )

    try:
        # Lock member row
        db.query(Member).filter(Member.id == member.id).with_for_update().first()

        # Generate unique receipt ID
        receipt_id = get_next_contribution_receipt_id(db)

        # 1. Create MemberContributionReceipt
        contribution = MemberContributionReceipt(
            receipt_id=receipt_id,
            member_id=member.id,
            group_id=group.id,
            contribution_year=payload.contribution_year,
            total_amount=expected_total,
            payment_date=payload.payment_date,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference.strip() if payload.transaction_reference else None,
            notes=payload.notes.strip() if payload.notes else None,
            recorded_by_id=current_user.id,
            status="COMPLETED"
        )
        db.add(contribution)
        db.flush()

        # 2. Create ContributionMonthAllocation for each month
        for m in sorted(payload.months):
            alloc = ContributionMonthAllocation(
                contribution_id=contribution.id,
                member_id=member.id,
                year=payload.contribution_year,
                month=m,
                amount=configured_rate,
                status="Paid"
            )
            db.add(alloc)

        # 3. Credit Member's actual Group Fund
        months_label = ", ".join([MONTH_NAMES[m] for m in sorted(payload.months)])
        g_desc = f"Monthly contribution {receipt_id} for member {member.member_id} ({member.name}) - {months_label} {payload.contribution_year}"
        if payload.transaction_reference:
            g_desc += f" [Ref: {payload.transaction_reference.strip()}]"

        tx_datetime = datetime.combine(payload.payment_date, datetime.utcnow().time())
        group_tx = GroupFundTransaction(
            reference=receipt_id,
            group_id=group.id,
            transaction_date=tx_datetime,
            transaction_type="Received",
            amount=expected_total,
            description=g_desc,
            created_by=current_user.full_name
        )
        db.add(group_tx)

        db.commit()
        db.refresh(contribution)
        return format_contribution_out(contribution)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record contribution: {str(exc)}")


@router.post("/batch", response_model=dict, status_code=status.HTTP_201_CREATED)
def record_batch_member_contributions(
    payload: BatchMemberContributionCreate,
    current_user: User = Depends(require_permission("contributions.create")),
    db: Session = Depends(get_db)
):
    """
    Records batch contributions for multiple members in a single session.
    Creates separate member contribution receipts, credits each member's own Group Fund,
    and links all records under a unique batch reference.
    """
    if not payload.items:
        raise HTTPException(status_code=400, detail="No members provided in batch collection.")

    setting = get_current_setting(db)
    configured_rate = Decimal(str(setting.monthly_amount))

    # Generate unique batch reference
    now_ts = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    batch_ref = f"BATCH-{now_ts}"

    created_receipts = []
    total_batch_amount = Decimal("0.00")

    try:
        for item in payload.items:
            if not item.months:
                continue

            for m in item.months:
                if m < 1 or m > 12:
                    raise HTTPException(status_code=400, detail=f"Invalid month {m} for member ID {item.member_id}.")

            member = db.query(Member).filter(Member.id == item.member_id).first()
            if not member:
                raise HTTPException(status_code=404, detail=f"Member ID {item.member_id} not found.")
            if member.status != "Active":
                raise HTTPException(status_code=400, detail=f"Member {member.member_id} is inactive.")
            if not member.group_id or not member.group:
                raise HTTPException(status_code=400, detail=f"Member {member.member_id} has no assigned group.")

            group = member.group
            if group.status != "Active":
                raise HTTPException(status_code=400, detail=f"Member's group {group.code} is inactive.")

            # Check duplicate months
            already_paid = db.query(ContributionMonthAllocation.month).filter(
                ContributionMonthAllocation.member_id == member.id,
                ContributionMonthAllocation.year == payload.contribution_year,
                ContributionMonthAllocation.month.in_(item.months),
                ContributionMonthAllocation.status == "Paid"
            ).all()

            if already_paid:
                paid_names = [MONTH_NAMES[row[0]] for row in already_paid]
                raise HTTPException(
                    status_code=400,
                    detail=f"Member {member.member_id} has already paid for: {', '.join(paid_names)} {payload.contribution_year}."
                )

            item_total = configured_rate * len(item.months)
            total_batch_amount += item_total

            receipt_id = get_next_contribution_receipt_id(db)

            # 1. Receipt
            contrib = MemberContributionReceipt(
                receipt_id=receipt_id,
                member_id=member.id,
                group_id=group.id,
                contribution_year=payload.contribution_year,
                total_amount=item_total,
                payment_date=payload.payment_date,
                payment_method=payload.payment_method,
                batch_reference=batch_ref,
                notes=payload.notes.strip() if payload.notes else None,
                recorded_by_id=current_user.id,
                status="COMPLETED"
            )
            db.add(contrib)
            db.flush()

            # 2. Month Allocations
            for m in sorted(item.months):
                alloc = ContributionMonthAllocation(
                    contribution_id=contrib.id,
                    member_id=member.id,
                    year=payload.contribution_year,
                    month=m,
                    amount=configured_rate,
                    status="Paid"
                )
                db.add(alloc)

            # 3. Credit Member's own Group Fund
            months_label = ", ".join([MONTH_NAMES[m] for m in sorted(item.months)])
            tx_datetime = datetime.combine(payload.payment_date, datetime.utcnow().time())
            group_tx = GroupFundTransaction(
                reference=receipt_id,
                group_id=group.id,
                transaction_date=tx_datetime,
                transaction_type="Received",
                amount=item_total,
                description=f"Batch contribution {receipt_id} ({batch_ref}) for {member.member_id} - {months_label} {payload.contribution_year}",
                created_by=current_user.full_name
            )
            db.add(group_tx)

            created_receipts.append(contrib)

        db.commit()
        for r in created_receipts:
            db.refresh(r)

        return {
            "batch_reference": batch_ref,
            "total_collected": total_batch_amount,
            "members_count": len(created_receipts),
            "receipts": [format_contribution_out(r) for r in created_receipts]
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record batch contribution: {str(exc)}")


# ==========================================
# List & Detail Endpoints
# ==========================================

@router.get("", response_model=dict)
def list_contributions(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: Optional[str] = None,
    group_id: Optional[int] = None,
    member_id: Optional[int] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    payment_method: Optional[str] = None,
    status_filter: Optional[str] = Query("ALL", alias="status"),
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_permission("contributions.view")),
    db: Session = Depends(get_db)
):
    """Lists contributions with server-side pagination, search, and filtering."""
    query = db.query(MemberContributionReceipt).join(Member, MemberContributionReceipt.member_id == Member.id)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                MemberContributionReceipt.receipt_id.ilike(term),
                Member.name.ilike(term),
                Member.member_id.ilike(term),
                MemberContributionReceipt.transaction_reference.ilike(term),
                MemberContributionReceipt.batch_reference.ilike(term)
            )
        )

    if group_id:
        query = query.filter(MemberContributionReceipt.group_id == group_id)

    if member_id:
        query = query.filter(MemberContributionReceipt.member_id == member_id)

    if year:
        query = query.filter(MemberContributionReceipt.contribution_year == year)

    if month:
        query = query.join(
            ContributionMonthAllocation,
            MemberContributionReceipt.id == ContributionMonthAllocation.contribution_id
        ).filter(ContributionMonthAllocation.month == month).distinct()

    if payment_method and payment_method.strip():
        query = query.filter(MemberContributionReceipt.payment_method == payment_method.strip())

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(MemberContributionReceipt.status == status_filter.upper())

    if start_date:
        try:
            s_d = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(MemberContributionReceipt.payment_date >= s_d)
        except ValueError:
            pass

    if end_date:
        try:
            e_d = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(MemberContributionReceipt.payment_date <= e_d)
        except ValueError:
            pass

    total_count = query.count()
    completed_q = query.filter(MemberContributionReceipt.status == "COMPLETED")
    total_sum = db.query(func.coalesce(func.sum(MemberContributionReceipt.total_amount), Decimal("0.00"))).filter(
        MemberContributionReceipt.id.in_(completed_q.with_entities(MemberContributionReceipt.id))
    ).scalar()

    offset = (page - 1) * limit
    items = query.order_by(
        MemberContributionReceipt.payment_date.desc(),
        MemberContributionReceipt.id.desc()
    ).offset(offset).limit(limit).all()

    return {
        "items": [format_contribution_out(c) for c in items],
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1,
        "total_amount_sum": Decimal(str(total_sum))
    }


# ==========================================
# Due Contribution Endpoint
# ==========================================

@router.get("/due-list", response_model=dict)
def get_due_contributions(
    year: int = Query(default_factory=lambda: date.today().year),
    start_month: int = Query(1, ge=1, le=12),
    end_month: Optional[int] = None,
    up_to_month: Optional[int] = None,
    group_id: Optional[int] = None,
    q: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    current_user: User = Depends(require_permission("contributions.due_list.view")),
    db: Session = Depends(get_db)
):
    """
    Computes members whose monthly contributions have not been paid for the specified period.
    Accounts for joining dates, advance payments, and member groups dynamically.
    """
    actual_end_month = up_to_month or end_month or min(12, date.today().month)
    if start_month > actual_end_month:
        start_month, actual_end_month = actual_end_month, start_month

    setting = get_current_setting(db)
    monthly_rate = Decimal(str(setting.monthly_amount))

    # Query active members
    m_query = db.query(Member).filter(Member.status == "Active")
    if group_id:
        m_query = m_query.filter(Member.group_id == group_id)
    if q and q.strip():
        term = f"%{q.strip()}%"
        m_query = m_query.filter(
            or_(
                Member.name.ilike(term),
                Member.member_id.ilike(term),
                Member.phone.ilike(term)
            )
        )

    members = m_query.order_by(Member.member_id.asc()).all()

    due_list = []
    total_due_amount = Decimal("0.00")
    total_members_with_dues = 0

    for m in members:
        # Determine starting month of obligation based on joining_date
        effective_start = start_month
        if m.joining_date:
            if m.joining_date.year > year:
                # Member joined in a future year, no obligations for this year
                continue
            elif m.joining_date.year == year:
                # Member joined this year, obligation begins on joining month
                effective_start = max(start_month, m.joining_date.month)

        if effective_start > actual_end_month:
            continue

        # Fetch paid months for this member in this year
        paid_rows = db.query(ContributionMonthAllocation.month).filter(
            ContributionMonthAllocation.member_id == m.id,
            ContributionMonthAllocation.year == year,
            ContributionMonthAllocation.status == "Paid"
        ).all()
        paid_months = sorted([row[0] for row in paid_rows])

        # Calculate due months within [effective_start, actual_end_month]
        due_months = [month for month in range(effective_start, actual_end_month + 1) if month not in paid_months]
        outstanding_due = monthly_rate * len(due_months)

        # Get last payment date
        last_payment = db.query(MemberContributionReceipt.payment_date).filter(
            MemberContributionReceipt.member_id == m.id,
            MemberContributionReceipt.status == "COMPLETED"
        ).order_by(MemberContributionReceipt.payment_date.desc()).first()
        last_payment_date = last_payment[0] if last_payment else None

        if due_months:
            total_members_with_dues += 1
            total_due_amount += outstanding_due

        due_list.append(DueMemberOut(
            member_id=m.id,
            member_code=m.member_id,
            member_name=m.name,
            group_id=m.group_id,
            group_code=m.group.code if m.group else "N/A",
            group_name=m.group.name if m.group else "Unassigned",
            monthly_amount=monthly_rate,
            paid_months=paid_months,
            due_months=due_months,
            due_months_count=len(due_months),
            paid_months_count=len(paid_months),
            due_month_names=[MONTH_NAMES[d] for d in due_months if 1 <= d <= 12],
            paid_month_names=[MONTH_NAMES[p] for p in paid_months if 1 <= p <= 12],
            total_due_amount=outstanding_due,
            outstanding_due_amount=outstanding_due,
            last_payment_date=last_payment_date,
            joining_date=m.joining_date
        ))

    # Sort so members with dues appear first
    due_list.sort(key=lambda d: d.outstanding_due_amount, reverse=True)
    total_count = len(due_list)
    offset = (page - 1) * limit
    paginated_items = due_list[offset:offset + limit]

    return {
        "year": year,
        "start_month": start_month,
        "end_month": actual_end_month,
        "up_to_month": actual_end_month,
        "monthly_rate": monthly_rate,
        "monthly_amount": monthly_rate,
        "total_due_amount": total_due_amount,
        "total_members_with_dues": total_members_with_dues,
        "total": total_count,
        "page": page,
        "limit": limit,
        "items": paginated_items
    }


# ==========================================
# Report Endpoint
# ==========================================

@router.get("/report/summary", response_model=ContributionReportSummary)
def get_contribution_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    group_id: Optional[int] = None,
    member_id: Optional[int] = None,
    current_user: User = Depends(require_permission("contribution_reports.view")),
    db: Session = Depends(get_db)
):
    """
    Computes comprehensive contribution reports from actual database transactions:
    Total collected, unique members, dues, advance collections, group breakdown, month breakdown.
    """
    s_d = None
    e_d = None
    if start_date:
        try:
            s_d = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            pass
    if end_date:
        try:
            e_d = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            pass

    # Base query for completed receipts
    query = db.query(MemberContributionReceipt).filter(MemberContributionReceipt.status == "COMPLETED")
    if s_d:
        query = query.filter(MemberContributionReceipt.payment_date >= s_d)
    if e_d:
        query = query.filter(MemberContributionReceipt.payment_date <= e_d)
    if year:
        query = query.filter(MemberContributionReceipt.contribution_year == year)
    if group_id:
        query = query.filter(MemberContributionReceipt.group_id == group_id)
    if member_id:
        query = query.filter(MemberContributionReceipt.member_id == member_id)

    receipts = query.all()
    receipt_ids = [r.id for r in receipts]

    total_collected = sum((Decimal(str(r.total_amount)) for r in receipts), Decimal("0.00"))
    total_receipts = len(receipts)
    unique_members = len(set(r.member_id for r in receipts))

    # Advance collections: contributions for months in the future compared to payment date
    advance_amount = Decimal("0.00")
    if receipt_ids:
        alloc_q = db.query(ContributionMonthAllocation, MemberContributionReceipt).join(
            MemberContributionReceipt,
            ContributionMonthAllocation.contribution_id == MemberContributionReceipt.id
        ).filter(
            ContributionMonthAllocation.contribution_id.in_(receipt_ids),
            ContributionMonthAllocation.status == "Paid"
        ).all()

        for alloc, rec in alloc_q:
            if (alloc.year > rec.payment_date.year) or (alloc.year == rec.payment_date.year and alloc.month > rec.payment_date.month):
                advance_amount += Decimal(str(alloc.amount))

    # Group-wise totals
    by_group = []
    if receipt_ids:
        group_rows = db.query(
            MemberContributionReceipt.group_id,
            Group.code,
            Group.name,
            func.sum(MemberContributionReceipt.total_amount).label("tot"),
            func.count(MemberContributionReceipt.id).label("rcnt"),
            func.count(func.distinct(MemberContributionReceipt.member_id)).label("mcnt")
        ).join(Group, MemberContributionReceipt.group_id == Group.id).filter(
            MemberContributionReceipt.id.in_(receipt_ids)
        ).group_by(MemberContributionReceipt.group_id, Group.code, Group.name).order_by(Group.code.asc()).all()

        for r in group_rows:
            by_group.append(ContributionGroupSummary(
                group_id=r[0],
                group_code=r[1],
                group_name=r[2],
                total_amount=Decimal(str(r[3])),
                receipt_count=r[4],
                member_count=r[5]
            ))

    # Month-wise totals (by allocation month 1..12)
    by_month = []
    if receipt_ids:
        month_rows = db.query(
            ContributionMonthAllocation.month,
            func.sum(ContributionMonthAllocation.amount).label("tot"),
            func.count(ContributionMonthAllocation.id).label("cnt")
        ).filter(
            ContributionMonthAllocation.contribution_id.in_(receipt_ids),
            ContributionMonthAllocation.status == "Paid"
        ).group_by(ContributionMonthAllocation.month).order_by(ContributionMonthAllocation.month.asc()).all()

        for r in month_rows:
            m_num = r[0]
            by_month.append(ContributionMonthSummary(
                month=m_num,
                month_name=MONTH_NAMES[m_num] if 1 <= m_num <= 12 else f"Month {m_num}",
                total_amount=Decimal(str(r[1])),
                receipt_count=r[2]
            ))

    # Compute current outstanding dues across active members
    current_year = year or date.today().year
    current_month = min(12, date.today().month)
    setting = get_current_setting(db)
    monthly_rate = Decimal(str(setting.monthly_amount))

    members_q = db.query(Member).filter(Member.status == "Active")
    if group_id:
        members_q = members_q.filter(Member.group_id == group_id)
    all_active_members = members_q.all()

    total_dues = Decimal("0.00")
    for m in all_active_members:
        start_m = 1
        if m.joining_date:
            if m.joining_date.year > current_year:
                continue
            elif m.joining_date.year == current_year:
                start_m = max(1, m.joining_date.month)

        if start_m <= current_month:
            paid_m_count = db.query(func.count(ContributionMonthAllocation.id)).filter(
                ContributionMonthAllocation.member_id == m.id,
                ContributionMonthAllocation.year == current_year,
                ContributionMonthAllocation.month >= start_m,
                ContributionMonthAllocation.month <= current_month,
                ContributionMonthAllocation.status == "Paid"
            ).scalar() or 0
            needed = (current_month - start_m + 1) - paid_m_count
            if needed > 0:
                total_dues += monthly_rate * needed

    return ContributionReportSummary(
        total_collected=total_collected,
        total_receipts=total_receipts,
        unique_members_paid=unique_members,
        total_outstanding_dues=total_dues,
        advance_collections_amount=advance_amount,
        start_date=s_d,
        end_date=e_d,
        by_group=by_group,
        by_month=by_month,
        total_advance_collected=advance_amount,
        total_due_outstanding=total_dues,
        group_summaries=[
            {
                "group_id": bg.group_id,
                "group_code": bg.group_code,
                "group_name": bg.group_name,
                "total_collected": bg.total_amount,
                "receipts_count": bg.receipt_count,
                "member_count": bg.member_count
            }
            for bg in by_group
        ],
        monthly_summaries=[
            {
                "month": m_idx,
                "month_name": [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ][m_idx - 1],
                "total_collected": next((bm.total_amount for bm in by_month if bm.month == m_idx), Decimal("0.00")),
                "receipts_count": next((bm.receipt_count for bm in by_month if bm.month == m_idx), 0)
            }
            for m_idx in range(1, 13)
        ]
    )


# ==========================================
# Detail & Cancellation Endpoints
# ==========================================

@router.get("/{id}", response_model=MemberContributionOut)
def get_contribution_detail(
    id: int,
    current_user: User = Depends(require_permission("contributions.view")),
    db: Session = Depends(get_db)
):
    """Retrieves full details of a specific contribution receipt."""
    c = db.query(MemberContributionReceipt).filter(MemberContributionReceipt.id == id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Contribution receipt not found.")
    return format_contribution_out(c)


@router.post("/{id}/cancel", response_model=MemberContributionOut)
def cancel_contribution(
    id: int,
    payload: ContributionCancelRequest,
    current_user: User = Depends(require_permission("contributions.cancel")),
    db: Session = Depends(get_db)
):
    """
    Safely cancels a posted contribution receipt.
    Reverses the GroupFundTransaction and marks month allocations as Cancelled.
    """
    if not payload.cancel_reason or not payload.cancel_reason.strip():
        raise HTTPException(status_code=400, detail="A cancellation reason must be provided.")

    try:
        contrib = db.query(MemberContributionReceipt).filter(
            MemberContributionReceipt.id == id
        ).with_for_update().first()

        if not contrib:
            raise HTTPException(status_code=404, detail="Contribution receipt not found.")

        if contrib.status == "CANCELLED":
            raise HTTPException(status_code=400, detail="Contribution receipt is already cancelled.")

        now = datetime.utcnow()
        reason = payload.cancel_reason.strip()

        # 1. Reverse Group Fund transaction (Spent)
        rev_tx = GroupFundTransaction(
            reference=f"REV-{contrib.receipt_id}",
            group_id=contrib.group_id,
            transaction_date=now,
            transaction_type="Spent",
            amount=contrib.total_amount,
            description=f"Reversal of contribution {contrib.receipt_id}: {reason}",
            created_by=current_user.full_name
        )
        db.add(rev_tx)

        # 2. Mark month allocations as Cancelled
        for ma in contrib.month_allocations:
            ma.status = "Cancelled"

        # 3. Mark receipt as CANCELLED
        contrib.status = "CANCELLED"
        contrib.cancelled_at = now
        contrib.cancelled_by_id = current_user.id
        contrib.cancel_reason = reason

        db.commit()
        db.refresh(contrib)
        return format_contribution_out(contrib)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel contribution: {str(exc)}")
