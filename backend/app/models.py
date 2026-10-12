from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Date,
    DateTime,
    Numeric,
    Boolean,
    ForeignKey,
    Table,
    Sequence,
    UniqueConstraint,
    func
)
from sqlalchemy.orm import relationship
from datetime import date
from backend.app.database import Base

# Postgres Sequences for atomic ID generation
group_code_seq = Sequence("group_code_seq", start=1)
member_id_seq = Sequence("member_id_seq", start=1)
beneficiary_id_seq = Sequence("beneficiary_id_seq", start=1)
donation_id_seq = Sequence("donation_id_seq", start=1)
sadaqah_id_seq = Sequence("sadaqah_id_seq", start=1)
qard_hasan_id_seq = Sequence("qard_hasan_id_seq", start=1)
qard_hasan_repay_seq = Sequence("qard_hasan_repay_seq", start=1)
contribution_receipt_seq = Sequence("contribution_receipt_seq", start=1)

# Association table for Role <-> Permission
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True),
)

class Permission(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)
    module = Column(String(50), nullable=False, index=True)

    roles = relationship("Role", secondary=role_permissions, back_populates="permissions")

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(String(255), nullable=True)

    permissions = relationship("Permission", secondary=role_permissions, back_populates="roles")
    users = relationship("User", back_populates="role")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    full_name = Column(String(120), nullable=False)
    password_hash = Column(String(255), nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    role = relationship("Role", back_populates="users")

class Group(Base):
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(20), default="Active", nullable=False, index=True)  # "Active" or "Inactive"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    members = relationship("Member", back_populates="group")
    fund_transactions = relationship("GroupFundTransaction", back_populates="group")

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(String(50), unique=True, nullable=False, index=True)  # Format: "M-0001"
    name = Column(String(150), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(120), nullable=True)
    address = Column(Text, nullable=True)
    joining_date = Column(Date, nullable=True)
    status = Column(String(20), default="Active", nullable=False, index=True)  # "Active" or "Inactive"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    group = relationship("Group", back_populates="members")

class Beneficiary(Base):
    __tablename__ = "beneficiaries"

    id = Column(Integer, primary_key=True, index=True)
    beneficiary_id = Column(String(50), unique=True, nullable=False, index=True)  # Format: "B-0001"
    name = Column(String(150), nullable=False, index=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    registration_date = Column(Date, nullable=True)
    status = Column(String(20), default="Active", nullable=False, index=True)  # "Active" or "Inactive"
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    ledger_entries = relationship("BeneficiaryLedger", back_populates="beneficiary", order_by="BeneficiaryLedger.transaction_date.asc(), BeneficiaryLedger.id.asc()")

class GroupFundTransaction(Base):
    __tablename__ = "group_fund_transactions"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(100), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=False, index=True)
    transaction_date = Column(DateTime(timezone=True), nullable=False, index=True)
    transaction_type = Column(String(20), nullable=False)  # "Received" or "Spent"
    amount = Column(Numeric(14, 2), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    group = relationship("Group", back_populates="fund_transactions")

    __table_args__ = (
        UniqueConstraint("group_id", "reference", name="uq_group_fund_tx_ref"),
    )

class BeneficiaryLedger(Base):
    __tablename__ = "beneficiary_ledger"

    id = Column(Integer, primary_key=True, index=True)
    reference = Column(String(100), unique=True, nullable=False, index=True)
    beneficiary_id = Column(Integer, ForeignKey("beneficiaries.id", ondelete="RESTRICT"), nullable=False, index=True)
    transaction_date = Column(DateTime(timezone=True), nullable=False, index=True)
    transaction_type = Column(String(20), nullable=False)  # "Received" or "Disbursed"
    amount = Column(Numeric(14, 2), nullable=False)
    description = Column(Text, nullable=True)
    created_by = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    beneficiary = relationship("Beneficiary", back_populates="ledger_entries")

class Donation(Base):
    __tablename__ = "donations"

    id = Column(Integer, primary_key=True, index=True)
    donation_id = Column(String(50), unique=True, nullable=False, index=True)  # Format: "D-0001"
    donation_date = Column(Date, nullable=False, index=True)
    donor_name = Column(String(150), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=True, index=True)
    payment_method = Column(String(50), nullable=False, index=True)
    transaction_reference = Column(String(100), unique=True, nullable=True, index=True)
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(20), default="COMPLETED", nullable=False, index=True)  # "COMPLETED" or "CANCELLED"
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    group = relationship("Group")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])

