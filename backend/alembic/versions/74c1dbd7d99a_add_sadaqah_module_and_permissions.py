"""add_sadaqah_module_and_permissions

Revision ID: 74c1dbd7d99a
Revises: e317bcf219a1
Create Date: 2026-10-11 19:01:17.148132

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision: str = '74c1dbd7d99a'
down_revision: Union[str, Sequence[str], None] = 'e317bcf219a1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sequence for sadaqah ID
    op.execute("CREATE SEQUENCE IF NOT EXISTS sadaqah_id_seq START WITH 1")

    # 2. Modify group_fund_transactions reference index to allow same reference across distinct groups
    op.drop_index('ix_group_fund_transactions_reference', table_name='group_fund_transactions')
    op.create_index('ix_group_fund_transactions_reference', 'group_fund_transactions', ['reference'], unique=False)
    op.create_index('ix_group_fund_transactions_group_ref', 'group_fund_transactions', ['group_id', 'reference'], unique=True)

    # 3. Create sadaqahs table
    op.create_table(
        'sadaqahs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sadaqah_id', sa.String(length=50), nullable=False),
        sa.Column('beneficiary_id', sa.Integer(), nullable=False),
        sa.Column('sadaqah_date', sa.Date(), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('purpose', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='COMPLETED', nullable=False),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_by_id', sa.Integer(), nullable=True),
        sa.Column('cancel_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['beneficiary_id'], ['beneficiaries.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['recorded_by_id'], ['users.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cancelled_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(op.f('ix_sadaqahs_id'), 'sadaqahs', ['id'], unique=False)
    op.create_index(op.f('ix_sadaqahs_sadaqah_id'), 'sadaqahs', ['sadaqah_id'], unique=True)
    op.create_index(op.f('ix_sadaqahs_beneficiary_id'), 'sadaqahs', ['beneficiary_id'], unique=False)
    op.create_index(op.f('ix_sadaqahs_sadaqah_date'), 'sadaqahs', ['sadaqah_date'], unique=False)
    op.create_index(op.f('ix_sadaqahs_recorded_by_id'), 'sadaqahs', ['recorded_by_id'], unique=False)
    op.create_index(op.f('ix_sadaqahs_status'), 'sadaqahs', ['status'], unique=False)

    # 4. Create sadaqah_allocations table
    op.create_table(
        'sadaqah_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sadaqah_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['sadaqah_id'], ['sadaqahs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('sadaqah_id', 'group_id', name='uq_sadaqah_group_allocation')
    )

    op.create_index(op.f('ix_sadaqah_allocations_id'), 'sadaqah_allocations', ['id'], unique=False)
    op.create_index(op.f('ix_sadaqah_allocations_sadaqah_id'), 'sadaqah_allocations', ['sadaqah_id'], unique=False)
    op.create_index(op.f('ix_sadaqah_allocations_group_id'), 'sadaqah_allocations', ['group_id'], unique=False)

    # 5. Seed new permissions
    conn = op.get_bind()
    sadaqah_perms = [
        ("sadaqah.view", "View Sadaqah distributions and management page", "sadaqah"),
        ("sadaqah.create", "Record new Sadaqah distributions and multi-group allocations", "sadaqah"),
        ("sadaqah.cancel", "Cancel or reverse Sadaqah distributions and restore group funds", "sadaqah"),
        ("sadaqah_reports.view", "View Sadaqah analytical reports and summaries", "sadaqah"),
    ]

    for code, desc, mod in sadaqah_perms:
        conn.execute(
            text(
                "INSERT INTO permissions (code, description, module) "
                "VALUES (:code, :desc, :mod) "
                "ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, module = EXCLUDED.module"
            ),
            {"code": code, "desc": desc, "mod": mod}
        )

    # Assign all sadaqah permissions to Administrator role
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Administrator' AND p.code LIKE 'sadaqah%' "
            "ON CONFLICT DO NOTHING"
        )
    )

    # Assign sadaqah permissions to Finance Officer role
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Finance Officer' AND p.code LIKE 'sadaqah%' "
            "ON CONFLICT DO NOTHING"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(
            "DELETE FROM role_permissions WHERE permission_id IN ("
            "SELECT id FROM permissions WHERE code LIKE 'sadaqah%')"
        )
    )
    conn.execute(
        text(
            "DELETE FROM permissions WHERE code LIKE 'sadaqah%'"
        )
    )

    op.drop_table('sadaqah_allocations')
    op.drop_table('sadaqahs')

    op.drop_index('ix_group_fund_transactions_group_ref', table_name='group_fund_transactions')
    op.drop_index('ix_group_fund_transactions_reference', table_name='group_fund_transactions')
    op.create_index('ix_group_fund_transactions_reference', 'group_fund_transactions', ['reference'], unique=True)

    op.execute("DROP SEQUENCE IF EXISTS sadaqah_id_seq")
