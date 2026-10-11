from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import text, or_
from typing import Optional, List
from datetime import datetime

from backend.app.database import get_db
from backend.app.models import Member, Group, User
from backend.app.schemas import (
    MemberCreate,
    MemberUpdate,
    MemberOut,
    MemberDueItem
)
from backend.app.security import get_current_user, require_permission

router = APIRouter(prefix="/api/members", tags=["members"])

def get_next_member_id(db: Session) -> str:
    # Atomic sequence generation
    res = db.execute(text("SELECT nextval('member_id_seq')")).scalar()
    mid = f"M-{int(res):04d}"
    while db.query(Member).filter(Member.member_id == mid).first() is not None:
        res = db.execute(text("SELECT nextval('member_id_seq')")).scalar()
        mid = f"M-{int(res):04d}"
    return mid

@router.get("", response_model=dict)
def list_members(
    q: Optional[str] = Query(None, description="Search by Member ID or Name"),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status (Active/Inactive)"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_permission("members.view")),
    db: Session = Depends(get_db)
):
    query = db.query(Member).join(Group, Member.group_id == Group.id)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(or_(Member.name.ilike(search_pattern), Member.member_id.ilike(search_pattern)))
    if group_id:
        query = query.filter(Member.group_id == group_id)
    if status_filter:
        query = query.filter(Member.status == status_filter)

    total_count = query.count()
    offset = (page - 1) * limit
    members = query.order_by(Member.id.desc()).offset(offset).limit(limit).all()

    items = []
    for m in members:
        items.append(MemberOut(
            id=m.id,
            member_id=m.member_id,
            name=m.name,
            group_id=m.group_id,
            group_name=m.group.name if m.group else None,
            group_code=m.group.code if m.group else None,
            phone=m.phone,
            email=m.email,
            address=m.address,
            joining_date=m.joining_date,
            status=m.status,
            notes=m.notes,
            created_at=m.created_at,
            updated_at=m.updated_at
        ))

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1
    }

@router.get("/due-list", response_model=dict)
def get_member_due_list(
    q: Optional[str] = Query(None, description="Search by Member ID or Name"),
    group_id: Optional[int] = Query(None, description="Filter by group ID"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    current_user: User = Depends(require_permission("members.due_list.view")),
    db: Session = Depends(get_db)
):
    """
    Displays members for dues management.
    Financial integrity rule: Does not invent dues or sample numbers.
    Clearly indicates that actual due amounts will be available once contribution ledger is integrated.
    """
    query = db.query(Member).join(Group, Member.group_id == Group.id)
    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(or_(Member.name.ilike(search_pattern), Member.member_id.ilike(search_pattern)))
    if group_id:
        query = query.filter(Member.group_id == group_id)

    total_count = query.count()
    offset = (page - 1) * limit
    members = query.order_by(Member.member_id.asc()).offset(offset).limit(limit).all()

    items = []
    for m in members:
        items.append(MemberDueItem(
            id=m.id,
            member_id=m.member_id,
            name=m.name,
            group_name=m.group.name if m.group else "Unknown",
            group_code=m.group.code if m.group else "Unknown",
            status=m.status,
            due_amount=None,  # No fabricated data!
            has_ledger=False,
            note="Member dues will be calculated once the contribution and dues modules are implemented."
        ))

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "limit": limit,
        "total_pages": (total_count + limit - 1) // limit if total_count > 0 else 1,
        "module_status": "Contribution/dues ledger not yet implemented. Financial dues cannot be fabricated."
    }

@router.get("/{member_id}", response_model=MemberOut)
def get_member(
    member_id: int,
    current_user: User = Depends(require_permission("members.view")),
    db: Session = Depends(get_db)
):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    return MemberOut(
        id=member.id,
        member_id=member.member_id,
        name=member.name,
        group_id=member.group_id,
        group_name=member.group.name if member.group else None,
        group_code=member.group.code if member.group else None,
        phone=member.phone,
        email=member.email,
        address=member.address,
        joining_date=member.joining_date,
        status=member.status,
        notes=member.notes,
        created_at=member.created_at,
        updated_at=member.updated_at
    )

