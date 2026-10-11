"""add_donations_module_and_permissions

Revision ID: e317bcf219a1
Revises: d2046f5189e7
Create Date: 2026-10-11 18:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text

# revision identifiers, used by Alembic.
revision: str = 'e317bcf219a1'
down_revision: Union[str, Sequence[str], None] = 'd2046f5189e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sequence for donation ID
    op.execute("CREATE SEQUENCE IF NOT EXISTS donation_id_seq START WITH 1")

    # 2. Create donations table
    op.create_table(
        'donations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('donation_id', sa.String(length=50), nullable=False),
        sa.Column('donation_date', sa.Date(), nullable=False),
        sa.Column('donor_name', sa.String(length=150), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('transaction_reference', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='COMPLETED', nullable=False),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by_id', sa.Integer(), nullable=True),
        sa.Column('cancel_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['recorded_by_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cancelled_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(op.f('ix_donations_id'), 'donations', ['id'], unique=False)
    op.create_index(op.f('ix_donations_donation_id'), 'donations', ['donation_id'], unique=True)
    op.create_index(op.f('ix_donations_donation_date'), 'donations', ['donation_date'], unique=False)
    op.create_index(op.f('ix_donations_donor_name'), 'donations', ['donor_name'], unique=False)
    op.create_index(op.f('ix_donations_payment_method'), 'donations', ['payment_method'], unique=False)
    op.create_index(op.f('ix_donations_transaction_reference'), 'donations', ['transaction_reference'], unique=True)
    op.create_index(op.f('ix_donations_recorded_by_id'), 'donations', ['recorded_by_id'], unique=False)
    op.create_index(op.f('ix_donations_status'), 'donations', ['status'], unique=False)

    # 3. Seed new permissions
    conn = op.get_bind()
    donation_perms = [
        ("donations.view", "View donations and donation management", "donations"),
        ("donations.create", "Record new donations", "donations"),
        ("donations.update", "Edit donation details", "donations"),
        ("donations.cancel", "Cancel or reverse donation records", "donations"),
        ("donation_reports.view", "View donation reports and summaries", "donations"),
    ]

    for code, desc, mod in donation_perms:
        conn.execute(
            text(
                "INSERT INTO permissions (code, description, module) "
                "VALUES (:code, :desc, :mod) "
                "ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, module = EXCLUDED.module"
            ),
            {"code": code, "desc": desc, "mod": mod}
        )

    # Assign all 5 donation permissions to Administrator role
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Administrator' AND p.code LIKE 'donation%' "
            "ON CONFLICT DO NOTHING"
        )
    )

    # Assign donation permissions to Finance Officer role
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Finance Officer' AND p.code LIKE 'donation%' "
            "ON CONFLICT DO NOTHING"
        )
    )


def downgrade() -> None:
    op.execute(
        text(
            "DELETE FROM role_permissions WHERE permission_id IN ("
            "SELECT id FROM permissions WHERE code LIKE 'donation%')"
        )
    )
    op.execute(text("DELETE FROM permissions WHERE code LIKE 'donation%'"))
    op.drop_table('donations')
    op.execute("DROP SEQUENCE IF EXISTS donation_id_seq")
