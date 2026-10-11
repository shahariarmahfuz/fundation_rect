import pytest
from fastapi.testclient import TestClient
from decimal import Decimal
from backend.app.main import app
from backend.app.database import SessionLocal
from backend.app.models import Group, Member, Beneficiary, GroupFundTransaction, BeneficiaryLedger

client = TestClient(app)

def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_rbac_authentication_and_authorization():
    # 1. Unauthenticated / invalid user returns 401
    res = client.get("/api/groups", headers={"X-User": "nonexistent_user"})
    assert res.status_code == 401

    # 2. Viewer trying to create group returns 403 (missing groups.create)
    res = client.post("/api/groups", json={"name": "Forbidden Group"}, headers={"X-User": "viewer"})
    assert res.status_code == 403
    assert "groups.create" in res.json()["detail"]

    # 3. Viewer trying to view group funds returns 403 (missing group_funds.view)
    res = client.get("/api/groups/funds/summary", headers={"X-User": "viewer"})
    assert res.status_code == 403
    assert "group_funds.view" in res.json()["detail"]

    # 4. Viewer trying to create member returns 403 (missing members.create)
    res = client.post("/api/members", json={"name": "Forbidden Member", "group_id": 1}, headers={"X-User": "viewer"})
    assert res.status_code == 403
    assert "members.create" in res.json()["detail"]

    # 5. Viewer trying to create beneficiary returns 403 (missing beneficiaries.create)
    res = client.post("/api/beneficiaries", json={"name": "Forbidden Beneficiary"}, headers={"X-User": "viewer"})
    assert res.status_code == 403
    assert "beneficiaries.create" in res.json()["detail"]

def test_group_creation_and_automatic_code():
    # 1. Create group with automatic sequential code
    res = client.post(
        "/api/groups",
        json={"name": "Automated Code Test Group", "description": "Testing G-XXXX generation"},
        headers={"X-User": "admin"}
    )
    assert res.status_code == 201
    group_data = res.json()
    assert group_data["name"] == "Automated Code Test Group"
    assert group_data["code"].startswith("G-")
    assert len(group_data["code"]) >= 6  # e.g. G-0004

    # 2. Create group with authorized custom code
    import uuid
    custom_code = f"G-CUST-{uuid.uuid4().hex[:5].upper()}"
    res_custom = client.post(
        "/api/groups",
        json={"name": "Custom Code Group", "code": custom_code},
        headers={"X-User": "admin"}
    )
    assert res_custom.status_code == 201
    assert res_custom.json()["code"] == custom_code

    # 3. Duplicate custom code should be rejected with 400
    res_dup = client.post(
        "/api/groups",
        json={"name": "Duplicate Code Group", "code": custom_code},
        headers={"X-User": "admin"}
    )
    assert res_dup.status_code == 400
    assert "already exists" in res_dup.json()["detail"]

def test_group_management_and_status():
    # 1. List groups
    res = client.get("/api/groups", headers={"X-User": "admin"})
    assert res.status_code == 200
    assert res.json()["total"] > 0

    # 2. Deactivate / Activate group
    group_id = res.json()["items"][0]["id"]
    current_status = res.json()["items"][0]["status"]
    
    toggle_res = client.post(f"/api/groups/{group_id}/status", headers={"X-User": "admin"})
    assert toggle_res.status_code == 200
    new_status = toggle_res.json()["status"]
    assert new_status != current_status

    # Toggle back to Active
    toggle_res2 = client.post(f"/api/groups/{group_id}/status", headers={"X-User": "admin"})
    assert toggle_res2.status_code == 200
    assert toggle_res2.json()["status"] == current_status

def test_member_creation_and_sequential_id():
    # Get an active group
    groups_res = client.get("/api/groups?status=Active", headers={"X-User": "admin"})
    active_group = groups_res.json()["items"][0]

    # 1. Create member - Member ID must be generated automatically
    payload = {
        "name": "Kamal Hossain",
        "group_id": active_group["id"],
        "phone": "+8801700112233",
        "notes": "Test member creation"
    }
    res = client.post("/api/members", json=payload, headers={"X-User": "admin"})
    assert res.status_code == 201
    member = res.json()
    assert member["name"] == "Kamal Hossain"
    assert member["member_id"].startswith("M-")
    assert member["group_id"] == active_group["id"]
    assert member["group_name"] == active_group["name"]

    # 2. Attempting to create member with non-existent group fails
    res_bad_group = client.post("/api/members", json={"name": "Bad Group Member", "group_id": 999999}, headers={"X-User": "admin"})
    assert res_bad_group.status_code == 400

    # 3. Create second member and verify sequential uniqueness
    res2 = client.post("/api/members", json={"name": "Nasreen Akter", "group_id": active_group["id"]}, headers={"X-User": "admin"})
    assert res2.status_code == 201
    member2 = res2.json()
    assert member2["member_id"].startswith("M-")
    assert member2["member_id"] != member["member_id"]