@router.post("", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def create_member(
    payload: MemberCreate,
    current_user: User = Depends(require_permission("members.create")),
    db: Session = Depends(get_db)
):
    # Validate group existence and active status
    group = db.query(Group).filter(Group.id == payload.group_id).first()
    if not group:
        raise HTTPException(status_code=400, detail="Selected group does not exist")
    if group.status != "Active":
        raise HTTPException(status_code=400, detail=f"Cannot assign member to an inactive group ('{group.name}')")

    # Generate sequential unique Member ID atomically
    generated_id = get_next_member_id(db)

    member = Member(
        member_id=generated_id,
        name=payload.name.strip(),
        group_id=payload.group_id,
        phone=payload.phone.strip() if payload.phone else None,
        email=payload.email.strip() if payload.email else None,
        address=payload.address.strip() if payload.address else None,
        joining_date=payload.joining_date,
        notes=payload.notes.strip() if payload.notes else None,
        status=payload.status
    )
    db.add(member)
    db.commit()
    db.refresh(member)

    return MemberOut(
        id=member.id,
        member_id=member.member_id,
        name=member.name,
        group_id=member.group_id,
        group_name=group.name,
        group_code=group.code,
        phone=member.phone,
        email=member.email,
        address=member.address,
        joining_date=member.joining_date,
        status=member.status,
        notes=member.notes,
        created_at=member.created_at,
        updated_at=member.updated_at
    )

@router.patch("/{member_id}", response_model=MemberOut)
def update_member(
    member_id: int,
    payload: MemberUpdate,
    current_user: User = Depends(require_permission("members.update")),
    db: Session = Depends(get_db)
):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if payload.group_id is not None:
        group = db.query(Group).filter(Group.id == payload.group_id).first()
        if not group:
            raise HTTPException(status_code=400, detail="Target group does not exist")
        if group.status != "Active":
            raise HTTPException(status_code=400, detail=f"Cannot transfer member to inactive group ('{group.name}')")
        member.group_id = payload.group_id

    if payload.name is not None:
        member.name = payload.name.strip()
    if payload.phone is not None:
        member.phone = payload.phone.strip() if payload.phone else None
    if payload.email is not None:
        member.email = payload.email.strip() if payload.email else None
    if payload.address is not None:
        member.address = payload.address.strip() if payload.address else None
    if payload.joining_date is not None:
        member.joining_date = payload.joining_date
    if payload.notes is not None:
        member.notes = payload.notes.strip() if payload.notes else None
    if payload.status is not None:
        member.status = payload.status

    db.commit()
    db.refresh(member)

    return MemberOut(
        id=member.id,
        member_id=member.member_id,
        name=member.name,
        group_id=member.group_id,
        group_name=member.group.name if member.group else None,
        group_code=member.group.code if member.group else None,
        phone=member.phone,
        email=member.email,
        address=member.address,
        joining_date=member.joining_date,
        status=member.status,
        notes=member.notes,
        created_at=member.created_at,
        updated_at=member.updated_at
    )

@router.post("/{member_id}/activate", response_model=MemberOut)
def activate_member(
    member_id: int,
    current_user: User = Depends(require_permission("members.activate")),
    db: Session = Depends(get_db)
):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.status = "Active"
    db.commit()
    db.refresh(member)
    return MemberOut(
        id=member.id,
        member_id=member.member_id,
        name=member.name,
        group_id=member.group_id,
        group_name=member.group.name if member.group else None,
        group_code=member.group.code if member.group else None,
        phone=member.phone,
        email=member.email,
        address=member.address,
        joining_date=member.joining_date,
        status=member.status,
        notes=member.notes,
        created_at=member.created_at,
        updated_at=member.updated_at
    )

@router.post("/{member_id}/deactivate", response_model=MemberOut)
def deactivate_member(
    member_id: int,
    current_user: User = Depends(require_permission("members.deactivate")),
    db: Session = Depends(get_db)
):
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    member.status = "Inactive"
    db.commit()
    db.refresh(member)
    return MemberOut(
        id=member.id,
        member_id=member.member_id,
        name=member.name,
        group_id=member.group_id,
        group_name=member.group.name if member.group else None,
        group_code=member.group.code if member.group else None,
        phone=member.phone,
        email=member.email,
        address=member.address,
        joining_date=member.joining_date,
        status=member.status,
        notes=member.notes,
        created_at=member.created_at,
        updated_at=member.updated_at
    )
