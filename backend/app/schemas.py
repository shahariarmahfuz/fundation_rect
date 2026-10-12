from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal

# Permission & Role schemas
class PermissionOut(BaseModel):
    id: int
    code: str
    description: Optional[str] = None
    module: str

    class Config:
        from_attributes = True

class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    permissions: List[str] = []

    class Config:
        from_attributes = True

class RolePermissionUpdate(BaseModel):
    permission_codes: List[str]

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    full_name: str
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    permissions: List[str] = []

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=1, max_length=128)

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut

# Group schemas
class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    code: Optional[str] = Field(None, max_length=50)  # Optional custom code if authorized
    description: Optional[str] = None
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")

class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(Active|Inactive)$")

class GroupOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime
    member_count: Optional[int] = 0

    class Config:
        from_attributes = True

class GroupFundSummary(BaseModel):
    id: int
    code: str
    name: str
    status: str
    total_received: Decimal
    total_spent: Decimal
    available_balance: Decimal
    transaction_count: int

class GroupFundTransactionOut(BaseModel):
    id: int
    reference: str
    transaction_date: datetime
    transaction_type: str
    amount: Decimal
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

# Member schemas
class MemberCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    group_id: int
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    joining_date: Optional[date] = None
    notes: Optional[str] = None
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")

class MemberUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    group_id: Optional[int] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    joining_date: Optional[date] = None
    notes: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(Active|Inactive)$")

class MemberOut(BaseModel):
    id: int
    member_id: str
    name: str
    group_id: int
    group_name: Optional[str] = None
    group_code: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    joining_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class MemberDueItem(BaseModel):
    id: int
    member_id: str
    name: str
    group_name: str
    group_code: str
    status: str
    due_amount: Optional[Decimal] = None
    has_ledger: bool = False
    note: str

# Beneficiary schemas
class BeneficiaryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    phone: Optional[str] = None
    address: Optional[str] = None
    registration_date: Optional[date] = None
    status: str = Field(default="Active", pattern="^(Active|Inactive)$")
    notes: Optional[str] = None

class BeneficiaryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = None
    address: Optional[str] = None
    registration_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(Active|Inactive)$")
    notes: Optional[str] = None

class BeneficiaryOut(BaseModel):
    id: int
    beneficiary_id: str
    name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    registration_date: Optional[date] = None
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BeneficiaryLedgerEntryOut(BaseModel):
    id: int
    reference: str
    transaction_date: datetime
    transaction_type: str
    amount: Decimal
    description: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    running_balance: Decimal

class BeneficiaryLedgerSummary(BaseModel):
    beneficiary: BeneficiaryOut
    total_received: Decimal
    total_disbursed: Decimal
    current_balance: Decimal
    entries: List[BeneficiaryLedgerEntryOut]
    total_count: int

# Donation schemas
class DonationCreate(BaseModel):
    donation_date: date
    donor_name: str = Field(..., min_length=1, max_length=150)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    group_id: int = Field(..., description="Receiving group where donation is credited")
    payment_method: str = Field(..., min_length=1, max_length=50)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class DonationUpdate(BaseModel):
    donation_date: Optional[date] = None
    donor_name: Optional[str] = Field(None, min_length=1, max_length=150)
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    group_id: Optional[int] = None
    payment_method: Optional[str] = Field(None, min_length=1, max_length=50)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class DonationCancelRequest(BaseModel):
    cancel_reason: str = Field(..., min_length=1, max_length=500)

class DonationOut(BaseModel):
    id: int
    donation_id: str
    donation_date: date
    donor_name: str
    amount: Decimal
    group_id: Optional[int] = None
    group_code: Optional[str] = None
    group_name: Optional[str] = None
    payment_method: str
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    recorded_by_id: int
    recorded_by_name: Optional[str] = None
    status: str
    cancelled_at: Optional[datetime] = None
    cancelled_by_id: Optional[int] = None
    cancelled_by_name: Optional[str] = None
    cancel_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DonationPaymentMethodSummary(BaseModel):
    payment_method: str
    total_amount: Decimal
    transaction_count: int

