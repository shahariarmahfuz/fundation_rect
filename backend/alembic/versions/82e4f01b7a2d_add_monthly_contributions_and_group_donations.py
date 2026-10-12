"""add_monthly_contributions_and_group_donations

Revision ID: 82e4f01b7a2d
Revises: 612b683a8fd5
Create Date: 2026-10-11 19:56:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision: str = '82e4f01b7a2d'
down_revision: Union[str, Sequence[str], None] = '612b683a8fd5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add group_id to donations table
    op.add_column('donations', sa.Column('group_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_donations_group_id', 'donations', 'groups', ['group_id'], ['id'], ondelete='RESTRICT')
    op.create_index(op.f('ix_donations_group_id'), 'donations', ['group_id'], unique=False)

    # 2. Create sequence for member contribution receipts
    op.execute("CREATE SEQUENCE IF NOT EXISTS contribution_receipt_seq START WITH 1")

    # 3. Create contribution_settings table
    op.create_table(
        'contribution_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('monthly_amount', sa.Numeric(precision=12, scale=2), server_default='100.00', nullable=False),
        sa.Column('currency', sa.String(length=10), server_default='BDT', nullable=False),
        sa.Column('effective_from', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('updated_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['updated_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Seed initial contribution setting (100 BDT) if table is empty
    conn = op.get_bind()
    conn.execute(
        text(
            "INSERT INTO contribution_settings (id, monthly_amount, currency, effective_from) "
            "VALUES (1, 100.00, 'BDT', CURRENT_DATE) "
            "ON CONFLICT (id) DO NOTHING"
        )
    )

    # 4. Create member_contributions table
    op.create_table(
        'member_contributions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('receipt_id', sa.String(length=50), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('contribution_year', sa.Integer(), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('payment_date', sa.Date(), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('transaction_reference', sa.String(length=100), nullable=True),
        sa.Column('batch_reference', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), server_default='COMPLETED', nullable=False),
        sa.Column('recorded_by_id', sa.Integer(), nullable=False),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by_id', sa.Integer(), nullable=True),
        sa.Column('cancel_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['recorded_by_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cancelled_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(op.f('ix_member_contributions_id'), 'member_contributions', ['id'], unique=False)
    op.create_index(op.f('ix_member_contributions_receipt_id'), 'member_contributions', ['receipt_id'], unique=True)
    op.create_index(op.f('ix_member_contributions_member_id'), 'member_contributions', ['member_id'], unique=False)
    op.create_index(op.f('ix_member_contributions_group_id'), 'member_contributions', ['group_id'], unique=False)
    op.create_index(op.f('ix_member_contributions_contribution_year'), 'member_contributions', ['contribution_year'], unique=False)
    op.create_index(op.f('ix_member_contributions_payment_date'), 'member_contributions', ['payment_date'], unique=False)
    op.create_index(op.f('ix_member_contributions_status'), 'member_contributions', ['status'], unique=False)
    op.create_index(op.f('ix_member_contributions_transaction_reference'), 'member_contributions', ['transaction_reference'], unique=False)
    op.create_index(op.f('ix_member_contributions_batch_reference'), 'member_contributions', ['batch_reference'], unique=False)

    # 5. Create contribution_month_allocations table
    op.create_table(
        'contribution_month_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contribution_id', sa.Integer(), nullable=False),
        sa.Column('member_id', sa.Integer(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='Paid', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['contribution_id'], ['member_contributions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['member_id'], ['members.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(op.f('ix_contribution_month_allocations_id'), 'contribution_month_allocations', ['id'], unique=False)
    op.create_index(op.f('ix_contribution_month_allocations_contribution_id'), 'contribution_month_allocations', ['contribution_id'], unique=False)
    op.create_index(op.f('ix_contribution_month_allocations_member_id'), 'contribution_month_allocations', ['member_id'], unique=False)
    op.create_index(op.f('ix_contribution_month_allocations_year'), 'contribution_month_allocations', ['year'], unique=False)
    op.create_index(op.f('ix_contribution_month_allocations_month'), 'contribution_month_allocations', ['month'], unique=False)

    # 6. Seed Contribution Permissions
    contrib_perms = [
        ("contributions.view", "View monthly contributions and management records", "contributions"),
        ("contributions.create", "Record member monthly contributions and batch collections", "contributions"),
        ("contributions.update", "Edit contribution details and metadata", "contributions"),
        ("contributions.cancel", "Cancel or reverse member contributions and restore group funds", "contributions"),
        ("contributions.due_list.view", "View members due contribution report and arrears", "contributions"),
        ("contribution_reports.view", "View contribution analytics and financial summaries", "contributions"),
        ("contribution_settings.view", "View global monthly contribution configuration", "contributions"),
        ("contribution_settings.update", "Update global monthly contribution amount", "contributions"),
    ]

    for code, desc, mod in contrib_perms:
        conn.execute(
            text(
                "INSERT INTO permissions (code, description, module) "
                "VALUES (:code, :desc, :mod) "
                "ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, module = EXCLUDED.module"
            ),
            {"code": code, "desc": desc, "mod": mod}
        )

    # Assign all contribution permissions to Administrator
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Administrator' AND (p.code LIKE 'contribution%' OR p.code LIKE 'contributions%') "
            "ON CONFLICT DO NOTHING"
        )
    )

    # Assign non-administrative contribution permissions to Finance Officer
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Finance Officer' AND p.code IN ("
            "'contributions.view', 'contributions.create', 'contributions.cancel', "
            "'contributions.due_list.view', 'contribution_reports.view', 'contribution_settings.view') "
            "ON CONFLICT DO NOTHING"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(
            "DELETE FROM role_permissions WHERE permission_id IN ("
            "SELECT id FROM permissions WHERE code LIKE 'contribution%')"
        )
    )
    conn.execute(
        text(
            "DELETE FROM permissions WHERE code LIKE 'contribution%'"
        )
    )

    op.drop_table('contribution_month_allocations')
    op.drop_table('member_contributions')
    op.drop_table('contribution_settings')
    op.execute("DROP SEQUENCE IF EXISTS contribution_receipt_seq")

    op.drop_constraint('fk_donations_group_id', 'donations', type_='foreignkey')
    op.drop_index(op.f('ix_donations_group_id'), table_name='donations')
    op.drop_column('donations', 'group_id')
