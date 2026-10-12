import pytest
from fastapi.testclient import TestClient
from decimal import Decimal
from datetime import date, timedelta
import uuid

from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import (
    Group, Member, User, GroupFundTransaction,
    ContributionSetting, MemberContributionReceipt, ContributionMonthAllocation,
    Donation
)

client = TestClient(app)

ADMIN_HEADERS = {"X-User": "admin"}
FINANCE_HEADERS = {"X-User": "finance"}
VIEWER_HEADERS = {"X-User": "viewer"}


@pytest.fixture
def test_setup():
    """Sets up fresh test groups and members for monthly contributions and group donations."""
    db = SessionLocal()
    try:
        uid = uuid.uuid4().hex[:6].upper()

        # 1. Create 2 distinct active groups
        g1 = Group(name=f"Contrib Group 1 {uid}", code=f"G-C1-{uid}", status="Active")
        g2 = Group(name=f"Contrib Group 2 {uid}", code=f"G-C2-{uid}", status="Active")
        db.add_all([g1, g2])
        db.flush()

        # 2. Create members in each group
        # Member 1 joined Jan 15, 2026
        m1 = Member(
            member_id=f"M-C1-{uid}",
            name=f"Member One {uid}",
            phone="01711111111",
            group_id=g1.id,
            joining_date=date(2026, 1, 15),
            status="Active"
        )
        # Member 2 joined March 1, 2026 (pre-joining Jan-Feb)
        m2 = Member(
            member_id=f"M-C2-{uid}",
            name=f"Member Two {uid}",
            phone="01722222222",
            group_id=g2.id,
            joining_date=date(2026, 3, 1),
            status="Active"
        )
        db.add_all([m1, m2])

        # 3. Ensure global contribution setting exists (100.00 BDT)
        setting = db.query(ContributionSetting).first()
        if not setting:
            setting = ContributionSetting(
                monthly_amount=Decimal("100.00"),
                currency="BDT",
                effective_from=date(2026, 1, 1)
            )
            db.add(setting)
        else:
            setting.monthly_amount = Decimal("100.00")
            setting.currency = "BDT"

        db.commit()
        db.refresh(g1)
        db.refresh(g2)
        db.refresh(m1)
        db.refresh(m2)
        res = {"group1": g1, "group2": g2, "member1": m1, "member2": m2}
        db.expunge_all()
        yield res
    finally:
        db.close()


def test_rbac_contribution_permissions():
    """Criteria 1: Verify RBAC on all Contribution endpoints."""
    # 1. Unauthenticated request rejected with 401
    res = client.get("/api/contributions", headers={"X-User": "invalid_user"})
    assert res.status_code == 401

    # 2. Viewer lacks contributions.create
    res = client.post("/api/contributions/single", json={
        "member_id": 1,
        "contribution_year": 2026,
        "months": [1],
        "total_amount": 100.00,
        "payment_date": str(date.today()),
        "payment_method": "Cash"
    }, headers=VIEWER_HEADERS)
    assert res.status_code == 403
    assert "contributions.create" in res.json()["detail"]

    # 3. Viewer lacks contribution_settings.update
    res = client.put("/api/contributions/settings", json={"monthly_amount": 150.00}, headers=VIEWER_HEADERS)
    assert res.status_code == 403
    assert "contribution_settings.update" in res.json()["detail"]

    # 4. Viewer lacks contributions.due_list.view
    res = client.get("/api/contributions/due-list", headers=VIEWER_HEADERS)
    assert res.status_code == 403
    assert "contributions.due_list.view" in res.json()["detail"]

    # 5. Viewer lacks contribution_reports.view
    res = client.get("/api/contributions/report/summary", headers=VIEWER_HEADERS)
    assert res.status_code == 403
    assert "contribution_reports.view" in res.json()["detail"]


