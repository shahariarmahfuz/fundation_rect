import pytest
from fastapi.testclient import TestClient
from decimal import Decimal
from datetime import date, timedelta
import uuid

from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import (
    Group, Beneficiary, GroupFundTransaction, BeneficiaryLedger,
    QardHasan, QardHasanFundingAllocation, QardHasanRepaymentSchedule,
    QardHasanRepayment, QardHasanRepaymentGroupAllocation
)

client = TestClient(app)

ADMIN_HEADERS = {"X-User": "admin"}
FINANCE_HEADERS = {"X-User": "finance"}
VIEWER_HEADERS = {"X-User": "viewer"}


@pytest.fixture
def test_setup():
    """Sets up fresh test groups with funds and an active beneficiary."""
    db = SessionLocal()
    try:
        # Create 2 unique active groups
        uid = uuid.uuid4().hex[:6].upper()
        g1 = Group(name=f"QH Lending Group 1 {uid}", code=f"G-QH1-{uid}", status="Active")
        g2 = Group(name=f"QH Lending Group 2 {uid}", code=f"G-QH2-{uid}", status="Active")
        db.add_all([g1, g2])
        db.flush()

        # Deposit funds into groups
        tx1 = GroupFundTransaction(
            reference=f"DEP-1-{uid}",
            group_id=g1.id,
            transaction_date=date.today(),
            transaction_type="Received",
            amount=Decimal("10000.00"),
            description="Initial capital deposit"
        )
        tx2 = GroupFundTransaction(
            reference=f"DEP-2-{uid}",
            group_id=g2.id,
            transaction_date=date.today(),
            transaction_type="Received",
            amount=Decimal("5000.00"),
            description="Initial capital deposit"
        )
        db.add_all([tx1, tx2])

        # Create active beneficiary
        b = Beneficiary(
            beneficiary_id=f"B-QH-{uid}",
            name=f"Borrower Beneficiary {uid}",
            phone="01700000000",
            status="Active"
        )
        db.add(b)
        db.commit()
        db.refresh(g1)
        db.refresh(g2)
        db.refresh(b)

        yield {"group1": g1, "group2": g2, "beneficiary": b}
    finally:
        db.close()


def test_rbac_qard_hasan_permissions():
    """Criteria 15: Verify role-based permissions and unauthorized API rejection."""
    # 1. Unauthenticated request rejected with 401
    res = client.get("/api/qard-hasan", headers={"X-User": "invalid_user"})
    assert res.status_code == 401

    # 2. Viewer lacks qard_hasan.create
    res = client.post("/api/qard-hasan", json={"beneficiary_id": 1}, headers=VIEWER_HEADERS)
    assert res.status_code == 403
    assert "qard_hasan.create" in res.json()["detail"]

    # 3. Viewer lacks qard_hasan.repayment.create
    res = client.post("/api/qard-hasan/repayments", json={"loan_id": 1}, headers=VIEWER_HEADERS)
    assert res.status_code == 403
    assert "qard_hasan.repayment.create" in res.json()["detail"]

    # 4. Viewer lacks qard_hasan_reports.view
    res = client.get("/api/qard-hasan/report/summary", headers=VIEWER_HEADERS)
    assert res.status_code == 403
    assert "qard_hasan_reports.view" in res.json()["detail"]


