"""add_qard_hasan_module_and_permissions

Revision ID: 612b683a8fd5
Revises: 74c1dbd7d99a
Create Date: 2026-10-11 19:29:37.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import text


# revision identifiers, used by Alembic.
revision: str = '612b683a8fd5'
down_revision: Union[str, Sequence[str], None] = '74c1dbd7d99a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sequences for Qard Hasan and Repayments
    op.execute("CREATE SEQUENCE IF NOT EXISTS qard_hasan_id_seq START WITH 1")
    op.execute("CREATE SEQUENCE IF NOT EXISTS qard_hasan_repay_seq START WITH 1")

    # 2. Create qard_hasans table
    op.create_table(
        'qard_hasans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('loan_id', sa.String(length=50), nullable=False),
        sa.Column('beneficiary_id', sa.Integer(), nullable=False),
        sa.Column('loan_date', sa.Date(), nullable=False),
        sa.Column('principal_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('amount_repaid', sa.Numeric(precision=14, scale=2), server_default='0.00', nullable=False),
        sa.Column('repayment_arrangement', sa.String(length=50), nullable=False),
        sa.Column('first_due_date', sa.Date(), nullable=True),
        sa.Column('expected_completion_date', sa.Date(), nullable=True),
        sa.Column('purpose', sa.Text(), nullable=True),
        sa.Column('internal_reference', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=30), server_default='Active', nullable=False),
        sa.Column('recorded_by_id', sa.Integer(), nullable=False),
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

    op.create_index(op.f('ix_qard_hasans_id'), 'qard_hasans', ['id'], unique=False)
    op.create_index(op.f('ix_qard_hasans_loan_id'), 'qard_hasans', ['loan_id'], unique=True)
    op.create_index(op.f('ix_qard_hasans_beneficiary_id'), 'qard_hasans', ['beneficiary_id'], unique=False)
    op.create_index(op.f('ix_qard_hasans_loan_date'), 'qard_hasans', ['loan_date'], unique=False)
    op.create_index(op.f('ix_qard_hasans_status'), 'qard_hasans', ['status'], unique=False)
    op.create_index(op.f('ix_qard_hasans_internal_reference'), 'qard_hasans', ['internal_reference'], unique=False)
    op.create_index(op.f('ix_qard_hasans_recorded_by_id'), 'qard_hasans', ['recorded_by_id'], unique=False)

    # 3. Create qard_hasan_funding_allocations table
    op.create_table(
        'qard_hasan_funding_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('loan_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['loan_id'], ['qard_hasans.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('loan_id', 'group_id', name='uq_qh_funding_allocation')
    )

    op.create_index(op.f('ix_qard_hasan_funding_allocations_id'), 'qard_hasan_funding_allocations', ['id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_funding_allocations_loan_id'), 'qard_hasan_funding_allocations', ['loan_id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_funding_allocations_group_id'), 'qard_hasan_funding_allocations', ['group_id'], unique=False)

    # 4. Create qard_hasan_repayment_schedules table
    op.create_table(
        'qard_hasan_repayment_schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('loan_id', sa.Integer(), nullable=False),
        sa.Column('installment_number', sa.Integer(), nullable=False),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('principal_due', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('principal_paid', sa.Numeric(precision=14, scale=2), server_default='0.00', nullable=False),
        sa.Column('status', sa.String(length=20), server_default='Pending', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['loan_id'], ['qard_hasans.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(op.f('ix_qard_hasan_repayment_schedules_id'), 'qard_hasan_repayment_schedules', ['id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayment_schedules_loan_id'), 'qard_hasan_repayment_schedules', ['loan_id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayment_schedules_due_date'), 'qard_hasan_repayment_schedules', ['due_date'], unique=False)

    # 5. Create qard_hasan_repayments table
    op.create_table(
        'qard_hasan_repayments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('receipt_id', sa.String(length=50), nullable=False),
        sa.Column('loan_id', sa.Integer(), nullable=False),
        sa.Column('beneficiary_id', sa.Integer(), nullable=False),
        sa.Column('repayment_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('payment_method', sa.String(length=50), nullable=False),
        sa.Column('transaction_reference', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('recorded_by_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=20), server_default='COMPLETED', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['loan_id'], ['qard_hasans.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['beneficiary_id'], ['beneficiaries.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['recorded_by_id'], ['users.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id')
    )

    op.create_index(op.f('ix_qard_hasan_repayments_id'), 'qard_hasan_repayments', ['id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayments_receipt_id'), 'qard_hasan_repayments', ['receipt_id'], unique=True)
    op.create_index(op.f('ix_qard_hasan_repayments_loan_id'), 'qard_hasan_repayments', ['loan_id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayments_beneficiary_id'), 'qard_hasan_repayments', ['beneficiary_id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayments_repayment_date'), 'qard_hasan_repayments', ['repayment_date'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayments_status'), 'qard_hasan_repayments', ['status'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayments_transaction_reference'), 'qard_hasan_repayments', ['transaction_reference'], unique=False)

    # 6. Create qard_hasan_repayment_group_allocations table
    op.create_table(
        'qard_hasan_repayment_group_allocations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('repayment_id', sa.Integer(), nullable=False),
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['repayment_id'], ['qard_hasan_repayments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['group_id'], ['groups.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('repayment_id', 'group_id', name='uq_qh_repay_group_alloc')
    )

    op.create_index(op.f('ix_qard_hasan_repayment_group_allocations_id'), 'qard_hasan_repayment_group_allocations', ['id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayment_group_allocations_repayment_id'), 'qard_hasan_repayment_group_allocations', ['repayment_id'], unique=False)
    op.create_index(op.f('ix_qard_hasan_repayment_group_allocations_group_id'), 'qard_hasan_repayment_group_allocations', ['group_id'], unique=False)

    # 7. Seed new Qard Hasan permissions
    conn = op.get_bind()
    qh_perms = [
        ("qard_hasan.view", "View Qard Hasan loans and management directory", "qard_hasan"),
        ("qard_hasan.create", "Disburse new Qard Hasan interest-free loans", "qard_hasan"),
        ("qard_hasan.repayment.view", "View Qard Hasan repayment history and receipts", "qard_hasan"),
        ("qard_hasan.repayment.create", "Record Qard Hasan loan principal repayments", "qard_hasan"),
        ("qard_hasan.cancel", "Cancel or reverse Qard Hasan loans and restore group funds", "qard_hasan"),
        ("qard_hasan_reports.view", "View Qard Hasan analytics and loan audit reports", "qard_hasan"),
    ]

    for code, desc, mod in qh_perms:
        conn.execute(
            text(
                "INSERT INTO permissions (code, description, module) "
                "VALUES (:code, :desc, :mod) "
                "ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description, module = EXCLUDED.module"
            ),
            {"code": code, "desc": desc, "mod": mod}
        )

    # Assign all qard_hasan permissions to Administrator role
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Administrator' AND p.code LIKE 'qard_hasan%' "
            "ON CONFLICT DO NOTHING"
        )
    )

    # Assign all qard_hasan permissions to Finance Officer role
    conn.execute(
        text(
            "INSERT INTO role_permissions (role_id, permission_id) "
            "SELECT r.id, p.id FROM roles r, permissions p "
            "WHERE r.name = 'Finance Officer' AND p.code LIKE 'qard_hasan%' "
            "ON CONFLICT DO NOTHING"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text(
            "DELETE FROM role_permissions WHERE permission_id IN ("
            "SELECT id FROM permissions WHERE code LIKE 'qard_hasan%')"
        )
    )
    conn.execute(
        text(
            "DELETE FROM permissions WHERE code LIKE 'qard_hasan%'"
        )
    )

    op.drop_table('qard_hasan_repayment_group_allocations')
    op.drop_table('qard_hasan_repayments')
    op.drop_table('qard_hasan_repayment_schedules')
    op.drop_table('qard_hasan_funding_allocations')
    op.drop_table('qard_hasans')

    op.execute("DROP SEQUENCE IF EXISTS qard_hasan_repay_seq")
    op.execute("DROP SEQUENCE IF EXISTS qard_hasan_id_seq")
