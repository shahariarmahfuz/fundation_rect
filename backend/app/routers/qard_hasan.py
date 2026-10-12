from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text, or_, and_
from typing import List, Optional
from datetime import datetime, date, timedelta
from decimal import Decimal

from backend.app.database import get_db
from backend.app.models import (
    User, Group, Beneficiary, GroupFundTransaction, BeneficiaryLedger,
    QardHasan, QardHasanFundingAllocation, QardHasanRepaymentSchedule,
    QardHasanRepayment, QardHasanRepaymentGroupAllocation
)
from backend.app.schemas import (
    QardHasanCreate, QardHasanOut, QardHasanCancelRequest,
    QardHasanFundingAllocationOut, QardHasanScheduleOut,
    QardHasanRepaymentCreate, QardHasanRepaymentOut,
    QardHasanRepaymentGroupAllocationOut,
    QardHasanReportSummary, QardHasanGroupDisbursement,
    QardHasanGroupRepayment, QardHasanBeneficiarySummary,
    ActiveGroupBalanceOut, SadaqahBeneficiaryOut
)
from backend.app.security import require_permission, get_current_user

router = APIRouter(prefix="/api/qard-hasan", tags=["qard-hasan"])


def get_next_qard_hasan_id(db: Session) -> str:
    """Fetches next sequential Qard Hasan ID using postgres sequence."""
    from backend.app.models import FoundationSetting
    setting = db.query(FoundationSetting).filter(FoundationSetting.id == 1).first()
    prefix = setting.qard_hasan_prefix if setting and setting.qard_hasan_prefix else "QH-"
    val = db.execute(text("SELECT nextval('qard_hasan_id_seq')")).scalar()
    return f"{prefix}{int(val):04d}"


def get_next_repayment_receipt_id(db: Session) -> str:
    """Fetches next sequential Repayment Receipt ID (e.g. QHR-0001)."""
    val = db.execute(text("SELECT nextval('qard_hasan_repay_seq')")).scalar()
    return f"QHR-{int(val):04d}"


def format_loan_out(loan: QardHasan) -> QardHasanOut:
    outstanding = Decimal(str(loan.principal_amount)) - Decimal(str(loan.amount_repaid))
    if outstanding < Decimal("0.00"):
        outstanding = Decimal("0.00")

    today = date.today()
    next_due = None
    sorted_schedules = sorted(loan.schedules, key=lambda s: (s.due_date, s.installment_number))
    for s in sorted_schedules:
        if s.status != "Paid" and loan.status not in ["Fully Repaid", "Cancelled"]:
            next_due = s.due_date
            break

    schedules_out = []
    for s in sorted_schedules:
        is_overdue = (s.status != "Paid" and s.due_date < today and loan.status not in ["Fully Repaid", "Cancelled"])
        schedules_out.append(QardHasanScheduleOut(
            id=s.id,
            installment_number=s.installment_number,
            due_date=s.due_date,
            principal_due=Decimal(str(s.principal_due)),
            principal_paid=Decimal(str(s.principal_paid)),
            status=s.status,
            is_overdue=is_overdue
        ))

    allocations_out = [
        QardHasanFundingAllocationOut(
            id=a.id,
            group_id=a.group_id,
            group_code=a.group.code if a.group else f"GRP-{a.group_id}",
            group_name=a.group.name if a.group else f"Group #{a.group_id}",
            amount=Decimal(str(a.amount)),
            created_at=a.created_at
        )
        for a in loan.funding_allocations
    ]

    repayments_out = [
        format_repayment_out(r)
        for r in loan.repayments
    ]

    beneficiary_out = SadaqahBeneficiaryOut(
        id=loan.beneficiary.id,
        beneficiary_id=loan.beneficiary.beneficiary_id,
        name=loan.beneficiary.name,
        phone=loan.beneficiary.phone
    )

    return QardHasanOut(
        id=loan.id,
        loan_id=loan.loan_id,
        loan_date=loan.loan_date,
        principal_amount=Decimal(str(loan.principal_amount)),
        amount_repaid=Decimal(str(loan.amount_repaid)),
        outstanding_principal=outstanding,
        repayment_arrangement=loan.repayment_arrangement,
        first_due_date=loan.first_due_date,
        expected_completion_date=loan.expected_completion_date,
        next_due_date=next_due,
        purpose=loan.purpose,
        internal_reference=loan.internal_reference,
        notes=loan.notes,
        status=loan.status,
        beneficiary=beneficiary_out,
        funding_allocations=allocations_out,
        schedules=schedules_out,
        repayments=repayments_out,
        recorded_by_id=loan.recorded_by_id,
        recorded_by_name=loan.recorded_by.full_name if loan.recorded_by else None,
        cancelled_at=loan.cancelled_at,
        cancelled_by_id=loan.cancelled_by_id,
        cancelled_by_name=loan.cancelled_by.full_name if loan.cancelled_by else None,
        cancel_reason=loan.cancel_reason,
        created_at=loan.created_at,
        updated_at=loan.updated_at
    )


