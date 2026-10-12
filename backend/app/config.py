import os
import re
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv

# Load .env file from workspace root or current directory
load_dotenv()

def _parse_cloudinary_url(url: Optional[str]):
    if not url:
        return None, None, None
    match = re.match(r"^cloudinary:\/\/([^:]+):([^@]+)@(.+)$", url.strip())
    if match:
        return match.group(3), match.group(1), match.group(2)
    return None, None, None

_url_cloud_name, _url_api_key, _url_api_secret = _parse_cloudinary_url(os.getenv("CLOUDINARY_URL"))

class Settings(BaseModel):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://neondb_owner:npg_tTi2zuAdbB8j@ep-fancy-band-b3i1kwtv-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "foundation-super-secret-key-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # Cloudinary credentials (server-side only, never expose secret to client)
    CLOUDINARY_CLOUD_NAME: Optional[str] = os.getenv("CLOUDINARY_CLOUD_NAME") or _url_cloud_name
    CLOUDINARY_API_KEY: Optional[str] = os.getenv("CLOUDINARY_API_KEY") or _url_api_key
    CLOUDINARY_API_SECRET: Optional[str] = os.getenv("CLOUDINARY_API_SECRET") or _url_api_secret
    CLOUDINARY_URL: Optional[str] = os.getenv("CLOUDINARY_URL")

    @property
    def is_cloudinary_configured(self) -> bool:
        return bool(
            self.CLOUDINARY_CLOUD_NAME
            and self.CLOUDINARY_API_KEY
            and self.CLOUDINARY_API_SECRET
        )

settings = Settings()
