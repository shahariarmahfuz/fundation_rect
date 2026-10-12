from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
import uuid

from backend.app.database import get_db
from backend.app.models import Beneficiary, BeneficiaryLedger, User
from backend.app.schemas import (
    BeneficiaryCreate,
    BeneficiaryUpdate,
    BeneficiaryOut,
    BeneficiaryLedgerEntryOut,
    BeneficiaryLedgerSummary
)
from backend.app.security import get_current_user, require_permission

router = APIRouter(prefix="/api/beneficiaries", tags=["beneficiaries"])

def get_next_beneficiary_id(db: Session) -> str:
    from backend.app.models import FoundationSetting
    setting = db.query(FoundationSetting).filter(FoundationSetting.id == 1).first()
    prefix = setting.beneficiary_prefix if setting and setting.beneficiary_prefix else "B-"
    res = db.execute(text("SELECT nextval('beneficiary_id_seq')")).scalar()
    bid = f"{prefix}{int(res):04d}"
    while db.query(Beneficiary).filter(Beneficiary.beneficiary_id == bid).first() is not None:
        res = db.execute(text("SELECT nextval('beneficiary_id_seq')")).scalar()
        bid = f"{prefix}{int(res):04d}"
    return bid

@router.get("", response_model=dict)
def list_beneficiaries(
    q: Optional[str] = Query(None, description="Search by ID or name"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_permission("beneficiaries.view")),
    db: Session = Depends(get_db)
):
    query = db.query(Beneficiary)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(or_(Beneficiary.name.ilike(search_pattern), Beneficiary.beneficiary_id.ilike(search_pattern)))
    if status_filter:
        query = query.filter(Beneficiary.status == status_filter)

    total_count = query.count()
    offset = (page - 1) * limit
    beneficiaries = query.order_by(Beneficiary.id.desc()).offset(offset).limit(limit).all()

    items = [
        BeneficiaryOut(
            id=b.id,
            beneficiary_id=b.beneficiary_id,
            name=b.name,
            phone=b.phone,
            address=b.address,
            registration_date=b.registration_date,
            status=b.status,
            notes=b.notes,
            created_at=b.created_at,
            updated_at=b.updated_at
        ) for b in beneficiaries
    ]

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }

@router.get("/options", response_model=List[dict])
def list_beneficiary_options(
    current_user: User = Depends(require_permission("beneficiaries.view")),
    db: Session = Depends(get_db)
):
    """Returns id, beneficiary_id, name for selectors."""
    items = db.query(Beneficiary).order_by(Beneficiary.name.asc()).all()
    return [{"id": b.id, "beneficiary_id": b.beneficiary_id, "name": b.name, "status": b.status} for b in items]

@router.get("/{beneficiary_id}", response_model=BeneficiaryOut)
def get_beneficiary(
    beneficiary_id: int,
    current_user: User = Depends(require_permission("beneficiaries.view")),
    db: Session = Depends(get_db)
):
    b = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    return b

@router.post("", response_model=BeneficiaryOut, status_code=status.HTTP_201_CREATED)
def create_beneficiary(
    payload: BeneficiaryCreate,
    current_user: User = Depends(require_permission("beneficiaries.create")),
    db: Session = Depends(get_db)
):
    # Concurrency safe automatic ID generation
    bid = get_next_beneficiary_id(db)

    b = Beneficiary(
        beneficiary_id=bid,
        name=payload.name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        address=payload.address.strip() if payload.address else None,
        registration_date=payload.registration_date,
        status=payload.status,
        notes=payload.notes.strip() if payload.notes else None
    )
    db.add(b)
    db.commit()
    db.refresh(b)
    return b

@router.patch("/{beneficiary_id}", response_model=BeneficiaryOut)
def update_beneficiary(
    beneficiary_id: int,
    payload: BeneficiaryUpdate,
    current_user: User = Depends(require_permission("beneficiaries.update")),
    db: Session = Depends(get_db)
):
    b = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Beneficiary not found")

    if payload.name is not None:
        b.name = payload.name.strip()
    if payload.phone is not None:
        b.phone = payload.phone.strip() if payload.phone else None
    if payload.address is not None:
        b.address = payload.address.strip() if payload.address else None
    if payload.registration_date is not None:
        b.registration_date = payload.registration_date
    if payload.status is not None:
        b.status = payload.status
    if payload.notes is not None:
        b.notes = payload.notes.strip() if payload.notes else None

    db.commit()
    db.refresh(b)
    return b

