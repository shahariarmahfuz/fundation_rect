import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import FoundationSetting, MediaAsset, FoundationPost
from backend.app.services.cloudinary_service import (
    validate_image_file,
    upload_image,
    delete_image,
    InvalidFileError,
    CloudinaryNotConfiguredError,
    get_folder_for_purpose,
)

client = TestClient(app)

ADMIN_HEADERS = {"X-User": "admin"}
VIEWER_HEADERS = {"X-User": "viewer"}

DUMMY_PNG = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
SAFE_SVG = b'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" fill="green"/></svg>'
MALICIOUS_SVG = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert("xss")</script><rect width="100" height="100"/></svg>'

# ==============================================================================
# 1. Validation and Service Unit Tests
# ==============================================================================

def test_validate_allowed_formats():
    """Verify PNG, JPG, WebP, and safe SVG are valid."""
    validate_image_file(DUMMY_PNG, "test.png", "image/png")
    validate_image_file(b"fake-jpg", "photo.jpg", "image/jpeg")
    validate_image_file(b"fake-webp", "image.webp", "image/webp")
    validate_image_file(SAFE_SVG, "vector.svg", "image/svg+xml")

def test_validate_disallowed_formats():
    """Verify disallowed extensions raise InvalidFileError."""
    with pytest.raises(InvalidFileError, match="not permitted"):
        validate_image_file(b"content", "doc.pdf", "application/pdf")
    with pytest.raises(InvalidFileError, match="not permitted"):
        validate_image_file(b"binary", "executable.exe", "application/octet-stream")

def test_validate_empty_file():
    """Verify empty content is rejected."""
    with pytest.raises(InvalidFileError, match="empty"):
        validate_image_file(b"", "empty.png", "image/png")

def test_validate_oversized_file():
    """Verify files > 5MB are rejected."""
    big_content = b"x" * (5 * 1024 * 1024 + 10)
    with pytest.raises(InvalidFileError, match="maximum allowed limit"):
        validate_image_file(big_content, "big.png", "image/png")

def test_validate_malicious_svg_sanitization():
    """Verify SVG files with script tags are caught and rejected."""
    with pytest.raises(InvalidFileError, match="unsafe executable or script elements"):
        validate_image_file(MALICIOUS_SVG, "danger.svg", "image/svg+xml")

def test_folder_purpose_mapping():
    """Verify purpose strings map to segregated Cloudinary folders."""
    assert get_folder_for_purpose("foundation_logo") == "foundation-management/foundation"
    assert get_folder_for_purpose("post_featured_image") == "foundation-management/posts"
    assert get_folder_for_purpose("general") == "foundation-management/uploads"

def test_upload_image_unconfigured_error():
    """Verify uploading without Cloudinary configured raises CloudinaryNotConfiguredError."""
    with patch("backend.app.config.settings.CLOUDINARY_CLOUD_NAME", None):
        with pytest.raises(CloudinaryNotConfiguredError, match="not configured"):
            upload_image(DUMMY_PNG, "test.png", "image/png")

def test_mocked_cloudinary_upload_success():
    """Verify upload_image returns standardized metadata when Cloudinary is configured."""
    mock_response = {
        "public_id": "foundation-management/foundation/foundation_logo_12345_abc",
        "secure_url": "https://res.cloudinary.com/demo/image/upload/v12345/foundation_logo.png",
        "format": "png",
        "bytes": len(DUMMY_PNG),
        "width": 100,
        "height": 100,
    }
    with patch("backend.app.config.settings.CLOUDINARY_CLOUD_NAME", "my_cloud"), \
         patch("backend.app.config.settings.CLOUDINARY_API_KEY", "123456"), \
         patch("backend.app.config.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.uploader.upload", return_value=mock_response):
        res = upload_image(DUMMY_PNG, "logo.png", "image/png", purpose="foundation_logo")
        assert res["public_id"] == mock_response["public_id"]
        assert res["secure_url"] == mock_response["secure_url"]
        assert res["format"] == "png"
        assert res["folder"] == "foundation-management/foundation"
        assert res["purpose"] == "foundation_logo"

# ==============================================================================
# 2. Media API Endpoints Tests
# ==============================================================================

