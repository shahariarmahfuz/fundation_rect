from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.config import settings
from backend.app.models import User, MediaAsset, FoundationSetting, FoundationPost
from backend.app.schemas import MediaUploadOut, MediaAssetOut, MediaStatusOut
from backend.app.security import get_current_user, require_permission
from backend.app.services.cloudinary_service import (
    upload_image,
    delete_image,
    CloudinaryNotConfiguredError,
    InvalidFileError,
)

router = APIRouter(prefix="/api/media", tags=["media"])

@router.get("/status", response_model=MediaStatusOut)
def get_media_status():
    """
    Returns the cloud storage service status.
    Never exposes API secrets or private credentials to the client.
    """
    return MediaStatusOut(
        configured=settings.is_cloudinary_configured,
        cloud_name=settings.CLOUDINARY_CLOUD_NAME if settings.is_cloudinary_configured else None
    )

@router.post("/upload", response_model=MediaUploadOut)
async def upload_media_asset(
    file: UploadFile = File(...),
    purpose: str = Form("general"),
    current_user: User = Depends(require_permission("media.upload")),
    db: Session = Depends(get_db),
):
    """
    Uploads an image asset to Cloudinary, validates type and size,
    persists asset metadata in the database, and returns asset details.
    """
    if not settings.is_cloudinary_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudinary service is not configured on the server."
        )

    contents = await file.read()
    try:
        data = upload_image(
            file_bytes=contents,
            filename=file.filename or "upload.png",
            content_type=file.content_type,
            purpose=purpose,
        )
    except CloudinaryNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except InvalidFileError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Upload failed: {str(e)}"
        )

    # Persist in media_assets ledger
    asset = MediaAsset(
        public_id=data["public_id"],
        secure_url=data["secure_url"],
        folder=data["folder"],
        format=data["format"],
        bytes=data["bytes"],
        width=data.get("width"),
        height=data.get("height"),
        purpose=purpose,
        uploaded_by_id=current_user.id,
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)

    return data

@router.delete("/{public_id:path}")
def delete_media_asset(
    public_id: str,
    current_user: User = Depends(require_permission("media.delete")),
    db: Session = Depends(get_db),
):
    """
    Safely deletes a media asset from Cloudinary and database ledger,
    preventing deletion of assets currently referenced by settings or posts.
    """
    if not settings.is_cloudinary_configured:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Cloudinary service is not configured on the server."
        )

    # 1. Lifecycle reference checks:
    # Check if used as foundation logo
    logo_ref = db.query(FoundationSetting).filter(
        FoundationSetting.foundation_logo_public_id == public_id
    ).first()
    if logo_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image is currently in use as the Foundation Logo and cannot be deleted."
        )

    # Check if used in posts
    post_ref = db.query(FoundationPost).filter(
        FoundationPost.featured_image_public_id == public_id
    ).first()
    if post_ref:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Image is currently in use in Foundation Posts and cannot be deleted."
        )

    # 2. Delete from Cloudinary
    try:
        cloudinary_res = delete_image(public_id)
    except CloudinaryNotConfiguredError as e:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Cloudinary deletion failed: {str(e)}"
        )

    # 3. Delete from media_assets table if exists
    asset = db.query(MediaAsset).filter(MediaAsset.public_id == public_id).first()
    if asset:
        db.delete(asset)
        db.commit()

    return {
        "message": "Image deleted successfully",
        "public_id": public_id,
        "cloudinary_result": cloudinary_res.get("result", "ok")
    }

@router.get("", response_model=List[MediaAssetOut])
def list_media_assets(
    purpose: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(require_permission("media.upload")),
    db: Session = Depends(get_db),
):
    """Lists media assets with optional purpose filtering and pagination."""
    query = db.query(MediaAsset)
    if purpose:
        query = query.filter(MediaAsset.purpose == purpose)
    return query.order_by(MediaAsset.created_at.desc()).offset(offset).limit(limit).all()
