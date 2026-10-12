import os
import shutil
import uuid
from decimal import Decimal
from datetime import datetime, date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models import FoundationSetting, ContributionSetting, User
from backend.app.schemas import (
    PublicSettingsOut,
    FoundationProfileUpdate,
    FinancialSettingsUpdate,
    IdPrefixSettingsUpdate,
    OrganizationSettingsUpdate,
    ContributionSettingFullUpdate,
    ContributionSettingOut,
    ChangePasswordRequest,
    FullSettingsOut,
)
from backend.app.security import (
    get_current_user,
    require_permission,
    verify_password,
    hash_password,
)

router = APIRouter(prefix="/api/settings", tags=["settings"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "public", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def get_or_create_foundation_settings(db: Session) -> FoundationSetting:
    setting = db.query(FoundationSetting).filter(FoundationSetting.id == 1).first()
    if not setting:
        setting = db.query(FoundationSetting).first()
    if not setting:
        setting = FoundationSetting(
            id=1,
            foundation_name="Al-Barakah Welfare Foundation",
            foundation_short_name="ABWF",
            tagline="Empowering Communities, Transforming Lives",
            registration_number="REG-2024-8971B",
            email="info@albarakah-foundation.org",
            phone="+880 1711-000000",
            address="House 42, Road 11, Dhanmondi",
            city="Dhaka",
            postal_code="1209",
            country="Bangladesh",
            website_url="https://albarakah-foundation.org",
            currency_code="BDT",
            currency_symbol="৳",
            decimal_precision=2,
            date_format="YYYY-MM-DD",
            payment_methods="Cash,Bank Transfer,Card,Mobile Money,Cheque",
            fiscal_year_start_month=1,
            require_transaction_reference=False,
            group_prefix="G-",
            member_prefix="M-",
            beneficiary_prefix="B-",
            donation_prefix="D-",
            sadaqah_prefix="S-",
            qard_hasan_prefix="QH-",
            contribution_prefix="MC-",
            default_member_status="Active",
            default_group_status="Active",
            app_display_name="Foundation Management System",
            default_language="en",
            time_zone="Asia/Dhaka",
            receipt_footer_text="Thank you for your generous contribution. May Allah accept your righteous deeds.",
            report_header_text="Official Financial & Operational Audit Report",
            report_footer_text="Confidential — For Internal and Trustee Use Only",
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting

def get_or_create_contribution_setting(db: Session) -> ContributionSetting:
    setting = db.query(ContributionSetting).order_by(ContributionSetting.id.desc()).first()
    if not setting:
        setting = ContributionSetting(
            monthly_amount=Decimal("500.00"),
            currency="BDT",
            effective_from=date(2024, 1, 1),
            is_collection_enabled=True,
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    return setting

def build_full_settings_out(setting: FoundationSetting, contrib: ContributionSetting) -> FullSettingsOut:
    contrib_out = None
    if contrib:
        contrib_out = ContributionSettingOut(
            id=contrib.id,
            monthly_amount=contrib.monthly_amount,
            currency=contrib.currency,
            effective_from=contrib.effective_from,
            is_collection_enabled=getattr(contrib, "is_collection_enabled", True),
            updated_by_id=contrib.updated_by_id,
            updated_by_name=contrib.updated_by.full_name if contrib.updated_by else None,
            created_at=contrib.created_at,
            updated_at=contrib.updated_at,
        )

    return FullSettingsOut(
        id=setting.id,
        foundation_name=setting.foundation_name,
        foundation_short_name=setting.foundation_short_name,
        foundation_logo=setting.foundation_logo,
        foundation_logo_public_id=setting.foundation_logo_public_id,
        tagline=setting.tagline,
        registration_number=setting.registration_number,
        email=setting.email,
        phone=setting.phone,
        phone_secondary=setting.phone_secondary,
        address=setting.address,
        city=setting.city,
        postal_code=setting.postal_code,
        country=setting.country,
        website_url=setting.website_url,
        about=setting.about,
        currency_code=setting.currency_code,
        currency_symbol=setting.currency_symbol,
        decimal_precision=setting.decimal_precision,
        date_format=setting.date_format,
        payment_methods=setting.payment_methods,
        fiscal_year_start_month=setting.fiscal_year_start_month,
        require_transaction_reference=setting.require_transaction_reference,
        group_prefix=setting.group_prefix,
        member_prefix=setting.member_prefix,
        beneficiary_prefix=setting.beneficiary_prefix,
        donation_prefix=setting.donation_prefix,
        sadaqah_prefix=setting.sadaqah_prefix,
        qard_hasan_prefix=setting.qard_hasan_prefix,
        contribution_prefix=setting.contribution_prefix,
        default_member_status=setting.default_member_status,
        default_group_status=setting.default_group_status,
        app_display_name=setting.app_display_name,
        default_language=setting.default_language,
        time_zone=setting.time_zone,
        receipt_footer_text=setting.receipt_footer_text,
        report_header_text=setting.report_header_text,
        report_footer_text=setting.report_footer_text,
        updated_by_id=setting.updated_by_id,
        updated_by_name=setting.updated_by.full_name if setting.updated_by else None,
        created_at=setting.created_at,
        updated_at=setting.updated_at,
        contribution_setting=contrib_out,
    )

# 1. Public Settings (No authentication required)
@router.get("/public", response_model=PublicSettingsOut)
def get_public_settings(db: Session = Depends(get_db)):
    setting = get_or_create_foundation_settings(db)
    contrib = get_or_create_contribution_setting(db)
    return PublicSettingsOut(
        foundation_name=setting.foundation_name,
        foundation_short_name=setting.foundation_short_name,
        foundation_logo=setting.foundation_logo,
        foundation_logo_public_id=setting.foundation_logo_public_id,
        tagline=setting.tagline,
        app_display_name=setting.app_display_name,
        currency_code=setting.currency_code,
        currency_symbol=setting.currency_symbol,
        date_format=setting.date_format,
        time_zone=setting.time_zone,
        default_language=setting.default_language,
        is_collection_enabled=getattr(contrib, "is_collection_enabled", True),
        monthly_amount=contrib.monthly_amount if contrib else None,
    )

# 2. Complete Settings (Requires settings.view)
@router.get("", response_model=FullSettingsOut)
def get_settings(
    current_user: User = Depends(require_permission("settings.view")),
    db: Session = Depends(get_db),
):
    setting = get_or_create_foundation_settings(db)
    contrib = get_or_create_contribution_setting(db)
    return build_full_settings_out(setting, contrib)

# 3. Foundation Profile Settings
@router.patch("/foundation", response_model=FullSettingsOut)
def update_foundation_profile(
    payload: FoundationProfileUpdate,
    current_user: User = Depends(require_permission("settings.foundation.update")),
    db: Session = Depends(get_db),
):
    setting = get_or_create_foundation_settings(db)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(setting, field, val)
    setting.updated_by_id = current_user.id
    db.commit()
    db.refresh(setting)

    contrib = get_or_create_contribution_setting(db)
    return build_full_settings_out(setting, contrib)

# 4. Contribution Settings
@router.patch("/contribution", response_model=FullSettingsOut)
def update_contribution_settings(
    payload: ContributionSettingFullUpdate,
    current_user: User = Depends(require_permission("settings.contributions.update")),
    db: Session = Depends(get_db),
):
    contrib = get_or_create_contribution_setting(db)
    contrib.monthly_amount = payload.monthly_amount
    if payload.currency:
        contrib.currency = payload.currency
    if payload.effective_from:
        contrib.effective_from = payload.effective_from
    contrib.is_collection_enabled = payload.is_collection_enabled
    contrib.updated_by_id = current_user.id
    db.commit()
    db.refresh(contrib)

    setting = get_or_create_foundation_settings(db)
    return build_full_settings_out(setting, contrib)

# 5. Financial Settings
@router.patch("/financial", response_model=FullSettingsOut)
def update_financial_settings(
    payload: FinancialSettingsUpdate,
    current_user: User = Depends(require_permission("settings.financial.update")),
    db: Session = Depends(get_db),
):
    setting = get_or_create_foundation_settings(db)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(setting, field, val)
    setting.updated_by_id = current_user.id
    db.commit()
    db.refresh(setting)

    contrib = get_or_create_contribution_setting(db)
    return build_full_settings_out(setting, contrib)

# 6. ID Prefix Settings
@router.patch("/ids", response_model=FullSettingsOut)
def update_id_prefix_settings(
    payload: IdPrefixSettingsUpdate,
    current_user: User = Depends(require_permission("settings.ids.update")),
    db: Session = Depends(get_db),
):
    setting = get_or_create_foundation_settings(db)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(setting, field, val)
    setting.updated_by_id = current_user.id
    db.commit()
    db.refresh(setting)

    contrib = get_or_create_contribution_setting(db)
    return build_full_settings_out(setting, contrib)

# 7. Organization & System Settings
@router.patch("/organization", response_model=FullSettingsOut)
def update_organization_settings(
    payload: OrganizationSettingsUpdate,
    current_user: User = Depends(require_permission("settings.organization.update")),
    db: Session = Depends(get_db),
):
    setting = get_or_create_foundation_settings(db)
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(setting, field, val)
    setting.updated_by_id = current_user.id
    db.commit()
    db.refresh(setting)

    contrib = get_or_create_contribution_setting(db)
    return build_full_settings_out(setting, contrib)

# 8. Logo Upload
@router.post("/logo-upload")
async def upload_foundation_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(require_permission("settings.foundation.update")),
    db: Session = Depends(get_db),
):
    ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".svg", ".webp"}
    filename = file.filename or "logo.png"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid file extension {ext}. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # 5MB max check
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum allowed size of 5MB."
        )

    # Check if Cloudinary is configured; if so, upload to Cloudinary
    from backend.app.config import settings as app_settings
    from backend.app.services.cloudinary_service import upload_image, CloudinaryNotConfiguredError

    setting = get_or_create_foundation_settings(db)

    if app_settings.is_cloudinary_configured:
        try:
            cloud_res = upload_image(
                file_bytes=contents,
                filename=filename,
                content_type=file.content_type,
                purpose="foundation_logo",
            )
            setting.foundation_logo = cloud_res["secure_url"]
            setting.foundation_logo_public_id = cloud_res["public_id"]
            setting.updated_by_id = current_user.id
            db.commit()
            db.refresh(setting)
            return {
                "logo_url": cloud_res["secure_url"],
                "public_id": cloud_res["public_id"],
                "message": "Logo uploaded to Cloudinary successfully"
            }
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Cloudinary upload failed: {str(e)}"
            )

    unique_filename = f"foundation-logo-{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    with open(file_path, "wb") as f:
        f.write(contents)

    logo_url = f"/uploads/{unique_filename}"
    setting.foundation_logo = logo_url
    setting.foundation_logo_public_id = None
    setting.updated_by_id = current_user.id
    db.commit()
    db.refresh(setting)

    return {"logo_url": logo_url, "public_id": None, "message": "Logo uploaded successfully"}

# 9. Change Password (For authenticated user)
@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect."
        )

    if payload.new_password != payload.confirm_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password and confirm password do not match."
        )

    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long."
        )

    current_user.password_hash = hash_password(payload.new_password)
    db.commit()

    return {"message": "Password updated successfully"}