def test_media_status_endpoint():
    """Verify GET /api/media/status returns configuration state and hides secrets."""
    res = client.get("/api/media/status")
    assert res.status_code == 200
    data = res.json()
    assert "configured" in data
    assert "cloud_name" in data
    # Secret must never be in response
    assert "api_secret" not in data
    assert "CLOUDINARY_API_SECRET" not in data

def test_upload_endpoint_unauthenticated():
    """Verify POST /api/media/upload rejects unauthenticated requests with 401."""
    res = client.post("/api/media/upload", files={"file": ("test.png", DUMMY_PNG, "image/png")})
    assert res.status_code == 401

def test_upload_endpoint_viewer_forbidden():
    """Verify user without media.upload permission gets 403 Forbidden."""
    res = client.post(
        "/api/media/upload",
        files={"file": ("test.png", DUMMY_PNG, "image/png")},
        headers=VIEWER_HEADERS
    )
    assert res.status_code == 403

def test_upload_endpoint_unconfigured_503():
    """Verify upload returns HTTP 503 when Cloudinary credentials are not configured."""
    with patch("backend.app.config.settings.CLOUDINARY_CLOUD_NAME", None):
        res = client.post(
            "/api/media/upload",
            files={"file": ("test.png", DUMMY_PNG, "image/png")},
            data={"purpose": "foundation_logo"},
            headers=ADMIN_HEADERS
        )
        assert res.status_code == 503
        assert "not configured" in res.json()["detail"]

def test_upload_endpoint_success_with_mock():
    """Verify upload succeeds, saves in media_assets, and returns asset metadata."""
    mock_res = {
        "public_id": "foundation-management/foundation/test_logo_123",
        "secure_url": "https://res.cloudinary.com/test/image/upload/v1/test_logo.png",
        "format": "png",
        "bytes": len(DUMMY_PNG),
        "width": 200,
        "height": 200,
    }
    with patch("backend.app.config.settings.CLOUDINARY_CLOUD_NAME", "my_cloud"), \
         patch("backend.app.config.settings.CLOUDINARY_API_KEY", "123456"), \
         patch("backend.app.config.settings.CLOUDINARY_API_SECRET", "secret"), \
         patch("cloudinary.uploader.upload", return_value=mock_res):
        res = client.post(
            "/api/media/upload",
            files={"file": ("test.png", DUMMY_PNG, "image/png")},
            data={"purpose": "foundation_logo"},
            headers=ADMIN_HEADERS
        )
        assert res.status_code == 200
        data = res.json()
        assert data["public_id"] == mock_res["public_id"]
        assert data["secure_url"] == mock_res["secure_url"]
        assert data["folder"] == "foundation-management/foundation"

        # Verify asset was created in database
        db = SessionLocal()
        try:
            asset = db.query(MediaAsset).filter(MediaAsset.public_id == mock_res["public_id"]).first()
            assert asset is not None
            assert asset.secure_url == mock_res["secure_url"]
            assert asset.purpose == "foundation_logo"
        finally:
            db.close()

def test_delete_in_use_image_prevented():
    """Verify image currently in use as foundation logo cannot be deleted."""
    db = SessionLocal()
    test_public_id = "foundation-management/foundation/active_logo_id"
    try:
        setting = db.query(FoundationSetting).first()
        setting.foundation_logo_public_id = test_public_id
        db.commit()

        with patch("backend.app.config.settings.CLOUDINARY_CLOUD_NAME", "my_cloud"), \
             patch("backend.app.config.settings.CLOUDINARY_API_KEY", "123456"), \
             patch("backend.app.config.settings.CLOUDINARY_API_SECRET", "secret"):
            res = client.delete(f"/api/media/{test_public_id}", headers=ADMIN_HEADERS)
            assert res.status_code == 400
            assert "currently in use" in res.json()["detail"]
    finally:
        setting.foundation_logo_public_id = None
        db.commit()
        db.close()

