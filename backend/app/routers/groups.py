from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text, func, or_
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import uuid

from backend.app.database import get_db
from backend.app.models import Group, GroupFundTransaction, User, Member
from backend.app.schemas import (
    GroupCreate,
    GroupUpdate,
    GroupOut,
    GroupFundSummary,
    GroupFundTransactionOut
)
from backend.app.security import get_current_user, require_permission

router = APIRouter(prefix="/api/groups", tags=["groups"])

def get_next_group_code(db: Session) -> str:
    from backend.app.models import FoundationSetting
    setting = db.query(FoundationSetting).filter(FoundationSetting.id == 1).first()
    prefix = setting.group_prefix if setting and setting.group_prefix else "G-"
    # Use postgres sequence atomically
    res = db.execute(text("SELECT nextval('group_code_seq')")).scalar()
    code = f"{prefix}{int(res):04d}"
    # Verify uniqueness in case of custom codes created earlier
    while db.query(Group).filter(Group.code == code).first() is not None:
        res = db.execute(text("SELECT nextval('group_code_seq')")).scalar()
        code = f"{prefix}{int(res):04d}"
    return code

@router.get("", response_model=dict)
def list_groups(
    q: Optional[str] = Query(None, description="Search by name or code"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Active/Inactive)"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_permission("groups.view")),
    db: Session = Depends(get_db)
):
    query = db.query(Group)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(or_(Group.name.ilike(search_pattern), Group.code.ilike(search_pattern)))
    if status_filter:
        query = query.filter(Group.status == status_filter)

    total_count = query.count()
    offset = (page - 1) * limit
    groups = query.order_by(Group.id.asc()).offset(offset).limit(limit).all()

    # compute member counts
    group_ids = [g.id for g in groups]
    member_counts = {}
    if group_ids:
        counts = db.query(Member.group_id, func.count(Member.id)).filter(
            Member.group_id.in_(group_ids)
        ).group_by(Member.group_id).all()
        member_counts = {cid: cnt for cid, cnt in counts}

    items = []
    for g in groups:
        items.append(GroupOut(
            id=g.id,
            code=g.code,
            name=g.name,
            description=g.description,
            status=g.status,
            created_at=g.created_at,
            updated_at=g.updated_at,
            member_count=member_counts.get(g.id, 0)
        ))

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }

@router.get("/active-options", response_model=List[dict])
def list_active_group_options(
    current_user: User = Depends(require_permission("groups.view")),
    db: Session = Depends(get_db)
):
    """Returns id, code, name of active groups for dropdown selectors."""
    groups = db.query(Group).filter(Group.status == "Active").order_by(Group.name.asc()).all()
    return [{"id": g.id, "code": g.code, "name": g.name} for g in groups]

@router.get("/funds/summary", response_model=List[GroupFundSummary])
def get_group_funds_summary(
    current_user: User = Depends(require_permission("group_funds.view")),
    db: Session = Depends(get_db)
):
    groups = db.query(Group).order_by(Group.code.asc()).all()
    summaries = []

    for g in groups:
        # Calculate from actual recorded financial transactions only
        txs = db.query(GroupFundTransaction).filter(GroupFundTransaction.group_id == g.id).all()
        received = Decimal("0.00")
        spent = Decimal("0.00")
        for tx in txs:
            if tx.transaction_type == "Received":
                received += Decimal(str(tx.amount))
            elif tx.transaction_type == "Spent":
                spent += Decimal(str(tx.amount))

        available = received - spent
        summaries.append(GroupFundSummary(
            id=g.id,
            code=g.code,
            name=g.name,
            status=g.status,
            total_received=received,
            total_spent=spent,
            available_balance=available,
            transaction_count=len(txs)
        ))

    return summaries