def test_member_cannot_modify_member_id():
    # Fetch members
    res = client.get("/api/members", headers={"X-User": "admin"})
    member = res.json()["items"][0]

    # Patch member name
    patch_res = client.patch(
        f"/api/members/{member['id']}",
        json={"name": "Updated Kamal Hossain", "phone": "+8801799887766"},
        headers={"X-User": "admin"}
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "Updated Kamal Hossain"
    # Member ID remains strictly immutable
    assert patch_res.json()["member_id"] == member["member_id"]

def test_member_due_list_financial_integrity():
    # Dues must NOT be fabricated or assumed
    res = client.get("/api/members/due-list", headers={"X-User": "admin"})
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert len(data["items"]) > 0
    first_item = data["items"][0]
    # due_amount is None (not fabricated)
    assert first_item["due_amount"] is None
    assert first_item["has_ledger"] is False
    assert "will be calculated once the contribution and dues modules are implemented" in first_item["note"]

def test_beneficiary_creation_and_sequential_id():
    # 1. Beneficiary created without user ID input
    payload = {
        "name": "Fatema Khatun",
        "phone": "+8801811223344",
        "address": "Sonargaon, Narayanganj",
        "notes": "Medical assistance beneficiary"
    }
    res = client.post("/api/beneficiaries", json=payload, headers={"X-User": "admin"})
    assert res.status_code == 201
    b = res.json()
    assert b["name"] == "Fatema Khatun"
    assert b["beneficiary_id"].startswith("B-")

    # 2. Second beneficiary has unique sequential ID
    res2 = client.post("/api/beneficiaries", json={"name": "Abdul Malek"}, headers={"X-User": "admin"})
    assert res2.status_code == 201
    b2 = res2.json()
    assert b2["beneficiary_id"].startswith("B-")
    assert b2["beneficiary_id"] != b["beneficiary_id"]

def test_beneficiary_ledger_running_balances_and_integrity():
    # Get beneficiary
    res = client.get("/api/beneficiaries", headers={"X-User": "admin"})
    b = res.json()["items"][0]

    # 1. Initially empty ledger has zero balances
    ledger_empty = client.get(f"/api/beneficiaries/{b['id']}/ledger", headers={"X-User": "admin"})
    assert ledger_empty.status_code == 200
    data_empty = ledger_empty.json()
    assert Decimal(str(data_empty["total_received"])) == Decimal("0.00")
    assert Decimal(str(data_empty["total_disbursed"])) == Decimal("0.00")
    assert Decimal(str(data_empty["current_balance"])) == Decimal("0.00")

    # 2. Record legitimate grant receipt: $500.00
    tx1_res = client.post(
        f"/api/beneficiaries/{b['id']}/ledger?transaction_type=Received&amount=500.00&description=Family+Welfare+Grant",
        headers={"X-User": "admin"}
    )
    assert tx1_res.status_code == 201

    # 3. Record legitimate assistance disbursement: $150.00
    tx2_res = client.post(
        f"/api/beneficiaries/{b['id']}/ledger?transaction_type=Disbursed&amount=150.00&description=Healthcare+Assistance",
        headers={"X-User": "admin"}
    )
    assert tx2_res.status_code == 201

    # 4. Fetch ledger and verify chronological running balances
    ledger_after = client.get(f"/api/beneficiaries/{b['id']}/ledger", headers={"X-User": "admin"})
    assert ledger_after.status_code == 200
    data_after = ledger_after.json()
    assert Decimal(str(data_after["total_received"])) == Decimal("500.00")
    assert Decimal(str(data_after["total_disbursed"])) == Decimal("150.00")
    assert Decimal(str(data_after["current_balance"])) == Decimal("350.00")  # 500 - 150 = 350
    assert len(data_after["entries"]) == 2

def test_group_funds_ledger_and_integrity():
    # Get first group
    res = client.get("/api/groups", headers={"X-User": "admin"})
    g = res.json()["items"][0]

    # Record group fund transaction
    tx_res = client.post(
        f"/api/groups/{g['id']}/funds/transaction?transaction_type=Received&amount=1200.00&description=Community+Development+Grant",
        headers={"X-User": "admin"}
    )
    assert tx_res.status_code == 201

    # Verify summary calculation
    summary_res = client.get("/api/groups/funds/summary", headers={"X-User": "admin"})
    assert summary_res.status_code == 200
    summaries = summary_res.json()
    group_summary = next(s for s in summaries if s["id"] == g["id"])
    assert Decimal(str(group_summary["total_received"])) >= Decimal("1200.00")
    assert Decimal(str(group_summary["available_balance"])) >= Decimal("1200.00")