class Sadaqah(Base):
    __tablename__ = "sadaqahs"

    id = Column(Integer, primary_key=True, index=True)
    sadaqah_id = Column(String(50), unique=True, nullable=False, index=True)  # Format: "S-0001"
    beneficiary_id = Column(Integer, ForeignKey("beneficiaries.id", ondelete="RESTRICT"), nullable=False, index=True)
    sadaqah_date = Column(Date, nullable=False, index=True)
    total_amount = Column(Numeric(14, 2), nullable=False)
    purpose = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(20), default="COMPLETED", nullable=False, index=True)  # "COMPLETED" or "CANCELLED"
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    beneficiary = relationship("Beneficiary")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])
    allocations = relationship("SadaqahAllocation", back_populates="sadaqah", cascade="all, delete-orphan", order_by="SadaqahAllocation.id.asc()")

class SadaqahAllocation(Base):
    __tablename__ = "sadaqah_allocations"

    id = Column(Integer, primary_key=True, index=True)
    sadaqah_id = Column(Integer, ForeignKey("sadaqahs.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    sadaqah = relationship("Sadaqah", back_populates="allocations")
    group = relationship("Group")

    __table_args__ = (
        UniqueConstraint("sadaqah_id", "group_id", name="uq_sadaqah_group_allocation"),
    )

class QardHasan(Base):
    __tablename__ = "qard_hasans"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(String(50), unique=True, nullable=False, index=True)  # Format: "QH-0001"
    beneficiary_id = Column(Integer, ForeignKey("beneficiaries.id", ondelete="RESTRICT"), nullable=False, index=True)
    loan_date = Column(Date, nullable=False, index=True)
    principal_amount = Column(Numeric(14, 2), nullable=False)
    amount_repaid = Column(Numeric(14, 2), default=0.00, nullable=False)
    repayment_arrangement = Column(String(50), nullable=False)  # "One-time" or "Installments"
    first_due_date = Column(Date, nullable=True)
    expected_completion_date = Column(Date, nullable=True)
    purpose = Column(Text, nullable=True)
    internal_reference = Column(String(100), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    status = Column(String(30), default="Active", nullable=False, index=True)  # "Active", "Partially Repaid", "Fully Repaid", "Cancelled"
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    beneficiary = relationship("Beneficiary")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])
    funding_allocations = relationship("QardHasanFundingAllocation", back_populates="loan", cascade="all, delete-orphan", order_by="QardHasanFundingAllocation.id.asc()")
    schedules = relationship("QardHasanRepaymentSchedule", back_populates="loan", cascade="all, delete-orphan", order_by="QardHasanRepaymentSchedule.due_date.asc()")
    repayments = relationship("QardHasanRepayment", back_populates="loan", cascade="all, delete-orphan", order_by="QardHasanRepayment.repayment_date.desc()")

class QardHasanFundingAllocation(Base):
    __tablename__ = "qard_hasan_funding_allocations"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("qard_hasans.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    loan = relationship("QardHasan", back_populates="funding_allocations")
    group = relationship("Group")

    __table_args__ = (
        UniqueConstraint("loan_id", "group_id", name="uq_qh_funding_allocation"),
    )

class QardHasanRepaymentSchedule(Base):
    __tablename__ = "qard_hasan_repayment_schedules"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("qard_hasans.id", ondelete="CASCADE"), nullable=False, index=True)
    installment_number = Column(Integer, nullable=False)
    due_date = Column(Date, nullable=False, index=True)
    principal_due = Column(Numeric(14, 2), nullable=False)
    principal_paid = Column(Numeric(14, 2), default=0.00, nullable=False)
    status = Column(String(20), default="Pending", nullable=False)  # "Pending", "Partially Paid", "Paid"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    loan = relationship("QardHasan", back_populates="schedules")

class QardHasanRepayment(Base):
    __tablename__ = "qard_hasan_repayments"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(String(50), unique=True, nullable=False, index=True)  # Format: "QHR-0001"
    loan_id = Column(Integer, ForeignKey("qard_hasans.id", ondelete="RESTRICT"), nullable=False, index=True)
    beneficiary_id = Column(Integer, ForeignKey("beneficiaries.id", ondelete="RESTRICT"), nullable=False, index=True)
    repayment_date = Column(Date, nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    payment_method = Column(String(50), nullable=False)
    transaction_reference = Column(String(100), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    status = Column(String(20), default="COMPLETED", nullable=False, index=True)  # "COMPLETED" or "CANCELLED"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    loan = relationship("QardHasan", back_populates="repayments")
    beneficiary = relationship("Beneficiary")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    group_allocations = relationship("QardHasanRepaymentGroupAllocation", back_populates="repayment", cascade="all, delete-orphan", order_by="QardHasanRepaymentGroupAllocation.id.asc()")

class QardHasanRepaymentGroupAllocation(Base):
    __tablename__ = "qard_hasan_repayment_group_allocations"

    id = Column(Integer, primary_key=True, index=True)
    repayment_id = Column(Integer, ForeignKey("qard_hasan_repayments.id", ondelete="CASCADE"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount = Column(Numeric(14, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    repayment = relationship("QardHasanRepayment", back_populates="group_allocations")
    group = relationship("Group")

    __table_args__ = (
        UniqueConstraint("repayment_id", "group_id", name="uq_qh_repay_group_alloc"),
    )

class ContributionSetting(Base):
    __tablename__ = "contribution_settings"

    id = Column(Integer, primary_key=True)
    monthly_amount = Column(Numeric(12, 2), nullable=False, default=100.00)
    currency = Column(String(10), default="BDT", nullable=False)
    effective_from = Column(Date, nullable=False, default=date.today)
    is_collection_enabled = Column(Boolean, default=True, nullable=False)
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    updated_by = relationship("User")

class FoundationSetting(Base):
    __tablename__ = "foundation_settings"

    id = Column(Integer, primary_key=True)

    # 1. Foundation Profile
    foundation_name = Column(String(255), default="Al-Barakah Welfare Foundation", nullable=False)
    foundation_short_name = Column(String(50), default="ABWF", nullable=True)
    foundation_logo = Column(Text, nullable=True)  # URL or base64 data URI
    foundation_logo_public_id = Column(String(255), nullable=True)
    tagline = Column(String(255), default="Empowering Communities, Transforming Lives", nullable=True)
    registration_number = Column(String(100), default="REG-2024-8971B", nullable=True)
    email = Column(String(255), default="info@albarakah-foundation.org", nullable=True)
    phone = Column(String(50), default="+880 1711-000000", nullable=True)
    phone_secondary = Column(String(50), nullable=True)
    address = Column(String(255), default="House 42, Road 11, Dhanmondi", nullable=True)
    city = Column(String(100), default="Dhaka", nullable=True)
    postal_code = Column(String(50), default="1209", nullable=True)
    country = Column(String(100), default="Bangladesh", nullable=False)
    website_url = Column(String(255), default="https://albarakah-foundation.org", nullable=True)
    about = Column(Text, default="Al-Barakah Welfare Foundation is a non-profit humanitarian organization dedicated to providing social welfare, education, healthcare, interest-free micro-finance (Qard Hasan), and charitable assistance across Bangladesh.", nullable=True)

    # 2. Financial Settings
    currency_code = Column(String(10), default="BDT", nullable=False)
    currency_symbol = Column(String(10), default="৳", nullable=False)
    decimal_precision = Column(Integer, default=2, nullable=False)
    date_format = Column(String(30), default="YYYY-MM-DD", nullable=False)
    payment_methods = Column(Text, default="Cash,Bank Transfer,Card,Mobile Money,Cheque", nullable=False)
    fiscal_year_start_month = Column(Integer, default=1, nullable=False)
    require_transaction_reference = Column(Boolean, default=False, nullable=False)

    # 3. Group, Member & ID Generation Prefixes
    group_prefix = Column(String(20), default="G-", nullable=False)
    member_prefix = Column(String(20), default="M-", nullable=False)
    beneficiary_prefix = Column(String(20), default="B-", nullable=False)
    donation_prefix = Column(String(20), default="D-", nullable=False)
    sadaqah_prefix = Column(String(20), default="S-", nullable=False)
    qard_hasan_prefix = Column(String(20), default="QH-", nullable=False)
    contribution_prefix = Column(String(20), default="MC-", nullable=False)
    default_member_status = Column(String(20), default="Active", nullable=False)
    default_group_status = Column(String(20), default="Active", nullable=False)

    # 4. Organization & System Display
    app_display_name = Column(String(255), default="Foundation Management System", nullable=False)
    default_language = Column(String(10), default="en", nullable=False)
    time_zone = Column(String(50), default="Asia/Dhaka", nullable=False)
    receipt_footer_text = Column(Text, default="Thank you for your generous contribution. May Allah accept your righteous deeds.", nullable=True)
    report_header_text = Column(Text, default="Official Financial & Operational Audit Report", nullable=True)
    report_footer_text = Column(Text, default="Confidential — For Internal and Trustee Use Only", nullable=True)

    # Audit metadata
    updated_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    updated_by = relationship("User")

class MemberContributionReceipt(Base):
    __tablename__ = "member_contributions"

    id = Column(Integer, primary_key=True, index=True)
    receipt_id = Column(String(50), unique=True, nullable=False, index=True)  # Format: "MC-0001"
    member_id = Column(Integer, ForeignKey("members.id", ondelete="RESTRICT"), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("groups.id", ondelete="RESTRICT"), nullable=False, index=True)
    contribution_year = Column(Integer, nullable=False, index=True)
    total_amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(Date, nullable=False, index=True)
    payment_method = Column(String(50), nullable=False)
    transaction_reference = Column(String(100), nullable=True, index=True)
    batch_reference = Column(String(100), nullable=True, index=True)
    notes = Column(Text, nullable=True)
    status = Column(String(20), default="COMPLETED", nullable=False, index=True)  # "COMPLETED" or "CANCELLED"
    recorded_by_id = Column(Integer, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    cancel_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    member = relationship("Member")
    group = relationship("Group")
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])
    cancelled_by = relationship("User", foreign_keys=[cancelled_by_id])
    month_allocations = relationship("ContributionMonthAllocation", back_populates="contribution", cascade="all, delete-orphan", order_by="ContributionMonthAllocation.month.asc()")

class ContributionMonthAllocation(Base):
    __tablename__ = "contribution_month_allocations"

    id = Column(Integer, primary_key=True, index=True)
    contribution_id = Column(Integer, ForeignKey("member_contributions.id", ondelete="CASCADE"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="RESTRICT"), nullable=False, index=True)
    year = Column(Integer, nullable=False, index=True)
    month = Column(Integer, nullable=False, index=True)  # 1 to 12
    amount = Column(Numeric(12, 2), nullable=False)
    status = Column(String(20), default="Paid", nullable=False)  # "Paid" or "Cancelled"
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    contribution = relationship("MemberContributionReceipt", back_populates="month_allocations")
    member = relationship("Member")

class MediaAsset(Base):
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)
    public_id = Column(String(255), unique=True, nullable=False, index=True)
    secure_url = Column(String(1000), nullable=False)
    folder = Column(String(255), nullable=False)
    format = Column(String(50), nullable=False)
    bytes = Column(Integer, nullable=False)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    purpose = Column(String(50), default="general", nullable=False, index=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    uploaded_by = relationship("User")

class FoundationPost(Base):
    __tablename__ = "foundation_posts"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    featured_image_url = Column(String(1000), nullable=True)
    featured_image_public_id = Column(String(255), nullable=True)
    status = Column(String(50), default="draft", nullable=False, index=True)  # draft, published, archived
    created_by_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    created_by = relationship("User")


