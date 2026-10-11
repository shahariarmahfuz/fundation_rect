from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from backend.app.database import get_db
from backend.app.models import User, Role, Permission

def get_current_user(
    x_user: Optional[str] = Header(None, alias="X-User"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    db: Session = Depends(get_db)
) -> User:
    """
    Retrieves the current user. For simplicity and testability across frontend and tests:
    - If 'X-User' header is provided (e.g. 'admin', 'officer', 'finance', 'viewer'), load that user.
    - If 'Authorization: Bearer <username>' is provided, parse username.
    - Defaults to 'admin' so the app is accessible out of the box, while strictly respecting any switcher/header.
    """
    username = "admin"
    if x_user:
        username = x_user.strip()
    elif authorization and authorization.startswith("Bearer "):
        token = authorization[len("Bearer "):].strip()
        if token:
            username = token

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User '{username}' not authenticated"
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated"
        )
    return user

def get_user_permissions(user: User) -> List[str]:
    if not user.role:
        return []
    return [p.code for p in user.role.permissions]

def require_permission(permission_code: str):
    def dependency(
        current_user: User = Depends(get_current_user)
    ) -> User:
        user_perms = get_user_permissions(current_user)
        if permission_code not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: Missing required permission '{permission_code}'"
            )
        return current_user
    return dependency