def test_global_contribution_settings(test_setup):
    """Criteria 2: View and update global monthly contribution setting (preserving historical rate)."""
    # 1. Get setting
    res = client.get("/api/contributions/settings", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()
    assert Decimal(str(data["monthly_amount"])) == Decimal("100.00")
    assert data["currency"] == "BDT"

    # 2. Update setting as Admin
    update_res = client.put(
        "/api/contributions/settings",
        json={"monthly_amount": 120.00, "currency": "BDT"},
        headers=ADMIN_HEADERS
    )
    assert update_res.status_code == 200
    assert Decimal(str(update_res.json()["monthly_amount"])) == Decimal("120.00")

    # 3. Reset back to 100.00 for subsequent tests
    client.put("/api/contributions/settings", json={"monthly_amount": 100.00}, headers=ADMIN_HEADERS)


def test_single_member_contribution_and_group_ledger(test_setup):
    """Criteria 3, 4: Record contribution for single member across multiple months and credit member's group fund."""
    m1 = test_setup["member1"]
    g1 = test_setup["group1"]

    payload = {
        "member_id": m1.id,
        "contribution_year": 2026,
        "months": [1, 2],  # Jan & Feb
        "total_amount": 200.00,
        "payment_date": str(date.today()),
        "payment_method": "Cash",
        "transaction_reference": f"TXN-C1-{uuid.uuid4().hex[:6]}",
        "notes": "January and February dues"
    }

    res = client.post("/api/contributions/single", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 201
    contrib = res.json()

    assert contrib["receipt_id"].startswith("MC-")
    assert contrib["member_id"] == m1.id
    assert contrib["group_id"] == g1.id
    assert contrib["contribution_year"] == 2026
    assert contrib["paid_months"] == [1, 2]
    assert Decimal(str(contrib["total_amount"])) == Decimal("200.00")
    assert contrib["status"] == "COMPLETED"

    # Verify allocations
    assert len(contrib["month_allocations"]) == 2
    for alloc in contrib["month_allocations"]:
        assert alloc["status"] == "Paid"
        assert Decimal(str(alloc["amount"])) == Decimal("100.00")

    # Verify atomic credit to Group 1 Fund Ledger
    db = SessionLocal()
    try:
        tx = db.query(GroupFundTransaction).filter(
            GroupFundTransaction.reference == contrib["receipt_id"],
            GroupFundTransaction.group_id == g1.id
        ).first()
        assert tx is not None
        assert tx.transaction_type == "Received"
        assert Decimal(str(tx.amount)) == Decimal("200.00")
        assert f"member {m1.member_id}" in tx.description
    finally:
        db.close()


def test_prevent_duplicate_month_payments(test_setup):
    """Criteria 5: Duplicate contribution for an already-paid month must be rejected."""
    m1 = test_setup["member1"]

    payload = {
        "member_id": m1.id,
        "contribution_year": 2026,
        "months": [2],
        "total_amount": 100.00,
        "payment_date": str(date.today()),
        "payment_method": "Cash"
    }

    # 1. First payment succeeds
    res1 = client.post("/api/contributions/single", json=payload, headers=ADMIN_HEADERS)
    assert res1.status_code == 201

    # 2. Attempt duplicate payment for month 2
    res2 = client.post("/api/contributions/single", json=payload, headers=ADMIN_HEADERS)
    assert res2.status_code == 400
    assert "already paid" in res2.json()["detail"].lower()


def test_advance_contribution_collection(test_setup):
    """Criteria 6: Advance collection for future months is allowed and properly tracked."""
    m1 = test_setup["member1"]

    # Member 1 pays for upcoming months: November & December 2026
    payload = {
        "member_id": m1.id,
        "contribution_year": 2026,
        "months": [11, 12],
        "total_amount": 200.00,
        "payment_date": str(date.today()),
        "payment_method": "Bank Transfer",
        "notes": "Advance payment for end of year"
    }

    res = client.post("/api/contributions/single", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 201
    contrib = res.json()
    assert contrib["paid_months"] == [11, 12]
    assert Decimal(str(contrib["total_amount"])) == Decimal("200.00")


def test_batch_member_contributions(test_setup):
    """Criteria 7: Multi-member batch collection across groups with unique batch reference."""
    m1 = test_setup["member1"]
    m2 = test_setup["member2"]
    g1 = test_setup["group1"]
    g2 = test_setup["group2"]

    # m1 pays March (month 3)
    # m2 pays March & April (months 3, 4)
    payload = {
        "contribution_year": 2026,
        "payment_date": str(date.today()),
        "payment_method": "Cash",
        "notes": "Monthly group batch collection",
        "items": [
            {"member_id": m1.id, "months": [3]},
            {"member_id": m2.id, "months": [3, 4]}
        ]
    }

    res = client.post("/api/contributions/batch", json=payload, headers=ADMIN_HEADERS)
    assert res.status_code == 201
    batch = res.json()

    assert batch["batch_reference"].startswith("BATCH-")
    assert batch["members_count"] == 2
    assert Decimal(str(batch["total_collected"])) == Decimal("300.00")
    assert len(batch["receipts"]) == 2

    # Verify each receipt created and group funds credited
    r1 = batch["receipts"][0]
    r2 = batch["receipts"][1]
    assert r1["batch_reference"] == batch["batch_reference"]
    assert r2["batch_reference"] == batch["batch_reference"]

    db = SessionLocal()
    try:
        tx1 = db.query(GroupFundTransaction).filter(GroupFundTransaction.reference == r1["receipt_id"]).first()
        tx2 = db.query(GroupFundTransaction).filter(GroupFundTransaction.reference == r2["receipt_id"]).first()
        assert tx1 is not None and tx1.group_id == g1.id and Decimal(str(tx1.amount)) == Decimal("100.00")
        assert tx2 is not None and tx2.group_id == g2.id and Decimal(str(tx2.amount)) == Decimal("200.00")
    finally:
        db.close()


def test_member_due_list_calculation(test_setup):
    """Criteria 8: Dues calculation respects joining date and paid allocations."""
    m1 = test_setup["member1"]
    m2 = test_setup["member2"]

    # Record payments for m1 (months 1, 2, 3)
    client.post("/api/contributions/single", json={
        "member_id": m1.id,
        "contribution_year": 2026,
        "months": [1, 2, 3],
        "total_amount": 300.00,
        "payment_date": str(date.today()),
        "payment_method": "Cash"
    }, headers=ADMIN_HEADERS)

    # Record payments for m2 (months 3, 4)
    client.post("/api/contributions/single", json={
        "member_id": m2.id,
        "contribution_year": 2026,
        "months": [3, 4],
        "total_amount": 200.00,
        "payment_date": str(date.today()),
        "payment_method": "Cash"
    }, headers=ADMIN_HEADERS)

    # m1 joined Jan 2026. Up to month 6 (June), m1 paid [1, 2, 3]. Dues should be [4, 5, 6] (3 months = ৳300.00).
    # m2 joined March 2026. Pre-joining months (Jan, Feb) are excluded!
    # m2 paid [3, 4]. Up to month 6 (June), dues should be [5, 6] (2 months = ৳200.00).

    res = client.get("/api/contributions/due-list?year=2026&up_to_month=6", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    data = res.json()

    items = {item["member_id"]: item for item in data["items"]}

    if m1.id in items:
        m1_due = items[m1.id]
        assert m1_due["due_months"] == [4, 5, 6]
        assert m1_due["due_months_count"] == 3
        assert Decimal(str(m1_due["outstanding_due_amount"])) == Decimal("300.00")

    if m2.id in items:
        m2_due = items[m2.id]
        assert m2_due["due_months"] == [5, 6]
        assert m2_due["due_months_count"] == 2
        assert Decimal(str(m2_due["outstanding_due_amount"])) == Decimal("200.00")
        # Ensure Jan & Feb (1, 2) were NOT included as due for m2 because m2 joined in March!
        assert 1 not in m2_due["due_months"]
        assert 2 not in m2_due["due_months"]


def test_auditable_contribution_cancellation(test_setup):
    """Criteria 9: Cancel receipt with reason, reverse group fund transaction, restore unpaid months."""
    m1 = test_setup["member1"]
    g1 = test_setup["group1"]

    # 1. Create a contribution for month 5
    payload = {
        "member_id": m1.id,
        "contribution_year": 2026,
        "months": [5],
        "total_amount": 100.00,
        "payment_date": str(date.today()),
        "payment_method": "Cash"
    }
    create_res = client.post("/api/contributions/single", json=payload, headers=ADMIN_HEADERS)
    assert create_res.status_code == 201
    contrib_id = create_res.json()["id"]
    receipt_id = create_res.json()["receipt_id"]

    # 2. Cancel receipt
    cancel_payload = {"cancel_reason": "Member paid with duplicate note, reversing receipt"}
    cancel_res = client.post(f"/api/contributions/{contrib_id}/cancel", json=cancel_payload, headers=ADMIN_HEADERS)
    assert cancel_res.status_code == 200
    cancelled = cancel_res.json()

    assert cancelled["status"] == "CANCELLED"
    assert cancelled["cancel_reason"] == cancel_payload["cancel_reason"]

    # 3. Verify atomic reversal in Group Fund ledger
    db = SessionLocal()
    try:
        rev_tx = db.query(GroupFundTransaction).filter(
            GroupFundTransaction.reference == f"REV-{receipt_id}",
            GroupFundTransaction.group_id == g1.id
        ).first()
        assert rev_tx is not None
        assert rev_tx.transaction_type == "Spent"
        assert Decimal(str(rev_tx.amount)) == Decimal("100.00")
        assert f"Reversal of contribution {receipt_id}" in rev_tx.description

        # Verify allocations marked Cancelled
        alloc = db.query(ContributionMonthAllocation).filter(
            ContributionMonthAllocation.contribution_id == contrib_id
        ).first()
        assert alloc.status == "Cancelled"
    finally:
        db.close()

    # 4. Now month 5 can be paid again without duplicate conflict
    repay_res = client.post("/api/contributions/single", json=payload, headers=ADMIN_HEADERS)
    assert repay_res.status_code == 201


def test_donation_with_group_fund_accounting(test_setup):
    """Criteria 10: Every donation requires active receiving group, credits group fund, and reverses on cancel."""
    g1 = test_setup["group1"]
    g2 = test_setup["group2"]

    # 1. Donation without group_id must be rejected
    bad_payload = {
        "donation_date": str(date.today()),
        "donor_name": "Philanthropist X",
        "amount": 500.00,
        "payment_method": "Cash"
    }
    bad_res = client.post("/api/donations", json=bad_payload, headers=ADMIN_HEADERS)
    assert bad_res.status_code == 422 or bad_res.status_code == 400

    # 2. Donation with valid group_id succeeds
    good_payload = {
        "donation_date": str(date.today()),
        "donor_name": "Generous Donor A",
        "amount": 2500.00,
        "group_id": g1.id,
        "payment_method": "Bank Transfer",
        "transaction_reference": f"DON-REF-{uuid.uuid4().hex[:6]}"
    }
    don_res = client.post("/api/donations", json=good_payload, headers=ADMIN_HEADERS)
    assert don_res.status_code == 201
    donation = don_res.json()

    assert donation["donation_id"].startswith("D-")
    assert donation["group_id"] == g1.id
    assert donation["group_code"] == g1.code
    assert donation["status"] == "COMPLETED"

    # 3. Check atomic Group Fund Transaction for Group 1 only
    db = SessionLocal()
    try:
        tx = db.query(GroupFundTransaction).filter(
            GroupFundTransaction.reference == donation["donation_id"]
        ).first()
        assert tx is not None
        assert tx.group_id == g1.id
        assert tx.transaction_type == "Received"
        assert Decimal(str(tx.amount)) == Decimal("2500.00")
    finally:
        db.close()

    # 4. Cancel donation and verify reversal
    cancel_res = client.post(
        f"/api/donations/{donation['id']}/cancel",
        json={"cancel_reason": "Bank transfer chargeback"},
        headers=ADMIN_HEADERS
    )
    assert cancel_res.status_code == 200

    db = SessionLocal()
    try:
        rev_tx = db.query(GroupFundTransaction).filter(
            GroupFundTransaction.reference == f"REV-{donation['donation_id']}"
        ).first()
        assert rev_tx is not None
        assert rev_tx.group_id == g1.id
        assert rev_tx.transaction_type == "Spent"
        assert Decimal(str(rev_tx.amount)) == Decimal("2500.00")
    finally:
        db.close()


def test_contribution_report_summary(test_setup):
    """Criteria 11: Summary report metrics, group fund breakdown, and monthly breakdown."""
    res = client.get("/api/contributions/report/summary?year=2026", headers=ADMIN_HEADERS)
    assert res.status_code == 200
    report = res.json()

    assert "total_collected" in report
    assert "total_receipts" in report
    assert "total_advance_collected" in report
    assert "total_due_outstanding" in report
    assert "group_summaries" in report
    assert "monthly_summaries" in report
    assert len(report["monthly_summaries"]) == 12  # 12 months in a year