def test_create_interest_free_loan_single_group(test_setup):
    """Criteria 1, 2, 5, 10, 11: Fund loan using one group, verify ledger deductions and zero interest."""
    g1 = test_setup["group1"]
    b = test_setup["beneficiary"]

    payload = {
        "beneficiary_id": b.id,
        "loan_date": str(date.today()),
        "principal_amount": 3000.00,
        "repayment_arrangement": "One-time",
        "expected_completion_date": str(date.today() + timedelta(days=60)),
        "allocations": [
            {"group_id": g1.id, "amount": 3000.00}
        ],
        "purpose": "Small Enterprise Support"
    }

    res = client.post("/api/qard-hasan", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 201
    loan = res.json()

    assert loan["loan_id"].startswith("QH-")
    assert Decimal(str(loan["principal_amount"])) == Decimal("3000.00")
    assert Decimal(str(loan["amount_repaid"])) == Decimal("0.00")
    assert Decimal(str(loan["outstanding_principal"])) == Decimal("3000.00")
    assert loan["status"] == "Active"

    # Verify zero interest: no markup or fee fields exist, total to repay equals exactly principal
    assert "interest" not in loan
    assert Decimal(str(loan["outstanding_principal"])) == Decimal(str(loan["principal_amount"]))

    # Criteria 5 & 10: Check group fund deducted as Spent
    db = SessionLocal()
    g_tx = db.query(GroupFundTransaction).filter(
        GroupFundTransaction.group_id == g1.id,
        GroupFundTransaction.reference == loan["loan_id"]
    ).first()
    assert g_tx is not None
    assert g_tx.transaction_type == "Spent"
    assert Decimal(str(g_tx.amount)) == Decimal("3000.00")

    # Check beneficiary ledger disbursed
    b_entry = db.query(BeneficiaryLedger).filter(
        BeneficiaryLedger.beneficiary_id == b.id,
        BeneficiaryLedger.reference == loan["loan_id"]
    ).first()
    assert b_entry is not None
    assert b_entry.transaction_type == "Disbursed"
    assert Decimal(str(b_entry.amount)) == Decimal("3000.00")
    db.close()


def test_create_loan_multiple_groups(test_setup):
    """Criteria 3, 5: Fund a loan using multiple groups with exact individual allocations."""
    g1 = test_setup["group1"]
    g2 = test_setup["group2"]
    b = test_setup["beneficiary"]

    payload = {
        "beneficiary_id": b.id,
        "loan_date": str(date.today()),
        "principal_amount": 5000.00,
        "repayment_arrangement": "Installments",
        "first_due_date": str(date.today() + timedelta(days=30)),
        "allocations": [
            {"group_id": g1.id, "amount": 3500.00},
            {"group_id": g2.id, "amount": 1500.00}
        ],
        "schedules": [
            {"installment_number": 1, "due_date": str(date.today() + timedelta(days=30)), "principal_due": 2500.00},
            {"installment_number": 2, "due_date": str(date.today() + timedelta(days=60)), "principal_due": 2500.00}
        ]
    }

    res = client.post("/api/qard-hasan", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 201
    loan = res.json()

    assert len(loan["funding_allocations"]) == 2
    assert len(loan["schedules"]) == 2

    # Check each group fund deducted specifically by its individual allocation
    db = SessionLocal()
    tx_g1 = db.query(GroupFundTransaction).filter(
        GroupFundTransaction.group_id == g1.id,
        GroupFundTransaction.reference == loan["loan_id"]
    ).first()
    tx_g2 = db.query(GroupFundTransaction).filter(
        GroupFundTransaction.group_id == g2.id,
        GroupFundTransaction.reference == loan["loan_id"]
    ).first()

    assert Decimal(str(tx_g1.amount)) == Decimal("3500.00")
    assert Decimal(str(tx_g2.amount)) == Decimal("1500.00")
    db.close()


def test_reject_loan_insufficient_group_funding(test_setup):
    """Criteria 4: Reject loans when group balance is insufficient."""
    g2 = test_setup["group2"]  # has 5000 balance
    b = test_setup["beneficiary"]

    payload = {
        "beneficiary_id": b.id,
        "loan_date": str(date.today()),
        "principal_amount": 999999.00,
        "repayment_arrangement": "One-time",
        "allocations": [
            {"group_id": g2.id, "amount": 999999.00}
        ]
    }

    res = client.post("/api/qard-hasan", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 400
    assert "Insufficient balance" in res.json()["detail"]


def test_repayments_partial_and_full(test_setup):
    """Criteria 6, 7, 8, 9, 10, 12: Partial and full repayments, outstanding principal, group credits, overpayment rejection."""
    g1 = test_setup["group1"]
    g2 = test_setup["group2"]
    b = test_setup["beneficiary"]

    # 1. Issue loan of 4000
    loan_res = client.post("/api/qard-hasan", json={
        "beneficiary_id": b.id,
        "loan_date": str(date.today()),
        "principal_amount": 4000.00,
        "repayment_arrangement": "Installments",
        "first_due_date": str(date.today() + timedelta(days=30)),
        "allocations": [{"group_id": g1.id, "amount": 4000.00}],
        "schedules": [
            {"installment_number": 1, "due_date": str(date.today() + timedelta(days=30)), "principal_due": 2000.00},
            {"installment_number": 2, "due_date": str(date.today() + timedelta(days=60)), "principal_due": 2000.00}
        ]
    }, headers=ADMIN_HEADERS)
    assert loan_res.status_code == 201
    loan_id = loan_res.json()["id"]

    # 2. Reject overpayment (4500 > 4000) (Criteria 8)
    over_res = client.post("/api/qard-hasan/repayments", json={
        "loan_id": loan_id,
        "repayment_date": str(date.today()),
        "amount": 4500.00,
        "payment_method": "Cash",
        "allocations": [{"group_id": g1.id, "amount": 4500.00}]
    }, headers=ADMIN_HEADERS)
    assert over_res.status_code == 400
    assert "exceeds outstanding principal" in over_res.json()["detail"]

    # 3. Partial repayment of 1500 (Criteria 6, 7)
    repay1_res = client.post("/api/qard-hasan/repayments", json={
        "loan_id": loan_id,
        "repayment_date": str(date.today()),
        "amount": 1500.00,
        "payment_method": "Bank Transfer",
        "allocations": [{"group_id": g1.id, "amount": 1500.00}]
    }, headers=ADMIN_HEADERS)
    assert repay1_res.status_code == 201
    r1 = repay1_res.json()
    assert r1["receipt_id"].startswith("QHR-")

    # Check loan status updated to Partially Repaid and outstanding is 2500
    loan_check1 = client.get(f"/api/qard-hasan/{loan_id}", headers=ADMIN_HEADERS).json()
    assert loan_check1["status"] == "Partially Repaid"
    assert Decimal(str(loan_check1["amount_repaid"])) == Decimal("1500.00")
    assert Decimal(str(loan_check1["outstanding_principal"])) == Decimal("2500.00")

    # 4. Multi-group partial repayment of 1000 into G1 and G2 (Criteria 9)
    repay2_res = client.post("/api/qard-hasan/repayments", json={
        "loan_id": loan_id,
        "repayment_date": str(date.today()),
        "amount": 1000.00,
        "payment_method": "bKash",
        "allocations": [
            {"group_id": g1.id, "amount": 600.00},
            {"group_id": g2.id, "amount": 400.00}
        ]
    }, headers=ADMIN_HEADERS)
    assert repay2_res.status_code == 201

    loan_check2 = client.get(f"/api/qard-hasan/{loan_id}", headers=ADMIN_HEADERS).json()
    assert Decimal(str(loan_check2["amount_repaid"])) == Decimal("2500.00")
    assert Decimal(str(loan_check2["outstanding_principal"])) == Decimal("1500.00")

    # 5. Final full repayment of remaining 1500
    repay3_res = client.post("/api/qard-hasan/repayments", json={
        "loan_id": loan_id,
        "repayment_date": str(date.today()),
        "amount": 1500.00,
        "payment_method": "Cash",
        "allocations": [{"group_id": g1.id, "amount": 1500.00}]
    }, headers=ADMIN_HEADERS)
    assert repay3_res.status_code == 201

    loan_check3 = client.get(f"/api/qard-hasan/{loan_id}", headers=ADMIN_HEADERS).json()
    assert loan_check3["status"] == "Fully Repaid"
    assert Decimal(str(loan_check3["amount_repaid"])) == Decimal("4000.00")
    assert Decimal(str(loan_check3["outstanding_principal"])) == Decimal("0.00")

    # 6. Reject further repayment on Fully Repaid loan (Criteria 12)
    repay4_res = client.post("/api/qard-hasan/repayments", json={
        "loan_id": loan_id,
        "repayment_date": str(date.today()),
        "amount": 500.00,
        "payment_method": "Cash",
        "allocations": [{"group_id": g1.id, "amount": 500.00}]
    }, headers=ADMIN_HEADERS)
    assert repay4_res.status_code == 400
    assert "Cannot record repayment for loan in 'Fully Repaid' status" in repay4_res.json()["detail"]


def test_loan_cancellation_and_reversal(test_setup):
    """Verify loan cancellation restores group funds and reverses beneficiary ledger."""
    g1 = test_setup["group1"]
    b = test_setup["beneficiary"]

    # Issue loan of 2000
    res = client.post("/api/qard-hasan", json={
        "beneficiary_id": b.id,
        "loan_date": str(date.today()),
        "principal_amount": 2000.00,
        "repayment_arrangement": "One-time",
        "allocations": [{"group_id": g1.id, "amount": 2000.00}]
    }, headers=ADMIN_HEADERS)
    loan = res.json()
    loan_id = loan["id"]

    # Cancel loan
    canc_res = client.post(f"/api/qard-hasan/{loan_id}/cancel", json={
        "cancel_reason": "Applicant withdrew request"
    }, headers=ADMIN_HEADERS)
    assert canc_res.status_code == 200
    canc_loan = canc_res.json()
    assert canc_loan["status"] == "Cancelled"

    # Verify reversing transactions exist
    db = SessionLocal()
    rev_g = db.query(GroupFundTransaction).filter(
        GroupFundTransaction.group_id == g1.id,
        GroupFundTransaction.reference == f"REV-{loan['loan_id']}"
    ).first()
    assert rev_g is not None
    assert rev_g.transaction_type == "Received"
    assert Decimal(str(rev_g.amount)) == Decimal("2000.00")

    rev_b = db.query(BeneficiaryLedger).filter(
        BeneficiaryLedger.beneficiary_id == b.id,
        BeneficiaryLedger.reference == f"REV-{loan['loan_id']}"
    ).first()
    assert rev_b is not None
    assert rev_b.transaction_type == "Received"
    assert Decimal(str(rev_b.amount)) == Decimal("2000.00")
    db.close()


def test_report_summary_integrity(test_setup):
    """Criteria 14: Verify reports accurately calculate disbursed, repaid, and outstanding."""
    res = client.get("/api/qard-hasan/report/summary", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    rep = res.json()

    disb = Decimal(str(rep["total_principal_disbursed"]))
    repaid = Decimal(str(rep["total_principal_repaid"]))
    outstanding = Decimal(str(rep["total_outstanding_principal"]))

    assert outstanding == disb - repaid
    assert rep["active_loans_count"] >= 0
    assert rep["fully_repaid_loans_count"] >= 0
    assert isinstance(rep["disbursements_by_group"], list)
    assert isinstance(rep["repayments_by_group"], list)
    assert isinstance(rep["beneficiary_balances"], list)


def test_existing_modules_remain_functional():
    """Criteria 16: Ensure existing Groups, Members, Beneficiaries, Donations, Sadaqah modules remain intact."""
    assert client.get("/api/groups", headers=ADMIN_HEADERS).status_code == 200
    assert client.get("/api/members", headers=ADMIN_HEADERS).status_code == 200
    assert client.get("/api/beneficiaries", headers=ADMIN_HEADERS).status_code == 200
    assert client.get("/api/donations", headers=ADMIN_HEADERS).status_code == 200
    assert client.get("/api/sadaqah", headers=ADMIN_HEADERS).status_code == 200