@router.post("/{beneficiary_id}/activate", response_model=BeneficiaryOut)
def activate_beneficiary(
    beneficiary_id: int,
    current_user: User = Depends(require_permission("beneficiaries.activate")),
    db: Session = Depends(get_db)
):
    b = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    b.status = "Active"
    db.commit()
    db.refresh(b)
    return b

@router.post("/{beneficiary_id}/deactivate", response_model=BeneficiaryOut)
def deactivate_beneficiary(
    beneficiary_id: int,
    current_user: User = Depends(require_permission("beneficiaries.deactivate")),
    db: Session = Depends(get_db)
):
    b = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Beneficiary not found")
    b.status = "Inactive"
    db.commit()
    db.refresh(b)
    return b

@router.get("/{beneficiary_id}/ledger", response_model=BeneficiaryLedgerSummary)
def get_beneficiary_ledger(
    beneficiary_id: int,
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    transaction_type: Optional[str] = Query(None, description="Received or Disbursed"),
    q: Optional[str] = Query(None, description="Search description or reference"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission("beneficiary_ledger.view")),
    db: Session = Depends(get_db)
):
    b = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Beneficiary not found")

    # Fetch ALL transactions chronologically for running balance calculation
    all_txs = db.query(BeneficiaryLedger).filter(
        BeneficiaryLedger.beneficiary_id == beneficiary_id
    ).order_by(BeneficiaryLedger.transaction_date.asc(), BeneficiaryLedger.id.asc()).all()

    # Calculate deterministic chronological running balance for every transaction
    total_received = Decimal("0.00")
    total_disbursed = Decimal("0.00")
    running_balance = Decimal("0.00")

    annotated_entries = []
    for tx in all_txs:
        amt = Decimal(str(tx.amount))
        if tx.transaction_type == "Received":
            total_received += amt
            running_balance += amt
        elif tx.transaction_type in ("Disbursed", "Assistance"):
            total_disbursed += amt
            running_balance -= amt

        entry = BeneficiaryLedgerEntryOut(
            id=tx.id,
            reference=tx.reference,
            transaction_date=tx.transaction_date,
            transaction_type=tx.transaction_type,
            amount=amt,
            description=tx.description,
            created_by=tx.created_by,
            created_at=tx.created_at,
            running_balance=running_balance
        )
        annotated_entries.append(entry)

    # Now apply filters to displayed results
    filtered_entries = annotated_entries
    if start_date:
        try:
            s_dt = datetime.strptime(start_date, "%Y-%m-%d")
            filtered_entries = [e for e in filtered_entries if e.transaction_date.replace(tzinfo=None) >= s_dt]
        except ValueError:
            pass
    if end_date:
        try:
            e_dt = datetime.strptime(f"{end_date} 23:59:59", "%Y-%m-%d %H:%M:%S")
            filtered_entries = [e for e in filtered_entries if e.transaction_date.replace(tzinfo=None) <= e_dt]
        except ValueError:
            pass
    if transaction_type:
        filtered_entries = [e for e in filtered_entries if e.transaction_type.lower() == transaction_type.lower()]
    if q:
        query_str = q.lower()
        filtered_entries = [
            e for e in filtered_entries
            if (e.reference and query_str in e.reference.lower()) or (e.description and query_str in e.description.lower())
        ]

    # Deterministic reverse chronological presentation for the ledger view
    reversed_filtered = list(reversed(filtered_entries))
    total_count = len(reversed_filtered)
    offset = (page - 1) * limit
    paginated_entries = reversed_filtered[offset:offset + limit]

    return BeneficiaryLedgerSummary(
        beneficiary=BeneficiaryOut.from_orm(b),
        total_received=total_received,
        total_disbursed=total_disbursed,
        current_balance=running_balance,
        entries=paginated_entries,
        total_count=total_count
    )

@router.post("/{beneficiary_id}/ledger", status_code=status.HTTP_201_CREATED)
def record_beneficiary_ledger_entry(
    beneficiary_id: int,
    transaction_type: str = Query(..., pattern="^(Received|Disbursed)$"),
    amount: Decimal = Query(..., gt=0),
    description: Optional[str] = None,
    current_user: User = Depends(require_permission("beneficiary_ledger.view")),
    db: Session = Depends(get_db)
):
    b = db.query(Beneficiary).filter(Beneficiary.id == beneficiary_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Beneficiary not found")

    ref = f"BLX-{int(datetime.utcnow().timestamp())}-{uuid.uuid4().hex[:6].upper()}"
    entry = BeneficiaryLedger(
        reference=ref,
        beneficiary_id=beneficiary_id,
        transaction_date=datetime.utcnow(),
        transaction_type=transaction_type,
        amount=amount,
        description=description,
        created_by=current_user.full_name
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry
