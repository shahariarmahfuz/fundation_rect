"""add_media_assets_and_foundation_posts

Revision ID: a3f5c71b9e28
Revises: f1e4d224e1d4
Create Date: 2026-10-12 03:42:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f5c71b9e28'
down_revision: Union[str, Sequence[str], None] = 'f1e4d224e1d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add foundation_logo_public_id to foundation_settings
    op.add_column(
        "foundation_settings",
        sa.Column("foundation_logo_public_id", sa.String(255), nullable=True)
    )

    # 2. Create media_assets table
    op.create_table(
        "media_assets",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("public_id", sa.String(255), nullable=False, unique=True, index=True),
        sa.Column("secure_url", sa.String(1000), nullable=False),
        sa.Column("folder", sa.String(255), nullable=False),
        sa.Column("format", sa.String(50), nullable=False),
        sa.Column("bytes", sa.Integer(), nullable=False),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("purpose", sa.String(50), nullable=False, server_default="general", index=True),
        sa.Column("uploaded_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. Create foundation_posts table
    op.create_table(
        "foundation_posts",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("featured_image_url", sa.String(1000), nullable=True),
        sa.Column("featured_image_public_id", sa.String(255), nullable=True),
        sa.Column("status", sa.String(50), nullable=False, server_default="draft", index=True),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("foundation_posts")
    op.drop_table("media_assets")
    op.drop_column("foundation_settings", "foundation_logo_public_id")
