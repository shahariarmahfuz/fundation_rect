"""add_foundation_settings_and_permissions

Revision ID: f1e4d224e1d4
Revises: 82e4f01b7a2d
Create Date: 2026-10-12 00:09:16.081370

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1e4d224e1d4'
down_revision: Union[str, Sequence[str], None] = '82e4f01b7a2d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add is_collection_enabled to contribution_settings if not present
    op.add_column(
        "contribution_settings",
        sa.Column("is_collection_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true"))
    )

    # 2. Create foundation_settings table
    op.create_table(
        "foundation_settings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("foundation_name", sa.String(255), nullable=False, server_default="Al-Barakah Welfare Foundation"),
        sa.Column("foundation_short_name", sa.String(50), nullable=True, server_default="ABWF"),
        sa.Column("foundation_logo", sa.Text(), nullable=True),
        sa.Column("tagline", sa.String(255), nullable=True, server_default="Empowering Communities, Transforming Lives"),
        sa.Column("registration_number", sa.String(100), nullable=True, server_default="REG-2024-8971B"),
        sa.Column("email", sa.String(255), nullable=True, server_default="info@albarakah-foundation.org"),
        sa.Column("phone", sa.String(50), nullable=True, server_default="+880 1711-000000"),
        sa.Column("phone_secondary", sa.String(50), nullable=True),
        sa.Column("address", sa.String(255), nullable=True, server_default="House 42, Road 11, Dhanmondi"),
        sa.Column("city", sa.String(100), nullable=True, server_default="Dhaka"),
        sa.Column("postal_code", sa.String(50), nullable=True, server_default="1209"),
        sa.Column("country", sa.String(100), nullable=False, server_default="Bangladesh"),
        sa.Column("website_url", sa.String(255), nullable=True, server_default="https://albarakah-foundation.org"),
        sa.Column("about", sa.Text(), nullable=True, server_default="Al-Barakah Welfare Foundation is a non-profit humanitarian organization dedicated to providing social welfare, education, healthcare, interest-free micro-finance (Qard Hasan), and charitable assistance across Bangladesh."),
        sa.Column("currency_code", sa.String(10), nullable=False, server_default="BDT"),
        sa.Column("currency_symbol", sa.String(10), nullable=False, server_default="৳"),
        sa.Column("decimal_precision", sa.Integer(), nullable=False, server_default="2"),
        sa.Column("date_format", sa.String(30), nullable=False, server_default="YYYY-MM-DD"),
        sa.Column("payment_methods", sa.Text(), nullable=False, server_default="Cash,Bank Transfer,Card,Mobile Money,Cheque"),
        sa.Column("fiscal_year_start_month", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("require_transaction_reference", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("group_prefix", sa.String(20), nullable=False, server_default="G-"),
        sa.Column("member_prefix", sa.String(20), nullable=False, server_default="M-"),
        sa.Column("beneficiary_prefix", sa.String(20), nullable=False, server_default="B-"),
        sa.Column("donation_prefix", sa.String(20), nullable=False, server_default="D-"),
        sa.Column("sadaqah_prefix", sa.String(20), nullable=False, server_default="S-"),
        sa.Column("qard_hasan_prefix", sa.String(20), nullable=False, server_default="QH-"),
        sa.Column("contribution_prefix", sa.String(20), nullable=False, server_default="MC-"),
        sa.Column("default_member_status", sa.String(20), nullable=False, server_default="Active"),
        sa.Column("default_group_status", sa.String(20), nullable=False, server_default="Active"),
        sa.Column("app_display_name", sa.String(255), nullable=False, server_default="Foundation Management System"),
        sa.Column("default_language", sa.String(10), nullable=False, server_default="en"),
        sa.Column("time_zone", sa.String(50), nullable=False, server_default="Asia/Dhaka"),
        sa.Column("receipt_footer_text", sa.Text(), nullable=True, server_default="Thank you for your generous contribution. May Allah accept your righteous deeds."),
        sa.Column("report_header_text", sa.Text(), nullable=True, server_default="Official Financial & Operational Audit Report"),
        sa.Column("report_footer_text", sa.Text(), nullable=True, server_default="Confidential — For Internal and Trustee Use Only"),
        sa.Column("updated_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. Seed initial settings row
    op.execute(
        "INSERT INTO foundation_settings (id, foundation_name, foundation_short_name) "
        "VALUES (1, 'Al-Barakah Welfare Foundation', 'ABWF') "
        "ON CONFLICT (id) DO NOTHING;"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("foundation_settings")
    op.drop_column("contribution_settings", "is_collection_enabled")