def format_repayment_out(r: QardHasanRepayment) -> QardHasanRepaymentOut:
    alloc_out = [
        QardHasanRepaymentGroupAllocationOut(
            id=ga.id,
            group_id=ga.group_id,
            group_code=ga.group.code if ga.group else f"GRP-{ga.group_id}",
            group_name=ga.group.name if ga.group else f"Group #{ga.group_id}",
            amount=Decimal(str(ga.amount))
        )
        for ga in r.group_allocations
    ]

    return QardHasanRepaymentOut(
        id=r.id,
        receipt_id=r.receipt_id,
        loan_id=r.loan_id,
        loan_code=r.loan.loan_id if r.loan else f"QH-{r.loan_id}",
        beneficiary_id=r.beneficiary_id,
        beneficiary_code=r.beneficiary.beneficiary_id if r.beneficiary else f"BEN-{r.beneficiary_id}",
        beneficiary_name=r.beneficiary.name if r.beneficiary else "Unknown",
        repayment_date=r.repayment_date,
        amount=Decimal(str(r.amount)),
        payment_method=r.payment_method,
        transaction_reference=r.transaction_reference,
        notes=r.notes,
        status=r.status,
        recorded_by_id=r.recorded_by_id,
        recorded_by_name=r.recorded_by.full_name if r.recorded_by else None,
        allocations=alloc_out,
        created_at=r.created_at
    )


@router.get("/next-id", response_model=dict)
def preview_next_loan_id(
    current_user: User = Depends(require_permission("qard_hasan.create")),
    db: Session = Depends(get_db)
):
    """Returns preview of the next sequential Qard Hasan ID."""
    curr = db.execute(text("SELECT last_value, is_called FROM qard_hasan_id_seq")).first()
    if curr and curr[1]:
        next_val = curr[0] + 1
    else:
        next_val = 1
    code = f"QH-{int(next_val):04d}"
    return {"next_id": code}


@router.get("/next-repay-id", response_model=dict)
def preview_next_repayment_id(
    current_user: User = Depends(require_permission("qard_hasan.repayment.create")),
    db: Session = Depends(get_db)
):
    """Returns preview of the next sequential Repayment Receipt ID."""
    curr = db.execute(text("SELECT last_value, is_called FROM qard_hasan_repay_seq")).first()
    if curr and curr[1]:
        next_val = curr[0] + 1
    else:
        next_val = 1
    code = f"QHR-{int(next_val):04d}"
    return {"next_id": code}