def test_delete_media_asset_success():
    """Verify unused asset can be safely deleted from Cloudinary and database."""
    db = SessionLocal()
    unused_public_id = "foundation-management/uploads/temp_to_delete_999"
    try:
        # Create a media asset record
        asset = MediaAsset(
            public_id=unused_public_id,
            secure_url="https://res.cloudinary.com/test/temp.png",
            folder="foundation-management/uploads",
            format="png",
            bytes=100,
            purpose="general"
        )
        db.add(asset)
        db.commit()

        with patch("backend.app.config.settings.CLOUDINARY_CLOUD_NAME", "my_cloud"), \
             patch("backend.app.config.settings.CLOUDINARY_API_KEY", "123456"), \
             patch("backend.app.config.settings.CLOUDINARY_API_SECRET", "secret"), \
             patch("cloudinary.uploader.destroy", return_value={"result": "ok"}):
            res = client.delete(f"/api/media/{unused_public_id}", headers=ADMIN_HEADERS)
            assert res.status_code == 200
            assert res.json()["cloudinary_result"] == "ok"

            # Check deleted from DB
            db.expire_all()
            found = db.query(MediaAsset).filter(MediaAsset.public_id == unused_public_id).first()
            assert found is None
    finally:
        db.close()

# ==============================================================================
# 3. Foundation Posts API Tests
# ==============================================================================

def test_foundation_posts_crud():
    """Verify foundation posts CRUD endpoints with RBAC and featured image metadata."""
    # 1. Create post
    post_payload = {
        "title": "Annual Community Winter Relief Drive",
        "content": "We are distributing warm clothing and food packages across 10 districts.",
        "featured_image_url": "https://res.cloudinary.com/demo/posts/winter.jpg",
        "featured_image_public_id": "foundation-management/posts/winter_123",
        "status": "published"
    }
    create_res = client.post("/api/posts", json=post_payload, headers=ADMIN_HEADERS)
    assert create_res.status_code == 201
    created_post = create_res.json()
    post_id = created_post["id"]
    assert created_post["title"] == post_payload["title"]
    assert created_post["featured_image_public_id"] == post_payload["featured_image_public_id"]

    # 2. Fetch post
    get_res = client.get(f"/api/posts/{post_id}", headers=ADMIN_HEADERS)
    assert get_res.status_code == 200
    assert get_res.json()["status"] == "published"

    # 3. List posts
    list_res = client.get("/api/posts", headers=ADMIN_HEADERS)
    assert list_res.status_code == 200
    assert any(p["id"] == post_id for p in list_res.json())

    # 4. Update post
    update_res = client.put(
        f"/api/posts/{post_id}",
        json={"title": "Updated Winter Drive 2026"},
        headers=ADMIN_HEADERS
    )
    assert update_res.status_code == 200
    assert update_res.json()["title"] == "Updated Winter Drive 2026"

    # 5. Prevent deleting image while used in post
    with patch("backend.app.config.settings.CLOUDINARY_CLOUD_NAME", "my_cloud"), \
         patch("backend.app.config.settings.CLOUDINARY_API_KEY", "123456"), \
         patch("backend.app.config.settings.CLOUDINARY_API_SECRET", "secret"):
        del_img_res = client.delete(
            f"/api/media/{post_payload['featured_image_public_id']}",
            headers=ADMIN_HEADERS
        )
        assert del_img_res.status_code == 400
        assert "currently in use in Foundation Posts" in del_img_res.json()["detail"]

    # 6. Delete post
    del_res = client.delete(f"/api/posts/{post_id}", headers=ADMIN_HEADERS)
    assert del_res.status_code == 200

# ==============================================================================
# 4. Settings Logo Persistence Tests
# ==============================================================================

def test_settings_logo_persistence():
    """Verify settings patch persists foundation_logo and foundation_logo_public_id."""
    logo_url = "https://res.cloudinary.com/test/image/upload/v1/foundation-logo-2026.png"
    logo_public_id = "foundation-management/foundation/logo_2026_xyz"

    patch_res = client.patch(
        "/api/settings/foundation",
        json={
            "foundation_name": "Al-Barakah Welfare Foundation",
            "foundation_logo": logo_url,
            "foundation_logo_public_id": logo_public_id,
        },
        headers=ADMIN_HEADERS
    )
    assert patch_res.status_code == 200
    data = patch_res.json()
    assert data["foundation_logo"] == logo_url
    assert data["foundation_logo_public_id"] == logo_public_id

    # Verify public settings exposes both
    pub_res = client.get("/api/settings/public")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["foundation_logo"] == logo_url
    assert pub_data["foundation_logo_public_id"] == logo_public_id
