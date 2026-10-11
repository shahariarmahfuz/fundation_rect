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
