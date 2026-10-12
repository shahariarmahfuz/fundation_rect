import os
import re
import uuid
import time
from typing import Optional, Dict, Any
import cloudinary
import cloudinary.uploader
from backend.app.config import settings

ALLOWED_MIME_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
}

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".svg"}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

FOLDER_PURPOSE_MAP = {
    "foundation_logo": "foundation-management/foundation",
    "post_featured_image": "foundation-management/posts",
    "general": "foundation-management/uploads",
}

class CloudinaryNotConfiguredError(Exception):
    """Raised when Cloudinary service credentials are not configured on the server."""
    pass

class InvalidFileError(Exception):
    """Raised when uploaded file violates type, size, or security constraints."""
    pass

def init_cloudinary():
    """Initializes the Cloudinary SDK if credentials are present."""
    if settings.is_cloudinary_configured:
        cloudinary.config(
            cloud_name=settings.CLOUDINARY_CLOUD_NAME,
            api_key=settings.CLOUDINARY_API_KEY,
            api_secret=settings.CLOUDINARY_API_SECRET,
            secure=True,
        )

def sanitize_svg(content: bytes):
    """Basic security check for SVG uploads to prevent embedded script injection."""
    text = content.decode("utf-8", errors="ignore").lower()
    dangerous_patterns = [
        r"<script\b",
        r"javascript\s*:",
        r"\bon\w+\s*=",  # onload, onerror, onclick, etc.
        r"<foreignobject\b",
    ]
    for pattern in dangerous_patterns:
        if re.search(pattern, text):
            raise InvalidFileError("SVG file contains unsafe executable or script elements.")

def validate_image_file(contents: bytes, filename: str, content_type: Optional[str] = None):
    """Validates file size, extension, and content type."""
    if len(contents) == 0:
        raise InvalidFileError("Uploaded file is empty.")

    if len(contents) > MAX_FILE_SIZE_BYTES:
        raise InvalidFileError(f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.")

    ext = os.path.splitext(filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise InvalidFileError(f"File extension '{ext}' is not permitted. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    if content_type and content_type.lower() not in ALLOWED_MIME_TYPES:
        # Also verify if extension matches
        if ext == ".svg":
            content_type = "image/svg+xml"
        elif ext in [".jpg", ".jpeg"]:
            content_type = "image/jpeg"
        elif ext == ".png":
            content_type = "image/png"
        elif ext == ".webp":
            content_type = "image/webp"
        else:
            raise InvalidFileError(f"MIME type '{content_type}' is not supported for image uploads.")

    if ext == ".svg" or (content_type and "svg" in content_type):
        sanitize_svg(contents)

def get_folder_for_purpose(purpose: str) -> str:
    return FOLDER_PURPOSE_MAP.get(purpose, FOLDER_PURPOSE_MAP["general"])

def upload_image(
    file_bytes: bytes,
    filename: str,
    content_type: Optional[str] = None,
    purpose: str = "general",
) -> Dict[str, Any]:
    """
    Uploads an image file to Cloudinary with validation, folder segregation, and safe public IDs.
    Returns metadata dict: public_id, secure_url, format, bytes, width, height, folder, purpose.
    """
    if not settings.is_cloudinary_configured:
        raise CloudinaryNotConfiguredError("Cloudinary service is not configured on the server.")

    validate_image_file(file_bytes, filename, content_type)
    init_cloudinary()

    folder = get_folder_for_purpose(purpose)
    unique_suffix = f"{int(time.time())}_{uuid.uuid4().hex[:8]}"
    prefix = purpose.replace("-", "_")
    public_id = f"{prefix}_{unique_suffix}"

    upload_options: Dict[str, Any] = {
        "folder": folder,
        "public_id": public_id,
        "overwrite": True,
        "resource_type": "image",
    }

    try:
        response = cloudinary.uploader.upload(file_bytes, **upload_options)
    except Exception as e:
        raise RuntimeError(f"Cloudinary upload failed: {str(e)}")

    return {
        "public_id": response.get("public_id"),
        "secure_url": response.get("secure_url"),
        "format": response.get("format", os.path.splitext(filename)[1].lstrip(".")),
        "bytes": response.get("bytes", len(file_bytes)),
        "width": response.get("width"),
        "height": response.get("height"),
        "folder": folder,
        "purpose": purpose,
    }

def delete_image(public_id: str) -> Dict[str, Any]:
    """
    Deletes an image from Cloudinary by its public ID.
    """
    if not settings.is_cloudinary_configured:
        raise CloudinaryNotConfiguredError("Cloudinary service is not configured on the server.")

    init_cloudinary()
    try:
        result = cloudinary.uploader.destroy(public_id, invalidate=True)
        return result
    except Exception as e:
        raise RuntimeError(f"Cloudinary delete failed: {str(e)}")
