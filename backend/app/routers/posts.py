from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import User, FoundationPost
from backend.app.schemas import FoundationPostCreate, FoundationPostUpdate, FoundationPostOut
from backend.app.security import get_current_user, require_permission

router = APIRouter(prefix="/api/posts", tags=["posts"])

@router.get("", response_model=List[FoundationPostOut])
def get_posts(
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_permission("foundation_posts.view")),
    db: Session = Depends(get_db),
):
    query = db.query(FoundationPost)
    if status_filter:
        query = query.filter(FoundationPost.status == status_filter)
    
    posts = query.order_by(FoundationPost.created_at.desc()).offset(offset).limit(limit).all()
    results = []
    for p in posts:
        out = FoundationPostOut(
            id=p.id,
            title=p.title,
            content=p.content,
            featured_image_url=p.featured_image_url,
            featured_image_public_id=p.featured_image_public_id,
            status=p.status,
            created_by_id=p.created_by_id,
            created_by_name=p.created_by.full_name if p.created_by else None,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )
        results.append(out)
    return results

@router.post("", response_model=FoundationPostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    payload: FoundationPostCreate,
    current_user: User = Depends(require_permission("foundation_posts.create")),
    db: Session = Depends(get_db),
):
    post = FoundationPost(
        title=payload.title,
        content=payload.content,
        featured_image_url=payload.featured_image_url,
        featured_image_public_id=payload.featured_image_public_id,
        status=payload.status or "draft",
        created_by_id=current_user.id,
    )
    db.add(post)
    db.commit()
    db.refresh(post)
    return FoundationPostOut(
        id=post.id,
        title=post.title,
        content=post.content,
        featured_image_url=post.featured_image_url,
        featured_image_public_id=post.featured_image_public_id,
        status=post.status,
        created_by_id=post.created_by_id,
        created_by_name=current_user.full_name,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )

@router.get("/{post_id}", response_model=FoundationPostOut)
def get_post(
    post_id: int,
    current_user: User = Depends(require_permission("foundation_posts.view")),
    db: Session = Depends(get_db),
):
    post = db.query(FoundationPost).filter(FoundationPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    return FoundationPostOut(
        id=post.id,
        title=post.title,
        content=post.content,
        featured_image_url=post.featured_image_url,
        featured_image_public_id=post.featured_image_public_id,
        status=post.status,
        created_by_id=post.created_by_id,
        created_by_name=post.created_by.full_name if post.created_by else None,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )

@router.put("/{post_id}", response_model=FoundationPostOut)
def update_post(
    post_id: int,
    payload: FoundationPostUpdate,
    current_user: User = Depends(require_permission("foundation_posts.update")),
    db: Session = Depends(get_db),
):
    post = db.query(FoundationPost).filter(FoundationPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, val)
    
    db.commit()
    db.refresh(post)
    return FoundationPostOut(
        id=post.id,
        title=post.title,
        content=post.content,
        featured_image_url=post.featured_image_url,
        featured_image_public_id=post.featured_image_public_id,
        status=post.status,
        created_by_id=post.created_by_id,
        created_by_name=post.created_by.full_name if post.created_by else None,
        created_at=post.created_at,
        updated_at=post.updated_at,
    )

@router.delete("/{post_id}")
def delete_post(
    post_id: int,
    current_user: User = Depends(require_permission("foundation_posts.create")),
    db: Session = Depends(get_db),
):
    post = db.query(FoundationPost).filter(FoundationPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    db.delete(post)
    db.commit()
    return {"message": "Post deleted successfully", "id": post_id}
