import pytest
import io
from fastapi.testclient import TestClient
from decimal import Decimal
from datetime import date
import uuid

from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import FoundationSetting, ContributionSetting, Group, Member, Donation, User
from backend.app.security import hash_password

client = TestClient(app)

ADMIN_HEADERS = {"X-User": "admin"}
FINANCE_HEADERS = {"X-User": "finance"}
VIEWER_HEADERS = {"X-User": "viewer"}

def test_public_settings_accessible_unauthenticated():
    """Verify that public settings endpoint requires no authentication and returns branding."""
    res = client.get("/api/settings/public")
    assert res.status_code == 200
    data = res.json()
    assert "foundation_name" in data
    assert "app_display_name" in data
    assert "currency_code" in data
    assert "currency_symbol" in data
    assert "is_collection_enabled" in data

def test_settings_access_unauthenticated_rejected():
    """Verify that private settings endpoint rejects unauthenticated requests."""
    res = client.get("/api/settings")
    assert res.status_code == 401

def test_settings_access_viewer_forbidden():
    """Verify that user without settings.view is denied access."""
    res = client.get("/api/settings", headers=VIEWER_HEADERS)
    assert res.status_code == 403

def test_settings_access_admin_authorized():
    """Verify that admin can fetch complete settings with audit metadata."""
    res = client.get("/api/settings", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == 1
    assert "foundation_name" in data
    assert "currency_code" in data
    assert "group_prefix" in data
    assert "contribution_setting" in data

def test_settings_access_finance_authorized():
    """Verify that finance officer can view settings (settings.view)."""
    res = client.get("/api/settings", headers=FINANCE_HEADERS)
    assert res.status_code == 200

def test_update_foundation_profile():
    """Verify updating foundation profile fields."""
    new_tagline = f"Transforming Lives Everywhere {uuid.uuid4().hex[:4]}"
    payload = {
        "foundation_name": "Al-Barakah Welfare Foundation",
        "foundation_short_name": "ABWF",
        "tagline": new_tagline,
        "email": "hq@albarakah-foundation.org",
        "phone": "+880 1711-999999",
        "city": "Dhaka",
        "country": "Bangladesh",
        "website_url": "https://albarakah-foundation.org"
    }
    res = client.patch("/api/settings/foundation", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["tagline"] == new_tagline
    assert data["email"] == "hq@albarakah-foundation.org"
    assert data["updated_by_name"] == "System Administrator"

def test_update_foundation_profile_viewer_forbidden():
    """Verify that users without settings.foundation.update cannot edit profile."""
    res = client.patch("/api/settings/foundation", json={"foundation_name": "Hack"}, headers=VIEWER_HEADERS)
    assert res.status_code == 403

def test_update_contribution_settings():
    """Verify updating contribution monthly amount and collection status."""
    payload = {
        "monthly_amount": 150.00,
        "currency": "BDT",
        "effective_from": "2026-10-01",
        "is_collection_enabled": True
    }
    res = client.patch("/api/settings/contribution", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["contribution_setting"]["monthly_amount"] == "150.00"
    assert data["contribution_setting"]["is_collection_enabled"] is True

    # Revert to default 100.00
    client.patch("/api/settings/contribution", json={"monthly_amount": 100.00, "is_collection_enabled": True}, headers=ADMIN_HEADERS)

def test_update_financial_settings():
    """Verify updating currency, precision, payment methods, and reference requirement."""
    payload = {
        "currency_code": "BDT",
        "currency_symbol": "৳",
        "decimal_precision": 2,
        "date_format": "YYYY-MM-DD",
        "payment_methods": "Cash,Bank Transfer,bKash,Nagad,Cheque",
        "fiscal_year_start_month": 1,
        "require_transaction_reference": True
    }
    res = client.patch("/api/settings/financial", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["payment_methods"] == "Cash,Bank Transfer,bKash,Nagad,Cheque"
    assert data["require_transaction_reference"] is True

    # Revert require_transaction_reference to False
    payload["require_transaction_reference"] = False
    client.patch("/api/settings/financial", json=payload, headers=ADMIN_HEADERS)

def test_update_id_prefixes_and_dynamic_generation():
    """Verify that updating prefixes dynamically governs newly generated IDs while preserving historical records."""
    unique_prefix = f"G{uuid.uuid4().hex[:2].upper()}-"
    payload = {
        "group_prefix": unique_prefix,
        "member_prefix": "M-",
        "beneficiary_prefix": "B-",
        "donation_prefix": "D-",
        "sadaqah_prefix": "S-",
        "qard_hasan_prefix": "QH-",
        "contribution_prefix": "MC-",
        "default_member_status": "Active",
        "default_group_status": "Active"
    }
    # 1. Update ID prefixes
    res = client.patch("/api/settings/ids", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 200
    assert res.json()["group_prefix"] == unique_prefix

    # 2. Create a group and verify the newly generated ID uses unique_prefix
    grp_res = client.post("/api/groups", json={
        "name": f"Prefix Test Group {uuid.uuid4().hex[:4]}",
        "description": "Testing prefix generation",
        "status": "Active"
    }, headers=ADMIN_HEADERS)
    assert grp_res.status_code == 201
    created_code = grp_res.json()["code"]
    assert created_code.startswith(unique_prefix)

    # 3. Revert prefix back to G-
    payload["group_prefix"] = "G-"
    client.patch("/api/settings/ids", json=payload, headers=ADMIN_HEADERS)

def test_update_organization_settings():
    """Verify updating display name, language, time zone, and receipt/report text."""
    payload = {
        "app_display_name": "Foundation Management System Pro",
        "default_language": "en",
        "time_zone": "Asia/Dhaka",
        "receipt_footer_text": "May Allah reward your generosity.",
        "report_header_text": "Confidential Foundation Ledger Audit",
        "report_footer_text": "Audited by System Administrator"
    }
    res = client.patch("/api/settings/organization", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert data["app_display_name"] == "Foundation Management System Pro"
    assert data["receipt_footer_text"] == "May Allah reward your generosity."

    # Revert display name
    payload["app_display_name"] = "Foundation Management System"
    client.patch("/api/settings/organization", json=payload, headers=ADMIN_HEADERS)

def test_logo_upload_validation_and_success():
    """Verify logo upload extension validation and valid upload persistence."""
    # Invalid extension
    bad_file = io.BytesIO(b"dummy executable content")
    res = client.post(
        "/api/settings/logo-upload",
        files={"file": ("malicious.exe", bad_file, "application/octet-stream")},
        headers=ADMIN_HEADERS
    )
    assert res.status_code == 400
    assert "Invalid file extension" in res.json()["detail"]

    # Valid PNG/SVG upload
    valid_file = io.BytesIO(b"<svg xmlns='http://www.w3.org/2000/svg'><rect width='50' height='50'/></svg>")
    res = client.post(
        "/api/settings/logo-upload",
        files={"file": ("test_logo.svg", valid_file, "image/svg+xml")},
        headers=ADMIN_HEADERS
    )
    assert res.status_code == 200
    data = res.json()
    assert "logo_url" in data
    assert data["logo_url"].startswith("/uploads/foundation-logo-")

def test_change_password_workflow():
    """Verify changing password requires correct current password and minimum length."""
    db = SessionLocal()
    try:
        user = db.query(User).filter_by(username="admin").first()
        # Set a known temporary password for admin
        user.password_hash = hash_password("TestTempPassword123!")
        db.commit()
    finally:
        db.close()

    # 1. Incorrect current password rejected
    res = client.post("/api/settings/change-password", json={
        "current_password": "WrongPassword!",
        "new_password": "NewSecretPass123!",
        "confirm_password": "NewSecretPass123!"
    }, headers=ADMIN_HEADERS)
    assert res.status_code == 400
    assert "Current password is incorrect" in res.json()["detail"]

    # 2. Mismatched confirmation rejected
    res = client.post("/api/settings/change-password", json={
        "current_password": "TestTempPassword123!",
        "new_password": "NewSecretPass123!",
        "confirm_password": "DifferentPass123!"
    }, headers=ADMIN_HEADERS)
    assert res.status_code == 400
    assert "do not match" in res.json()["detail"]

    # 3. Successful password change
    res = client.post("/api/settings/change-password", json={
        "current_password": "TestTempPassword123!",
        "new_password": "Admin@Foundation2026!",
        "confirm_password": "Admin@Foundation2026!"
    }, headers=ADMIN_HEADERS)
    assert res.status_code == 200
    assert "Password updated successfully" in res.json()["message"]