class DonationPeriodicSummary(BaseModel):
    period: str
    total_amount: Decimal
    transaction_count: int

class DonationReportSummary(BaseModel):
    total_amount: Decimal
    total_transactions: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    by_payment_method: List[DonationPaymentMethodSummary] = []
    periodic_summary: List[DonationPeriodicSummary] = []

# Sadaqah schemas
class SadaqahAllocationCreate(BaseModel):
    group_id: int
    amount: Decimal = Field(..., gt=0, decimal_places=2)

class SadaqahCreate(BaseModel):
    beneficiary_id: int
    sadaqah_date: date
    total_amount: Decimal = Field(..., gt=0, decimal_places=2)
    allocations: List[SadaqahAllocationCreate] = Field(..., min_items=1)
    purpose: Optional[str] = Field(None, max_length=255)
    notes: Optional[str] = None

class SadaqahCancelRequest(BaseModel):
    cancel_reason: str = Field(..., min_length=1, max_length=500)

class SadaqahAllocationOut(BaseModel):
    id: int
    group_id: int
    group_code: str
    group_name: str
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True

class SadaqahBeneficiaryOut(BaseModel):
    id: int
    beneficiary_id: str
    name: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True

class SadaqahOut(BaseModel):
    id: int
    sadaqah_id: str
    sadaqah_date: date
    total_amount: Decimal
    purpose: Optional[str] = None
    notes: Optional[str] = None
    status: str
    beneficiary: SadaqahBeneficiaryOut
    allocations: List[SadaqahAllocationOut]
    recorded_by_id: int
    recorded_by_name: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by_id: Optional[int] = None
    cancelled_by_name: Optional[str] = None
    cancel_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ActiveGroupBalanceOut(BaseModel):
    id: int
    code: str
    name: str
    status: str
    available_balance: Decimal
    total_received: Decimal
    total_spent: Decimal

class SadaqahGroupDistribution(BaseModel):
    group_id: int
    group_code: str
    group_name: str
    total_amount: Decimal
    percentage: float
    transaction_count: int

class SadaqahBeneficiaryDistribution(BaseModel):
    beneficiary_id: int
    beneficiary_code: str
    beneficiary_name: str
    total_amount: Decimal
    transaction_count: int

class SadaqahPeriodicSummary(BaseModel):
    period: str
    total_amount: Decimal
    transaction_count: int

class SadaqahReportSummary(BaseModel):
    total_amount_distributed: Decimal
    total_transactions: int
    average_amount: Decimal
    cancelled_count: int
    cancelled_amount: Decimal
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    by_group: List[SadaqahGroupDistribution] = []
    by_beneficiary: List[SadaqahBeneficiaryDistribution] = []
    periodic_summary: List[SadaqahPeriodicSummary] = []

# ==========================================
# Qard Hasan (Interest-Free Loan) Schemas
# ==========================================

class QardHasanFundingAllocationCreate(BaseModel):
    group_id: int
    amount: Decimal = Field(..., gt=0, decimal_places=2)

class QardHasanScheduleCreate(BaseModel):
    installment_number: int
    due_date: date
    principal_due: Decimal = Field(..., gt=0, decimal_places=2)

class QardHasanCreate(BaseModel):
    beneficiary_id: int
    loan_date: date
    principal_amount: Decimal = Field(..., gt=0, decimal_places=2)
    repayment_arrangement: str = Field(..., pattern=r"^(One-time|Installments)$")
    allocations: List[QardHasanFundingAllocationCreate] = Field(..., min_items=1)
    first_due_date: Optional[date] = None
    expected_completion_date: Optional[date] = None
    schedules: Optional[List[QardHasanScheduleCreate]] = None
    purpose: Optional[str] = Field(None, max_length=255)
    internal_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class QardHasanCancelRequest(BaseModel):
    cancel_reason: str = Field(..., min_length=1, max_length=500)

class QardHasanFundingAllocationOut(BaseModel):
    id: int
    group_id: int
    group_code: str
    group_name: str
    amount: Decimal
    created_at: datetime

    class Config:
        from_attributes = True