@router.get("/{group_id}", response_model=GroupOut)
def get_group(
    group_id: int,
    current_user: User = Depends(require_permission("groups.view")),
    db: Session = Depends(get_db)
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    count = db.query(Member).filter(Member.group_id == group.id).count()
    return GroupOut(
        id=group.id,
        code=group.code,
        name=group.name,
        description=group.description,
        status=group.status,
        created_at=group.created_at,
        updated_at=group.updated_at,
        member_count=count
    )

@router.post("", response_model=GroupOut, status_code=status.HTTP_201_CREATED)
def create_group(
    payload: GroupCreate,
    current_user: User = Depends(require_permission("groups.create")),
    db: Session = Depends(get_db)
):
    # Determine code
    if payload.code and payload.code.strip():
        custom_code = payload.code.strip().upper()
        # Verify unique
        existing = db.query(Group).filter(Group.code == custom_code).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Group code '{custom_code}' already exists")
        final_code = custom_code
    else:
        final_code = get_next_group_code(db)

    group = Group(
        code=final_code,
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        status=payload.status
    )
    db.add(group)
    db.commit()
    db.refresh(group)
    return group

@router.patch("/{group_id}", response_model=GroupOut)
def update_group(
    group_id: int,
    payload: GroupUpdate,
    current_user: User = Depends(require_permission("groups.update")),
    db: Session = Depends(get_db)
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if payload.name is not None:
        group.name = payload.name.strip()
    if payload.description is not None:
        group.description = payload.description.strip()
    if payload.status is not None:
        group.status = payload.status

    db.commit()
    db.refresh(group)
    return group

@router.post("/{group_id}/status", response_model=GroupOut)
def toggle_group_status(
    group_id: int,
    current_user: User = Depends(require_permission("groups.deactivate")),
    db: Session = Depends(get_db)
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    new_status = "Inactive" if group.status == "Active" else "Active"
    group.status = new_status
    db.commit()
    db.refresh(group)
    return group

@router.get("/{group_id}/funds/ledger", response_model=dict)
def get_group_fund_ledger(
    group_id: int,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_permission("group_funds.ledger.view")),
    db: Session = Depends(get_db)
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    query = db.query(GroupFundTransaction).filter(GroupFundTransaction.group_id == group_id)
    if start_date:
        try:
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(GroupFundTransaction.transaction_date >= s_dt)
        except ValueError:
            pass
    if end_date:
        try:
            e_dt = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
            query = query.filter(GroupFundTransaction.transaction_date <= e_dt)
        except ValueError:
            pass

    total_count = query.count()
    offset = (page - 1) * limit
    transactions = query.order_by(GroupFundTransaction.transaction_date.desc(), GroupFundTransaction.id.desc()).offset(offset).limit(limit).all()

    # Overall totals for the group
    all_txs = db.query(GroupFundTransaction).filter(GroupFundTransaction.group_id == group_id).all()
    received = sum(Decimal(str(t.amount)) for t in all_txs if t.transaction_type == "Received")
    spent = sum(Decimal(str(t.amount)) for t in all_txs if t.transaction_type == "Spent")
    balance = received - spent

    return {
        "group": {
            "id": group.id,
            "code": group.code,
            "name": group.name,
            "status": group.status
        },
        "summary": {
            "total_received": received,
            "total_spent": spent,
            "available_balance": balance,
            "total_transactions": len(all_txs)
        },
        "items": [GroupFundTransactionOut.model_validate(t) for t in transactions],
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }

@router.post("/{group_id}/funds/transaction", response_model=GroupFundTransactionOut, status_code=status.HTTP_201_CREATED)
def record_group_transaction(
    group_id: int,
    transaction_type: str = Query(..., pattern="^(Received|Spent)$"),
    amount: Decimal = Query(..., gt=0),
    description: Optional[str] = None,
    current_user: User = Depends(require_permission("group_funds.ledger.view")),
    db: Session = Depends(get_db)
):
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    ref = f"GFX-{int(datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:6].upper()}"
    tx = GroupFundTransaction(
        reference=ref,
        group_id=group_id,
        transaction_date=datetime.utcnow(),
        transaction_type=transaction_type,
        amount=amount,
        description=description,
        created_by=current_user.full_name
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx
