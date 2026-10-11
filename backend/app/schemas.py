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
    payment_method: str = Field(..., min_length=1, max_length=50)
    transaction_reference: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

class DonationUpdate(BaseModel):
    donation_date: Optional[date] = None
    donor_name: Optional[str] = Field(None, min_length=1, max_length=150)
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
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
