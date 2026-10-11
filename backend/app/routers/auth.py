from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session
from typing import List

from backend.app.database import get_db
from backend.app.models import User, Role, Permission
from backend.app.schemas import (
    UserOut,
    RoleOut,
    PermissionOut,
    RolePermissionUpdate,
    LoginRequest,
    LoginResponse,
)
from backend.app.security import (
    get_current_user,
    get_user_permissions,
    require_permission,
    verify_password,
    create_access_token,
)
from backend.app.config import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """
    Authenticate against persisted database records using Argon2id.
    Issues a signed JWT in an HttpOnly session cookie and response body.
    """
    user = db.query(User).filter(User.username == payload.username.strip()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )

    token = create_access_token({"sub": user.username, "user_id": user.id})

    # Set secure HttpOnly cookie for session management
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,  # Set to True on strict HTTPS environments; false allows local/tunnel testing
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/"
    )

    perms = get_user_permissions(user)
    user_out = UserOut(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        role_id=user.role_id,
        role_name=user.role.name if user.role else None,
        permissions=perms
    )

    return LoginResponse(
        access_token=token,
        token_type="bearer",
        user=user_out
    )

@router.post("/logout")
def logout(response: Response):
    """Clear session cookie and invalidate active session."""
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    """Return currently authenticated user information and permissions."""
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
def list_users(
    current_user: User = Depends(require_permission("roles.manage")),
    db: Session = Depends(get_db)
):
    """List registered users. Protected by roles.manage permission."""
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