class QardHasanScheduleOut(BaseModel):
    id: int
    installment_number: int
    due_date: date
    principal_due: Decimal
    principal_paid: Decimal
    status: str
    is_overdue: bool = False

    class Config:
        from_attributes = True

class QardHasanRepaymentGroupAllocationCreate(BaseModel):
    group_id: int
    amount: Decimal = Field(..., gt=0, decimal_places=2)

class QardHasanRepaymentGroupAllocationOut(BaseModel):
    id: int
    group_id: int
    group_code: str
    group_name: str
    amount: Decimal

    class Config:
        from_attributes = True

class QardHasanRepaymentCreate(BaseModel):
    loan_id: int
    repayment_date: date
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    payment_method: str = Field(..., min_length=1, max_length=50)
    allocations: List[QardHasanRepaymentGroupAllocationCreate] = Field(..., min_items=1)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class QardHasanRepaymentOut(BaseModel):
    id: int
    receipt_id: str
    loan_id: int
    loan_code: str
    beneficiary_id: int
    beneficiary_code: str
    beneficiary_name: str
    repayment_date: date
    amount: Decimal
    payment_method: str
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    recorded_by_id: int
    recorded_by_name: Optional[str] = None
    allocations: List[QardHasanRepaymentGroupAllocationOut] = []
    created_at: datetime

    class Config:
        from_attributes = True

class QardHasanOut(BaseModel):
    id: int
    loan_id: str
    loan_date: date
    principal_amount: Decimal
    amount_repaid: Decimal
    outstanding_principal: Decimal
    repayment_arrangement: str
    first_due_date: Optional[date] = None
    expected_completion_date: Optional[date] = None
    next_due_date: Optional[date] = None
    purpose: Optional[str] = None
    internal_reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    beneficiary: SadaqahBeneficiaryOut
    funding_allocations: List[QardHasanFundingAllocationOut] = []
    schedules: List[QardHasanScheduleOut] = []
    repayments: List[QardHasanRepaymentOut] = []
    recorded_by_id: int
    recorded_by_name: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by_id: Optional[int] = None
    cancelled_by_name: Optional[str] = None
    cancel_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class QardHasanGroupDisbursement(BaseModel):
    group_id: int
    group_code: str
    group_name: str
    total_disbursed: Decimal
    transaction_count: int

class QardHasanGroupRepayment(BaseModel):
    group_id: int
    group_code: str
    group_name: str
    total_repaid: Decimal
    transaction_count: int

class QardHasanBeneficiarySummary(BaseModel):
    beneficiary_id: int
    beneficiary_code: str
    beneficiary_name: str
    total_principal: Decimal
    total_repaid: Decimal
    outstanding_principal: Decimal
    loan_count: int
    active_loans: int

class QardHasanReportSummary(BaseModel):
    total_principal_disbursed: Decimal
    total_principal_repaid: Decimal
    total_outstanding_principal: Decimal
    total_overdue_principal: Decimal
    active_loans_count: int
    fully_repaid_loans_count: int
    cancelled_loans_count: int
    total_loans_count: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    disbursements_by_group: List[QardHasanGroupDisbursement] = []
    repayments_by_group: List[QardHasanGroupRepayment] = []
    beneficiary_balances: List[QardHasanBeneficiarySummary] = []

# ==========================================
# Monthly Contribution Schemas
# ==========================================

class ContributionSettingOut(BaseModel):
    id: int
    monthly_amount: Decimal
    currency: str
    effective_from: date
    is_collection_enabled: bool = True
    updated_by_id: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ContributionSettingUpdate(BaseModel):
    monthly_amount: Decimal = Field(..., gt=0, decimal_places=2)
    currency: Optional[str] = "BDT"
    effective_from: Optional[date] = None

class SingleMemberContributionCreate(BaseModel):
    member_id: int
    contribution_year: int = Field(..., ge=2000, le=2100)
    months: List[int] = Field(..., min_items=1)
    monthly_amount: Optional[Decimal] = None
    total_amount: Decimal = Field(..., gt=0, decimal_places=2)
    payment_date: date
    payment_method: str = Field(..., min_length=1, max_length=50)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class BatchMemberItem(BaseModel):
    member_id: int
    months: List[int] = Field(..., min_items=1)

