from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from backend.app.database import get_db
from backend.app.models import User, Role, Permission, role_permissions
from backend.app.schemas import UserOut, RoleOut, PermissionOut, RolePermissionUpdate
from backend.app.security import get_current_user, get_user_permissions, require_permission

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    perms = get_user_permissions(current_user)
    return UserOut(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        full_name=current_user.full_name,
        role_id=current_user.role_id,
        role_name=current_user.role.name if current_user.role else None,
        permissions=perms
    )

@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db)):
    users = db.query(User).all()
    results = []
    for u in users:
        perms = get_user_permissions(u)
        results.append(UserOut(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            role_id=u.role_id,
            role_name=u.role.name if u.role else None,
            permissions=perms
        ))
    return results

@router.get("/permissions", response_model=List[PermissionOut])
def list_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    return db.query(Permission).order_by(Permission.module, Permission.code).all()

@router.get("/roles", response_model=List[RoleOut])
def list_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    roles = db.query(Role).all()
    results = []
    for r in roles:
        perms = [p.code for p in r.permissions]
        results.append(RoleOut(
            id=r.id,
            name=r.name,
            description=r.description,
            permissions=perms
        ))
    return results

@router.put("/roles/{role_id}/permissions", response_model=RoleOut)
def update_role_permissions(
    role_id: int,
    payload: RolePermissionUpdate,
    current_user: User = Depends(require_permission("roles.manage")),
    db: Session = Depends(get_db)
):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    perms = db.query(Permission).filter(Permission.code.in_(payload.permission_codes)).all()
    role.permissions = perms
    db.commit()
    db.refresh(role)

    return RoleOut(
        id=role.id,
        name=role.name,
        description=role.description,
        permissions=[p.code for p in role.permissions]
    )