@router.get("/active-groups-with-balance", response_model=List[ActiveGroupBalanceOut])
def get_active_groups_with_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Returns active groups with live calculated balances from GroupFundTransaction.
    """
    user_perms = {p.code for p in current_user.role.permissions} if current_user.role else set()
    required = ["qard_hasan.create", "qard_hasan.view", "qard_hasan.repayment.create", "group_funds.view"]
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


@router.post("", response_model=QardHasanOut, status_code=status.HTTP_201_CREATED)
def create_qard_hasan_loan(
    payload: QardHasanCreate,
    current_user: User = Depends(require_permission("qard_hasan.create")),
    db: Session = Depends(get_db)
):
    """
    Issues an interest-free Qard Hasan loan to a registered beneficiary.
    Validates principal, multi-group allocations, balances, row-level locks,
    deducts group funds, records in beneficiary ledger, and sets up repayment schedules.
    """
    principal = Decimal(str(payload.principal_amount)).quantize(Decimal("0.01"))
    if principal <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Principal amount must be greater than zero.")

    if not payload.allocations:
        raise HTTPException(status_code=400, detail="At least one funding group must be selected.")

    # Check for duplicate funding groups
    group_ids = [a.group_id for a in payload.allocations]
    if len(group_ids) != len(set(group_ids)):
        raise HTTPException(status_code=400, detail="Duplicate group allocation found. Each group can only be selected once per loan.")

    # Validate allocation amounts
    allocated_sum = Decimal("0.00")
    for a in payload.allocations:
        amt = Decimal(str(a.amount)).quantize(Decimal("0.01"))
        if amt <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Group allocation amount must be greater than zero.")
        allocated_sum += amt

    if allocated_sum != principal:
        raise HTTPException(
            status_code=400,
            detail=f"The sum of group allocations (৳{allocated_sum:,.2f}) must exactly equal the loan principal (৳{principal:,.2f})."
        )

    # Validate beneficiary
    beneficiary = db.query(Beneficiary).filter(Beneficiary.id == payload.beneficiary_id).first()
    if not beneficiary:
        raise HTTPException(status_code=404, detail="Selected beneficiary not found.")
    if beneficiary.status != "Active":
        raise HTTPException(status_code=400, detail=f"Cannot issue loan to inactive beneficiary {beneficiary.beneficiary_id}.")

    # Validate repayment arrangement
    if payload.repayment_arrangement not in ["One-time", "Installments"]:
        raise HTTPException(status_code=400, detail="Repayment arrangement must be 'One-time' or 'Installments'.")

    # If Installments, validate schedules
    schedules_to_create = []
    if payload.repayment_arrangement == "Installments":
        if payload.schedules and len(payload.schedules) > 0:
            sched_sum = Decimal("0.00")
            for idx, s in enumerate(payload.schedules, start=1):
                p_due = Decimal(str(s.principal_due)).quantize(Decimal("0.01"))
                if p_due <= Decimal("0.00"):
                    raise HTTPException(status_code=400, detail=f"Schedule installment #{s.installment_number} principal must be greater than zero.")
                sched_sum += p_due
                schedules_to_create.append({
                    "installment_number": s.installment_number or idx,
                    "due_date": s.due_date,
                    "principal_due": p_due
                })
            if sched_sum != principal:
                raise HTTPException(
                    status_code=400,
                    detail=f"The sum of scheduled installments (৳{sched_sum:,.2f}) must exactly equal the loan principal (৳{principal:,.2f})."
                )
        else:
            if not payload.first_due_date:
                raise HTTPException(status_code=400, detail="First Due Date is required when scheduled installments are used.")
            # Default to 1 installment if no detailed schedule array was provided
            schedules_to_create.append({
                "installment_number": 1,
                "due_date": payload.first_due_date,
                "principal_due": principal
            })
    else:  # One-time
        due_dt = payload.expected_completion_date or payload.first_due_date or (payload.loan_date + timedelta(days=30))
        schedules_to_create.append({
            "installment_number": 1,
            "due_date": due_dt,
            "principal_due": principal
        })

    # Pessimistic concurrency row-level lock on Groups in ascending ID order to prevent deadlocks
    try:
        locked_groups = db.query(Group).filter(
            Group.id.in_(group_ids)
        ).order_by(Group.id.asc()).with_for_update().all()

        if len(locked_groups) != len(group_ids):
            raise HTTPException(status_code=400, detail="One or more selected funding groups do not exist.")

        group_map = {g.id: g for g in locked_groups}

        # Check group status and live available balance inside lock
        for a in payload.allocations:
            g = group_map[a.group_id]
            if g.status != "Active":
                raise HTTPException(status_code=400, detail=f"Funding Group {g.code} ({g.name}) is inactive.")

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

        # Generate unique sequential loan ID
        loan_id = get_next_qard_hasan_id(db)

        # 1. Create QardHasan record
        loan = QardHasan(
            loan_id=loan_id,
            beneficiary_id=beneficiary.id,
            loan_date=payload.loan_date,
            principal_amount=principal,
            amount_repaid=Decimal("0.00"),
            repayment_arrangement=payload.repayment_arrangement,
            first_due_date=payload.first_due_date or (schedules_to_create[0]["due_date"] if schedules_to_create else None),
            expected_completion_date=payload.expected_completion_date or (schedules_to_create[-1]["due_date"] if schedules_to_create else None),
            purpose=payload.purpose.strip() if payload.purpose else None,
            internal_reference=payload.internal_reference.strip() if payload.internal_reference else None,
            notes=payload.notes.strip() if payload.notes else None,
            status="Active",
            recorded_by_id=current_user.id
        )
        db.add(loan)
        db.flush()

        tx_datetime = datetime.combine(payload.loan_date, datetime.utcnow().time())

        # 2. Create funding allocations & group fund outgoing ledger entries
        for a in payload.allocations:
            alloc_amt = Decimal(str(a.amount)).quantize(Decimal("0.01"))
            fa = QardHasanFundingAllocation(
                loan_id=loan.id,
                group_id=a.group_id,
                amount=alloc_amt
            )
            db.add(fa)

            g_desc = f"Qard Hasan loan disbursement {loan_id} to beneficiary {beneficiary.beneficiary_id} ({beneficiary.name})"
            if payload.purpose:
                g_desc += f" - {payload.purpose.strip()}"

            group_tx = GroupFundTransaction(
                reference=loan_id,
                group_id=a.group_id,
                transaction_date=tx_datetime,
                transaction_type="Spent",
                amount=alloc_amt,
                description=g_desc,
                created_by=current_user.full_name
            )
            db.add(group_tx)

        # 3. Create repayment schedule entries
        for s in schedules_to_create:
            sched = QardHasanRepaymentSchedule(
                loan_id=loan.id,
                installment_number=s["installment_number"],
                due_date=s["due_date"],
                principal_due=s["principal_due"],
                principal_paid=Decimal("0.00"),
                status="Pending"
            )
            db.add(sched)

        # 4. Create Beneficiary Ledger entry (Disbursed)
        b_desc = f"Qard Hasan loan {loan_id}"
        if payload.purpose:
            b_desc += f" - {payload.purpose.strip()}"

        b_entry = BeneficiaryLedger(
            reference=loan_id,
            beneficiary_id=beneficiary.id,
            transaction_date=tx_datetime,
            transaction_type="Disbursed",
            amount=principal,
            description=b_desc,
            created_by=current_user.full_name
        )
        db.add(b_entry)

        db.commit()
        db.refresh(loan)
        return format_loan_out(loan)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to issue Qard Hasan loan: {str(exc)}")


@router.get("", response_model=dict)
def list_qard_hasan_loans(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: Optional[str] = None,
    status_filter: Optional[str] = Query("ALL", alias="status"),
    group_id: Optional[int] = None,
    beneficiary_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort_by: Optional[str] = Query("date"),
    sort_order: Optional[str] = Query("desc"),
    current_user: User = Depends(require_permission("qard_hasan.view")),
    db: Session = Depends(get_db)
):
    """
    Lists Qard Hasan loans with server-side pagination, search, and filtering.
    """
    query = db.query(QardHasan).join(Beneficiary, QardHasan.beneficiary_id == Beneficiary.id)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                QardHasan.loan_id.ilike(term),
                Beneficiary.name.ilike(term),
                Beneficiary.beneficiary_id.ilike(term),
                QardHasan.internal_reference.ilike(term)
            )
        )

    if start_date:
        try:
            s_d = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(QardHasan.loan_date >= s_d)
        except ValueError:
            pass

    if end_date:
        try:
            e_d = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(QardHasan.loan_date <= e_d)
        except ValueError:
            pass

    if group_id:
        query = query.join(QardHasanFundingAllocation, QardHasan.id == QardHasanFundingAllocation.loan_id).filter(
            QardHasanFundingAllocation.group_id == group_id
        ).distinct()

    if beneficiary_id:
        query = query.filter(QardHasan.beneficiary_id == beneficiary_id)

    if status_filter and status_filter.upper() != "ALL":
        query = query.filter(QardHasan.status.ilike(status_filter))

    total_count = query.count()

    # Aggregate completed principal disbursements and repayments
    active_query = query.filter(QardHasan.status != "Cancelled")
    total_disbursed = db.query(func.coalesce(func.sum(QardHasan.principal_amount), Decimal("0.00"))).filter(
        QardHasan.id.in_(active_query.with_entities(QardHasan.id))
    ).scalar()
    total_repaid = db.query(func.coalesce(func.sum(QardHasan.amount_repaid), Decimal("0.00"))).filter(
        QardHasan.id.in_(active_query.with_entities(QardHasan.id))
    ).scalar()
    total_outstanding = Decimal(str(total_disbursed)) - Decimal(str(total_repaid))

    # Sorting
    if sort_by == "principal":
        order_col = QardHasan.principal_amount.asc() if sort_order == "asc" else QardHasan.principal_amount.desc()
    elif sort_by == "id":
        order_col = QardHasan.id.asc() if sort_order == "asc" else QardHasan.id.desc()
    else:
        order_col = QardHasan.loan_date.asc() if sort_order == "asc" else QardHasan.loan_date.desc()

    offset = (page - 1) * limit
    items = query.order_by(order_col, QardHasan.id.desc()).offset(offset).limit(limit).all()

    return {
        "items": [format_loan_out(loan) for loan in items],
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1,
        "total_disbursed_sum": Decimal(str(total_disbursed)),
        "total_repaid_sum": Decimal(str(total_repaid)),
        "total_outstanding_sum": total_outstanding
    }


@router.get("/eligible-loans", response_model=List[QardHasanOut])
def get_eligible_loans_for_repayment(
    beneficiary_id: Optional[int] = None,
    current_user: User = Depends(require_permission("qard_hasan.repayment.create")),
    db: Session = Depends(get_db)
):
    """
    Returns active or partially repaid loans with outstanding balance, optionally filtered by beneficiary.
    """
    query = db.query(QardHasan).filter(
        QardHasan.status.in_(["Active", "Partially Repaid"]),
        QardHasan.principal_amount > QardHasan.amount_repaid
    )
    if beneficiary_id:
        query = query.filter(QardHasan.beneficiary_id == beneficiary_id)

    loans = query.order_by(QardHasan.loan_date.desc(), QardHasan.id.desc()).all()
    return [format_loan_out(l) for l in loans]


@router.get("/{id}", response_model=QardHasanOut)
def get_qard_hasan_detail(
    id: int,
    current_user: User = Depends(require_permission("qard_hasan.view")),
    db: Session = Depends(get_db)
):
    """Retrieves full details of a specific Qard Hasan loan."""
    loan = db.query(QardHasan).filter(QardHasan.id == id).first()
    if not loan:
        raise HTTPException(status_code=404, detail="Qard Hasan loan not found.")
    return format_loan_out(loan)


@router.post("/{id}/cancel", response_model=QardHasanOut)
def cancel_qard_hasan_loan(
    id: int,
    payload: QardHasanCancelRequest,
    current_user: User = Depends(require_permission("qard_hasan.cancel")),
    db: Session = Depends(get_db)
):
    """
    Safely cancels an issued Qard Hasan loan if no repayments have been made.
    Restores the exact allocated amounts to participating groups in GroupFundTransaction.
    Creates a reversal entry in BeneficiaryLedger.
    """
    if not payload.cancel_reason or not payload.cancel_reason.strip():
        raise HTTPException(status_code=400, detail="A cancellation reason must be provided.")

    try:
        loan = db.query(QardHasan).filter(QardHasan.id == id).with_for_update().first()
        if not loan:
            raise HTTPException(status_code=404, detail="Qard Hasan loan not found.")

        if loan.status == "Cancelled":
            raise HTTPException(status_code=400, detail="This loan is already cancelled.")

        if Decimal(str(loan.amount_repaid)) > Decimal("0.00") or len(loan.repayments) > 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot cancel loan because repayments have already been recorded. Outstanding repayments must first be reviewed."
            )

        # Lock participating groups
        alloc_group_ids = [a.group_id for a in loan.funding_allocations]
        db.query(Group).filter(
            Group.id.in_(alloc_group_ids)
        ).order_by(Group.id.asc()).with_for_update().all()

        now = datetime.utcnow()
        reason = payload.cancel_reason.strip()

        # 1. Restore funds to each participating group
        for a in loan.funding_allocations:
            rev_tx = GroupFundTransaction(
                reference=f"REV-{loan.loan_id}",
                group_id=a.group_id,
                transaction_date=now,
                transaction_type="Received",
                amount=a.amount,
                description=f"Reversal of Qard Hasan loan {loan.loan_id}: {reason}",
                created_by=current_user.full_name
            )
            db.add(rev_tx)

        # 2. Reverse beneficiary ledger disbursement
        rev_b_entry = BeneficiaryLedger(
            reference=f"REV-{loan.loan_id}",
            beneficiary_id=loan.beneficiary_id,
            transaction_date=now,
            transaction_type="Received",
            amount=loan.principal_amount,
            description=f"Reversal of Qard Hasan loan {loan.loan_id}: {reason}",
            created_by=current_user.full_name
        )
        db.add(rev_b_entry)

        # 3. Mark schedules as Cancelled
        for s in loan.schedules:
            s.status = "Cancelled"

        # 4. Mark Loan as Cancelled
        loan.status = "Cancelled"
        loan.cancelled_at = now
        loan.cancelled_by_id = current_user.id
        loan.cancel_reason = reason

        db.commit()
        db.refresh(loan)
        return format_loan_out(loan)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel loan: {str(exc)}")


# ==========================================
# Repayments Endpoints
# ==========================================

@router.post("/repayments", response_model=QardHasanRepaymentOut, status_code=status.HTTP_201_CREATED)
def record_qard_hasan_repayment(
    payload: QardHasanRepaymentCreate,
    current_user: User = Depends(require_permission("qard_hasan.repayment.create")),
    db: Session = Depends(get_db)
):
    """
    Records an interest-free principal repayment for an active Qard Hasan loan.
    Credits the repayment to specified receiving group(s) in GroupFundTransaction,
    creates a BeneficiaryLedger entry, updates outstanding principal, and advances schedules.
    """
    repay_amt = Decimal(str(payload.amount)).quantize(Decimal("0.01"))
    if repay_amt <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Repayment amount must be greater than zero.")

    if not payload.allocations:
        raise HTTPException(status_code=400, detail="At least one receiving group must be selected.")

    # Validate receiving group allocations sum
    rec_group_ids = [a.group_id for a in payload.allocations]
    if len(rec_group_ids) != len(set(rec_group_ids)):
        raise HTTPException(status_code=400, detail="Duplicate receiving group allocation found.")

    rec_sum = Decimal("0.00")
    for a in payload.allocations:
        a_amt = Decimal(str(a.amount)).quantize(Decimal("0.01"))
        if a_amt <= Decimal("0.00"):
            raise HTTPException(status_code=400, detail="Receiving group allocation must be greater than zero.")
        rec_sum += a_amt

    if rec_sum != repay_amt:
        raise HTTPException(
            status_code=400,
            detail=f"The sum of receiving group allocations (৳{rec_sum:,.2f}) must exactly equal the repayment amount (৳{repay_amt:,.2f})."
        )

    try:
        # Lock loan
        loan = db.query(QardHasan).filter(QardHasan.id == payload.loan_id).with_for_update().first()
        if not loan:
            raise HTTPException(status_code=404, detail="Qard Hasan loan not found.")

        if loan.status not in ["Active", "Partially Repaid"]:
            raise HTTPException(status_code=400, detail=f"Cannot record repayment for loan in '{loan.status}' status.")

        outstanding = Decimal(str(loan.principal_amount)) - Decimal(str(loan.amount_repaid))
        if repay_amt > outstanding:
            raise HTTPException(
                status_code=400,
                detail=f"Repayment amount (৳{repay_amt:,.2f}) exceeds outstanding principal (৳{outstanding:,.2f}). Overpayment is not permitted."
            )

        # Lock receiving groups
        locked_rec_groups = db.query(Group).filter(
            Group.id.in_(rec_group_ids)
        ).order_by(Group.id.asc()).with_for_update().all()

        if len(locked_rec_groups) != len(rec_group_ids):
            raise HTTPException(status_code=400, detail="One or more receiving groups do not exist.")

        for g in locked_rec_groups:
            if g.status != "Active":
                raise HTTPException(status_code=400, detail=f"Receiving Group {g.code} ({g.name}) is inactive.")

        # Generate unique receipt ID
        receipt_id = get_next_repayment_receipt_id(db)
        tx_datetime = datetime.combine(payload.repayment_date, datetime.utcnow().time())

        # 1. Create repayment record
        repayment = QardHasanRepayment(
            receipt_id=receipt_id,
            loan_id=loan.id,
            beneficiary_id=loan.beneficiary_id,
            repayment_date=payload.repayment_date,
            amount=repay_amt,
            payment_method=payload.payment_method,
            transaction_reference=payload.transaction_reference.strip() if payload.transaction_reference else None,
            notes=payload.notes.strip() if payload.notes else None,
            recorded_by_id=current_user.id,
            status="COMPLETED"
        )
        db.add(repayment)
        db.flush()

        # 2. Add repayment group allocations & credit GroupFundTransactions
        beneficiary = loan.beneficiary
        for a in payload.allocations:
            a_amt = Decimal(str(a.amount)).quantize(Decimal("0.01"))
            rga = QardHasanRepaymentGroupAllocation(
                repayment_id=repayment.id,
                group_id=a.group_id,
                amount=a_amt
            )
            db.add(rga)

            g_desc = f"Qard Hasan repayment {receipt_id} for loan {loan.loan_id} from {beneficiary.beneficiary_id} ({beneficiary.name})"
            if payload.transaction_reference:
                g_desc += f" [Ref: {payload.transaction_reference.strip()}]"

            gtx = GroupFundTransaction(
                reference=receipt_id,
                group_id=a.group_id,
                transaction_date=tx_datetime,
                transaction_type="Received",
                amount=a_amt,
                description=g_desc,
                created_by=current_user.full_name
            )
            db.add(gtx)

        # 3. Record BeneficiaryLedger credit (Received)
        b_desc = f"Qard Hasan repayment {receipt_id} for loan {loan.loan_id} ({payload.payment_method})"
        if payload.transaction_reference:
            b_desc += f" [Ref: {payload.transaction_reference.strip()}]"

        b_entry = BeneficiaryLedger(
            reference=receipt_id,
            beneficiary_id=beneficiary.id,
            transaction_date=tx_datetime,
            transaction_type="Received",
            amount=repay_amt,
            description=b_desc,
            created_by=current_user.full_name
        )
        db.add(b_entry)

        # 4. Update loan amount_repaid and status
        new_repaid = Decimal(str(loan.amount_repaid)) + repay_amt
        loan.amount_repaid = new_repaid
        if new_repaid >= Decimal(str(loan.principal_amount)):
            loan.status = "Fully Repaid"
        else:
            loan.status = "Partially Repaid"

        # 5. Distribute repayment across scheduled installments
        remaining_to_apply = repay_amt
        unpaid_schedules = db.query(QardHasanRepaymentSchedule).filter(
            QardHasanRepaymentSchedule.loan_id == loan.id,
            QardHasanRepaymentSchedule.status.in_(["Pending", "Partially Paid"])
        ).order_by(QardHasanRepaymentSchedule.due_date.asc(), QardHasanRepaymentSchedule.installment_number.asc()).all()

        for s in unpaid_schedules:
            unpaid_inst = Decimal(str(s.principal_due)) - Decimal(str(s.principal_paid))
            if unpaid_inst <= Decimal("0.00"):
                continue
            pay = min(remaining_to_apply, unpaid_inst)
            s.principal_paid = Decimal(str(s.principal_paid)) + pay
            if Decimal(str(s.principal_paid)) >= Decimal(str(s.principal_due)):
                s.status = "Paid"
            else:
                s.status = "Partially Paid"
            remaining_to_apply -= pay
            if remaining_to_apply <= Decimal("0.00"):
                break

        db.commit()
        db.refresh(repayment)
        return format_repayment_out(repayment)

    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to record repayment: {str(exc)}")


@router.get("/repayments", response_model=dict)
def list_qard_hasan_repayments(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    q: Optional[str] = None,
    loan_id: Optional[int] = None,
    beneficiary_id: Optional[int] = None,
    group_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: User = Depends(require_permission("qard_hasan.repayment.view")),
    db: Session = Depends(get_db)
):
    """Lists repayment transactions with filtering and server pagination."""
    query = db.query(QardHasanRepayment).join(Beneficiary, QardHasanRepayment.beneficiary_id == Beneficiary.id).join(QardHasan, QardHasanRepayment.loan_id == QardHasan.id)

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                QardHasanRepayment.receipt_id.ilike(term),
                QardHasan.loan_id.ilike(term),
                Beneficiary.name.ilike(term),
                Beneficiary.beneficiary_id.ilike(term),
                QardHasanRepayment.transaction_reference.ilike(term)
            )
        )

    if loan_id:
        query = query.filter(QardHasanRepayment.loan_id == loan_id)

    if beneficiary_id:
        query = query.filter(QardHasanRepayment.beneficiary_id == beneficiary_id)

    if start_date:
        try:
            s_d = datetime.strptime(start_date, "%Y-%m-%d").date()
            query = query.filter(QardHasanRepayment.repayment_date >= s_d)
        except ValueError:
            pass

    if end_date:
        try:
            e_d = datetime.strptime(end_date, "%Y-%m-%d").date()
            query = query.filter(QardHasanRepayment.repayment_date <= e_d)
        except ValueError:
            pass

    if group_id:
        query = query.join(QardHasanRepaymentGroupAllocation, QardHasanRepayment.id == QardHasanRepaymentGroupAllocation.repayment_id).filter(
            QardHasanRepaymentGroupAllocation.group_id == group_id
        ).distinct()

    total_count = query.count()
    total_repaid_sum = db.query(func.coalesce(func.sum(QardHasanRepayment.amount), Decimal("0.00"))).filter(
        QardHasanRepayment.id.in_(query.with_entities(QardHasanRepayment.id)),
        QardHasanRepayment.status == "COMPLETED"
    ).scalar()

    offset = (page - 1) * limit
    items = query.order_by(QardHasanRepayment.repayment_date.desc(), QardHasanRepayment.id.desc()).offset(offset).limit(limit).all()

    return {
        "items": [format_repayment_out(r) for r in items],
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1,
        "total_repaid_sum": Decimal(str(total_repaid_sum))
    }


# ==========================================
# Reporting Endpoint
# ==========================================

@router.get("/report/summary", response_model=QardHasanReportSummary)
def get_qard_hasan_report(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    beneficiary_id: Optional[int] = None,
    group_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(require_permission("qard_hasan_reports.view")),
    db: Session = Depends(get_db)
):
    """
    Computes comprehensive Qard Hasan reports using actual posted transactions:
    - Principal disbursed
    - Principal repaid
    - Outstanding principal
    - Overdue principal based on past due dates
    - Disbursements & repayments by group
    - Beneficiary balances
    """
    today = date.today()
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

    # Loan base query
    loan_q = db.query(QardHasan).filter(QardHasan.status != "Cancelled")
    if s_d:
        loan_q = loan_q.filter(QardHasan.loan_date >= s_d)
    if e_d:
        loan_q = loan_q.filter(QardHasan.loan_date <= e_d)
    if beneficiary_id:
        loan_q = loan_q.filter(QardHasan.beneficiary_id == beneficiary_id)
    if status_filter and status_filter.upper() != "ALL":
        loan_q = loan_q.filter(QardHasan.status.ilike(status_filter))
    if group_id:
        loan_q = loan_q.join(QardHasanFundingAllocation, QardHasan.id == QardHasanFundingAllocation.loan_id).filter(
            QardHasanFundingAllocation.group_id == group_id
        ).distinct()

    loans = loan_q.all()
    loan_ids = [l.id for l in loans]

    total_disbursed = sum((Decimal(str(l.principal_amount)) for l in loans), Decimal("0.00"))
    total_repaid = sum((Decimal(str(l.amount_repaid)) for l in loans), Decimal("0.00"))
    total_outstanding = total_disbursed - total_repaid
    if total_outstanding < Decimal("0.00"):
        total_outstanding = Decimal("0.00")

    active_count = sum(1 for l in loans if l.status in ["Active", "Partially Repaid"])
    fully_repaid_count = sum(1 for l in loans if l.status == "Fully Repaid")

    # Cancelled count
    canc_q = db.query(QardHasan).filter(QardHasan.status == "Cancelled")
    if s_d:
        canc_q = canc_q.filter(QardHasan.loan_date >= s_d)
    if e_d:
        canc_q = canc_q.filter(QardHasan.loan_date <= e_d)
    if beneficiary_id:
        canc_q = canc_q.filter(QardHasan.beneficiary_id == beneficiary_id)
    cancelled_count = canc_q.count()

    # Calculate Overdue Principal from outstanding schedules whose due_date < today
    overdue_principal = Decimal("0.00")
    if loan_ids:
        scheds = db.query(QardHasanRepaymentSchedule).filter(
            QardHasanRepaymentSchedule.loan_id.in_(loan_ids),
            QardHasanRepaymentSchedule.due_date < today,
            QardHasanRepaymentSchedule.status.in_(["Pending", "Partially Paid"])
        ).all()
        for sc in scheds:
            unpd = Decimal(str(sc.principal_due)) - Decimal(str(sc.principal_paid))
            if unpd > Decimal("0.00"):
                overdue_principal += unpd

    # Disbursements by group
    grp_disb = []
    if loan_ids:
        alloc_rows = db.query(
            QardHasanFundingAllocation.group_id,
            Group.code,
            Group.name,
            func.sum(QardHasanFundingAllocation.amount).label("total_disbursed"),
            func.count(QardHasanFundingAllocation.id).label("tx_count")
        ).join(Group, QardHasanFundingAllocation.group_id == Group.id).filter(
            QardHasanFundingAllocation.loan_id.in_(loan_ids)
        ).group_by(QardHasanFundingAllocation.group_id, Group.code, Group.name).order_by(Group.code.asc()).all()

        for r in alloc_rows:
            grp_disb.append(QardHasanGroupDisbursement(
                group_id=r[0],
                group_code=r[1],
                group_name=r[2],
                total_disbursed=Decimal(str(r[3])),
                transaction_count=r[4]
            ))

    # Repayments by group
    grp_repay = []
    repay_q = db.query(QardHasanRepayment).filter(QardHasanRepayment.status == "COMPLETED")
    if s_d:
        repay_q = repay_q.filter(QardHasanRepayment.repayment_date >= s_d)
    if e_d:
        repay_q = repay_q.filter(QardHasanRepayment.repayment_date <= e_d)
    if beneficiary_id:
        repay_q = repay_q.filter(QardHasanRepayment.beneficiary_id == beneficiary_id)
    if loan_ids:
        repay_q = repay_q.filter(QardHasanRepayment.loan_id.in_(loan_ids))

    repay_ids = [r.id for r in repay_q.all()]
    if repay_ids:
        rga_rows = db.query(
            QardHasanRepaymentGroupAllocation.group_id,
            Group.code,
            Group.name,
            func.sum(QardHasanRepaymentGroupAllocation.amount).label("total_repaid"),
            func.count(QardHasanRepaymentGroupAllocation.id).label("tx_count")
        ).join(Group, QardHasanRepaymentGroupAllocation.group_id == Group.id).filter(
            QardHasanRepaymentGroupAllocation.repayment_id.in_(repay_ids)
        ).group_by(QardHasanRepaymentGroupAllocation.group_id, Group.code, Group.name).order_by(Group.code.asc()).all()

        for r in rga_rows:
            grp_repay.append(QardHasanGroupRepayment(
                group_id=r[0],
                group_code=r[1],
                group_name=r[2],
                total_repaid=Decimal(str(r[3])),
                transaction_count=r[4]
            ))

    # Beneficiary wise balances
    ben_balances = []
    beneficiary_groups = {}
    for l in loans:
        b_id = l.beneficiary_id
        if b_id not in beneficiary_groups:
            beneficiary_groups[b_id] = {
                "beneficiary_id": b_id,
                "beneficiary_code": l.beneficiary.beneficiary_id,
                "beneficiary_name": l.beneficiary.name,
                "total_principal": Decimal("0.00"),
                "total_repaid": Decimal("0.00"),
                "loan_count": 0,
                "active_loans": 0
            }
        bg = beneficiary_groups[b_id]
        bg["total_principal"] += Decimal(str(l.principal_amount))
        bg["total_repaid"] += Decimal(str(l.amount_repaid))
        bg["loan_count"] += 1
        if l.status in ["Active", "Partially Repaid"]:
            bg["active_loans"] += 1

    for bg in beneficiary_groups.values():
        out_b = bg["total_principal"] - bg["total_repaid"]
        if out_b < Decimal("0.00"):
            out_b = Decimal("0.00")
        ben_balances.append(QardHasanBeneficiarySummary(
            beneficiary_id=bg["beneficiary_id"],
            beneficiary_code=bg["beneficiary_code"],
            beneficiary_name=bg["beneficiary_name"],
            total_principal=bg["total_principal"],
            total_repaid=bg["total_repaid"],
            outstanding_principal=out_b,
            loan_count=bg["loan_count"],
            active_loans=bg["active_loans"]
        ))

    ben_balances.sort(key=lambda b: b.outstanding_principal, reverse=True)

    return QardHasanReportSummary(
        total_principal_disbursed=total_disbursed,
        total_principal_repaid=total_repaid,
        total_outstanding_principal=total_outstanding,
        total_overdue_principal=overdue_principal,
        active_loans_count=active_count,
        fully_repaid_loans_count=fully_repaid_count,
        cancelled_loans_count=cancelled_count,
        total_loans_count=len(loans) + cancelled_count,
        start_date=s_d,
        end_date=e_d,
        disbursements_by_group=grp_disb,
        repayments_by_group=grp_repay,
        beneficiary_balances=ben_balances
    )