class BatchMemberContributionCreate(BaseModel):
    items: List[BatchMemberItem] = Field(..., min_items=1)
    contribution_year: int = Field(..., ge=2000, le=2100)
    payment_date: date
    payment_method: str = Field(..., min_length=1, max_length=50)
    notes: Optional[str] = None

class ContributionCancelRequest(BaseModel):
    cancel_reason: str = Field(..., min_length=1, max_length=500)

class ContributionMonthAllocationOut(BaseModel):
    id: int
    month: int
    year: int
    amount: Decimal
    status: str
    month_name: Optional[str] = None

    class Config:
        from_attributes = True

class MemberContributionOut(BaseModel):
    id: int
    receipt_id: str
    member_id: int
    member_code: str
    member_name: str
    group_id: int
    group_code: str
    group_name: str
    contribution_year: int
    paid_months: List[int] = []
    total_amount: Decimal
    payment_date: date
    payment_method: str
    transaction_reference: Optional[str] = None
    batch_reference: Optional[str] = None
    notes: Optional[str] = None
    status: str
    recorded_by_id: int
    recorded_by_name: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    cancelled_by_id: Optional[int] = None
    cancelled_by_name: Optional[str] = None
    cancel_reason: Optional[str] = None
    month_allocations: List[ContributionMonthAllocationOut] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class DueMemberOut(BaseModel):
    member_id: int
    member_code: str
    member_name: str
    group_id: int
    group_code: str
    group_name: str
    monthly_amount: Decimal
    paid_months: List[int] = []
    due_months: List[int] = []
    due_months_count: Optional[int] = 0
    paid_months_count: Optional[int] = 0
    due_month_names: Optional[List[str]] = []
    paid_month_names: Optional[List[str]] = []
    total_due_amount: Optional[Decimal] = None
    outstanding_due_amount: Decimal
    last_payment_date: Optional[date] = None
    joining_date: Optional[date] = None

class ContributionGroupSummary(BaseModel):
    group_id: int
    group_code: str
    group_name: str
    total_amount: Decimal
    receipt_count: int
    member_count: int

class ContributionMonthSummary(BaseModel):
    month: int
    month_name: str
    total_amount: Decimal
    receipt_count: int

class ContributionReportSummary(BaseModel):
    total_collected: Decimal
    total_receipts: int
    unique_members_paid: int
    total_outstanding_dues: Decimal
    advance_collections_amount: Decimal
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    by_group: List[ContributionGroupSummary] = []
    by_month: List[ContributionMonthSummary] = []
    total_advance_collected: Optional[Decimal] = None
    total_due_outstanding: Optional[Decimal] = None
    group_summaries: Optional[List[dict]] = None
    monthly_summaries: Optional[List[dict]] = None

# ==========================================
# Settings & Configuration Schemas
# ==========================================

class PublicSettingsOut(BaseModel):
    foundation_name: str
    foundation_short_name: Optional[str] = None
    foundation_logo: Optional[str] = None
    foundation_logo_public_id: Optional[str] = None
    tagline: Optional[str] = None
    app_display_name: str
    currency_code: str
    currency_symbol: str
    date_format: str
    time_zone: str
    default_language: str
    is_collection_enabled: bool = True
    monthly_amount: Optional[Decimal] = None

class FoundationProfileUpdate(BaseModel):
    foundation_name: str = Field(..., min_length=1, max_length=255)
    foundation_short_name: Optional[str] = Field(None, max_length=50)
    foundation_logo: Optional[str] = None
    foundation_logo_public_id: Optional[str] = None
    tagline: Optional[str] = Field(None, max_length=255)
    registration_number: Optional[str] = Field(None, max_length=100)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=50)
    phone_secondary: Optional[str] = Field(None, max_length=50)
    address: Optional[str] = Field(None, max_length=255)
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=50)
    country: str = Field("Bangladesh", max_length=100)
    website_url: Optional[str] = Field(None, max_length=255)
    about: Optional[str] = None

class FinancialSettingsUpdate(BaseModel):
    currency_code: str = Field(..., min_length=1, max_length=10)
    currency_symbol: str = Field(..., min_length=1, max_length=10)
    decimal_precision: int = Field(2, ge=0, le=4)
    date_format: str = Field(..., min_length=1, max_length=30)
    payment_methods: str = Field(..., min_length=1)
    fiscal_year_start_month: int = Field(1, ge=1, le=12)
    require_transaction_reference: bool = False

class IdPrefixSettingsUpdate(BaseModel):
    group_prefix: str = Field(..., min_length=1, max_length=20)
    member_prefix: str = Field(..., min_length=1, max_length=20)
    beneficiary_prefix: str = Field(..., min_length=1, max_length=20)
    donation_prefix: str = Field(..., min_length=1, max_length=20)
    sadaqah_prefix: str = Field(..., min_length=1, max_length=20)
    qard_hasan_prefix: str = Field(..., min_length=1, max_length=20)
    contribution_prefix: str = Field(..., min_length=1, max_length=20)
    default_member_status: str = Field("Active", max_length=20)
    default_group_status: str = Field("Active", max_length=20)

class OrganizationSettingsUpdate(BaseModel):
    app_display_name: str = Field(..., min_length=1, max_length=255)
    default_language: str = Field("en", max_length=10)
    time_zone: str = Field("Asia/Dhaka", max_length=50)
    receipt_footer_text: Optional[str] = None
    report_header_text: Optional[str] = None
    report_footer_text: Optional[str] = None

class ContributionSettingFullUpdate(BaseModel):
    monthly_amount: Decimal = Field(..., gt=0, decimal_places=2)
    currency: Optional[str] = "BDT"
    effective_from: Optional[date] = None
    is_collection_enabled: bool = True

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)
    confirm_password: str = Field(..., min_length=6)

class FullSettingsOut(BaseModel):
    id: int
    foundation_name: str
    foundation_short_name: Optional[str] = None
    foundation_logo: Optional[str] = None
    foundation_logo_public_id: Optional[str] = None
    tagline: Optional[str] = None
    registration_number: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    phone_secondary: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    country: str
    website_url: Optional[str] = None
    about: Optional[str] = None
    
    currency_code: str
    currency_symbol: str
    decimal_precision: int
    date_format: str
    payment_methods: str
    fiscal_year_start_month: int
    require_transaction_reference: bool

    group_prefix: str
    member_prefix: str
    beneficiary_prefix: str
    donation_prefix: str
    sadaqah_prefix: str
    qard_hasan_prefix: str
    contribution_prefix: str
    default_member_status: str
    default_group_status: str

    app_display_name: str
    default_language: str
    time_zone: str
    receipt_footer_text: Optional[str] = None
    report_header_text: Optional[str] = None
    report_footer_text: Optional[str] = None

    updated_by_id: Optional[int] = None
    updated_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    contribution_setting: Optional[ContributionSettingOut] = None

    class Config:
        from_attributes = True

# ==========================================
# Media & Cloudinary Schemas
# ==========================================

class MediaUploadOut(BaseModel):
    public_id: str
    secure_url: str
    format: str
    bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    folder: str
    purpose: str

    class Config:
        from_attributes = True

class MediaAssetOut(BaseModel):
    id: int
    public_id: str
    secure_url: str
    folder: str
    format: str
    bytes: int
    width: Optional[int] = None
    height: Optional[int] = None
    purpose: str
    uploaded_by_id: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MediaStatusOut(BaseModel):
    configured: bool
    cloud_name: Optional[str] = None

# ==========================================
# Foundation Posts Schemas
# ==========================================

class FoundationPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    featured_image_url: Optional[str] = None
    featured_image_public_id: Optional[str] = None
    status: Optional[str] = Field("draft", pattern="^(draft|published|archived)$")

class FoundationPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    featured_image_url: Optional[str] = None
    featured_image_public_id: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(draft|published|archived)$")

class FoundationPostOut(BaseModel):
    id: int
    title: str
    content: str
    featured_image_url: Optional[str] = None
    featured_image_public_id: Optional[str] = None
    status: str
    created_by_id: Optional[int] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True



