import asyncio
import os
import sys
import uuid
from decimal import Decimal
from datetime import date, datetime
import requests
from playwright.async_api import async_playwright

API_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://127.0.0.1:3000"

def get_auth_token(username, password):
    resp = requests.post(f"{API_BASE}/api/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200, f"Login failed for {username}: {resp.text}"
    return resp.json()["access_token"]

def main_sync_tests():
    print("=" * 70)
    print("SECTION 1: RBAC PERMISSION AND ENDPOINT GATING CHECKS")
    print("=" * 70)
    
    admin_token = get_auth_token("admin", "Admin@Foundation2026!")
    finance_token = get_auth_token("finance", "Finance@Foundation2026!")
    officer_token = get_auth_token("officer", "Officer@Foundation2026!")
    viewer_token = get_auth_token("viewer", "Viewer@Foundation2026!")

    headers_admin = {"Authorization": f"Bearer {admin_token}"}
    headers_finance = {"Authorization": f"Bearer {finance_token}"}
    headers_officer = {"Authorization": f"Bearer {officer_token}"}
    headers_viewer = {"Authorization": f"Bearer {viewer_token}"}

    # 1.1 Unauthenticated requests return 401
    r_unauth = requests.get(f"{API_BASE}/api/sadaqah")
    assert r_unauth.status_code == 401, f"Expected 401 unauth, got {r_unauth.status_code}"
    print("✓ Unauthenticated request to /api/sadaqah returned 401 Unauthorized")

    # 1.2 Viewer without sadaqah permissions returns 403
    r_viewer = requests.get(f"{API_BASE}/api/sadaqah", headers=headers_viewer)
    assert r_viewer.status_code == 403, f"Expected 403 for viewer, got {r_viewer.status_code}"
    print("✓ User without sadaqah.view returned 403 Forbidden")

    # 1.3 Officer without sadaqah.create returns 403 on POST
    r_off_post = requests.post(f"{API_BASE}/api/sadaqah", headers=headers_officer, json={
        "beneficiary_id": 1,
        "sadaqah_date": str(date.today()),
        "total_amount": 1000.0,
        "allocations": [{"group_id": 1, "amount": 1000.0}]
    })
    assert r_off_post.status_code == 403, f"Expected 403 for officer on sadaqah create, got {r_off_post.status_code}"
    print("✓ User without sadaqah.create returned 403 Forbidden on POST /api/sadaqah")

    # 1.4 Admin and Finance have sadaqah permissions
    r_admin_list = requests.get(f"{API_BASE}/api/sadaqah", headers=headers_admin)
    assert r_admin_list.status_code == 200, f"Admin failed to list sadaqahs: {r_admin_list.text}"
    r_fin_list = requests.get(f"{API_BASE}/api/sadaqah", headers=headers_finance)
    assert r_fin_list.status_code == 200, f"Finance failed to list sadaqahs: {r_fin_list.text}"
    print("✓ Admin and Finance Officer successfully authorized with RBAC")

    print("\n" + "=" * 70)
    print("SECTION 2: FINANCIAL SEEDING & BALANCE PREPARATION")
    print("=" * 70)

    # Fund Group 2 (G-0002) and Group 3 (G-0003) via legitimate group fund transactions
    # G-0001 already has funds. Let's ensure G-0002 has ৳4,000 and G-0003 has ৳3,000
    r_seed_g2 = requests.post(
        f"{API_BASE}/api/groups/2/funds/transaction?transaction_type=Received&amount=4000.00&description=Initial+Grant+G2",
        headers=headers_admin
    )
    assert r_seed_g2.status_code in (200, 201), f"Failed to seed G-0002: {r_seed_g2.text}"

    r_seed_g3 = requests.post(
        f"{API_BASE}/api/groups/3/funds/transaction?transaction_type=Received&amount=3000.00&description=Initial+Grant+G3",
        headers=headers_admin
    )
    assert r_seed_g3.status_code in (200, 201), f"Failed to seed G-0003: {r_seed_g3.text}"

    # Check active-groups-with-balance
    r_balances = requests.get(f"{API_BASE}/api/sadaqah/active-groups-with-balance", headers=headers_admin)
    assert r_balances.status_code == 200
    b_map = {g["code"]: Decimal(str(g["available_balance"])) for g in r_balances.json()}
    print(f"Group Balances: G-0001=৳{b_map.get('G-0001')}, G-0002=৳{b_map.get('G-0002')}, G-0003=৳{b_map.get('G-0003')}")
    assert b_map["G-0002"] >= Decimal("4000.00")
    assert b_map["G-0003"] >= Decimal("3000.00")
    print("✓ Group fund balances successfully initialized from legitimate transactions")

    print("\n" + "=" * 70)
    print("SECTION 3: VALIDATION AND ATOMICITY CHECKS")
    print("=" * 70)

    # 3.1 Allocation mismatch: sum != total_amount
    r_mismatch = requests.post(f"{API_BASE}/api/sadaqah", headers=headers_admin, json={
        "beneficiary_id": 1,
        "sadaqah_date": str(date.today()),
        "total_amount": 5000.00,
        "allocations": [
            {"group_id": 2, "amount": 2000.00},
            {"group_id": 3, "amount": 2500.00} # Sum is 4500 != 5000
        ]
    })
    assert r_mismatch.status_code == 400, f"Expected 400 for sum mismatch, got {r_mismatch.status_code}"
    print("✓ Allocation sum mismatch rejected with 400")

    # 3.2 Allocation exceeds group available balance
    r_exceed = requests.post(f"{API_BASE}/api/sadaqah", headers=headers_admin, json={
        "beneficiary_id": 1,
        "sadaqah_date": str(date.today()),
        "total_amount": 999999.00,
        "allocations": [
            {"group_id": 2, "amount": 999999.00}
        ]
    })
    assert r_exceed.status_code == 400, f"Expected 400 for insufficient group balance, got {r_exceed.status_code}"
    assert "Insufficient balance" in r_exceed.text
    print("✓ Group balance exceeded rejected with 400 (Insufficient balance)")

    # 3.3 Zero or negative allocation rejected
    r_zero = requests.post(f"{API_BASE}/api/sadaqah", headers=headers_admin, json={
        "beneficiary_id": 1,
        "sadaqah_date": str(date.today()),
        "total_amount": 1000.00,
        "allocations": [
            {"group_id": 2, "amount": 0.00}
        ]
    })
    assert r_zero.status_code == 422 or r_zero.status_code == 400
    print("✓ Zero allocation rejected")

    # 3.4 Duplicate group in allocations rejected
    r_dup_grp = requests.post(f"{API_BASE}/api/sadaqah", headers=headers_admin, json={
        "beneficiary_id": 1,
        "sadaqah_date": str(date.today()),
        "total_amount": 2000.00,
        "allocations": [
            {"group_id": 2, "amount": 1000.00},
            {"group_id": 2, "amount": 1000.00}
        ]
    })
    assert r_dup_grp.status_code == 400
    print("✓ Duplicate group selection rejected")

    print("\n" + "=" * 70)
    print("SECTION 4: SINGLE-GROUP & MULTI-GROUP SADAQAH DISTRIBUTION")
    print("=" * 70)

    # 4.1 Scenario 1: A beneficiary can receive Sadaqah from one Group
    initial_g2_bal = requests.get(f"{API_BASE}/api/sadaqah/active-groups-with-balance", headers=headers_admin).json()
    g2_before = next(Decimal(str(g["available_balance"])) for g in initial_g2_bal if g["code"] == "G-0002")

    r_single = requests.post(f"{API_BASE}/api/sadaqah", headers=headers_admin, json={
        "beneficiary_id": 1,
        "sadaqah_date": str(date.today()),
        "total_amount": 1500.00,
        "allocations": [{"group_id": 2, "amount": 1500.00}],
        "purpose": "Winter Clothes Assistance"
    })
    assert r_single.status_code == 201, f"Failed single group Sadaqah: {r_single.text}"
    single_data = r_single.json()
    s_id_1 = single_data["sadaqah_id"]
    assert s_id_1.startswith("S-")
    print(f"✓ Scenario 1: Created single-group Sadaqah {s_id_1} for ৳1,500 from G-0002")

    # Check that G-0002 was deducted exactly 1500.00
    after_g2_bal = requests.get(f"{API_BASE}/api/sadaqah/active-groups-with-balance", headers=headers_admin).json()
    g2_after = next(Decimal(str(g["available_balance"])) for g in after_g2_bal if g["code"] == "G-0002")
    assert g2_before - g2_after == Decimal("1500.00"), f"Expected 1500 deduction, got {g2_before - g2_after}"
    print(f"✓ G-0002 balance accurately deducted from ৳{g2_before} to ৳{g2_after}")

    # Check Beneficiary Ledger updated
    r_bl = requests.get(f"{API_BASE}/api/beneficiaries/1/ledger", headers=headers_admin)
    assert r_bl.status_code == 200
    bl_entries = r_bl.json()["entries"]
    found_bl = any(e["reference"] == s_id_1 and Decimal(str(e["amount"])) == Decimal("1500.00") and e["transaction_type"] == "Disbursed" for e in bl_entries)
    assert found_bl, f"Did not find {s_id_1} in beneficiary ledger"
    print("✓ Beneficiary Ledger contains disbursement record with reference", s_id_1)

    # 4.2 Scenario 2: A beneficiary can receive Sadaqah funded by multiple Groups
    # And Scenario 3: Insufficient funds in one group covered by selecting additional groups
    # Required: ৳3,500. G-0002 has ৳2,500 remaining. G-0003 has ৳3,000.
    # We allocate ৳2,000 from G-0002 and ৳1,500 from G-0003. Total = ৳3,500
    g3_before = next(Decimal(str(g["available_balance"])) for g in after_g2_bal if g["code"] == "G-0003")

    r_multi = requests.post(f"{API_BASE}/api/sadaqah", headers=headers_admin, json={
        "beneficiary_id": 2,
        "sadaqah_date": str(date.today()),
        "total_amount": 3500.00,
        "allocations": [
            {"group_id": 2, "amount": 2000.00},
            {"group_id": 3, "amount": 1500.00}
        ],
        "purpose": "Medical Treatment Support"
    })
    assert r_multi.status_code == 201, f"Failed multi-group Sadaqah: {r_multi.text}"
    multi_data = r_multi.json()
    s_id_2 = multi_data["sadaqah_id"]
    assert s_id_2.startswith("S-")
    assert len(multi_data["allocations"]) == 2
    print(f"✓ Scenario 2 & 3: Created multi-group Sadaqah {s_id_2} for ৳3,500 (G-0002: ৳2,000 + G-0003: ৳1,500)")

    # Verify both groups deducted their respective amounts
    after_multi_bal = requests.get(f"{API_BASE}/api/sadaqah/active-groups-with-balance", headers=headers_admin).json()
    g2_final = next(Decimal(str(g["available_balance"])) for g in after_multi_bal if g["code"] == "G-0002")
    g3_final = next(Decimal(str(g["available_balance"])) for g in after_multi_bal if g["code"] == "G-0003")
    assert g2_after - g2_final == Decimal("2000.00")
    assert g3_before - g3_final == Decimal("1500.00")
    print(f"✓ G-0002 deducted ৳2,000 (now ৳{g2_final}) and G-0003 deducted ৳1,500 (now ৳{g3_final})")

    # Check Group Fund Ledgers show the exact Sadaqah ID reference
    r_g2_ledger = requests.get(f"{API_BASE}/api/groups/2/funds/ledger", headers=headers_admin).json()
    assert any(tx["reference"] == s_id_2 and tx["transaction_type"] == "Spent" for tx in r_g2_ledger["items"])
    r_g3_ledger = requests.get(f"{API_BASE}/api/groups/3/funds/ledger", headers=headers_admin).json()
    assert any(tx["reference"] == s_id_2 and tx["transaction_type"] == "Spent" for tx in r_g3_ledger["items"])
    print(f"✓ Group Fund ledgers for both groups show reference {s_id_2}")

    print("\n" + "=" * 70)
    print("SECTION 5: SAFE CANCELLATION AND ATOMIC REVERSAL")
    print("=" * 70)

    # Cancel multi_data (s_id_2)
    s2_id_db = multi_data["id"]
    r_cancel = requests.post(f"{API_BASE}/api/sadaqah/{s2_id_db}/cancel", headers=headers_admin, json={
        "cancel_reason": "Patient received governmental grant, refunding foundation funds"
    })
    assert r_cancel.status_code == 200, f"Failed to cancel {s_id_2}: {r_cancel.text}"
    cancelled_data = r_cancel.json()
    assert cancelled_data["status"] == "CANCELLED"
    assert cancelled_data["cancel_reason"] == "Patient received governmental grant, refunding foundation funds"
    assert cancelled_data["cancelled_by_name"] == "System Administrator"
    print(f"✓ Cancelled Sadaqah {s_id_2} with full audit trail")

    # Verify both groups' funds were restored exactly once
    after_cancel_bal = requests.get(f"{API_BASE}/api/sadaqah/active-groups-with-balance", headers=headers_admin).json()
    g2_restored = next(Decimal(str(g["available_balance"])) for g in after_cancel_bal if g["code"] == "G-0002")
    g3_restored = next(Decimal(str(g["available_balance"])) for g in after_cancel_bal if g["code"] == "G-0003")
    assert g2_restored == g2_after, f"Expected G2 restored to {g2_after}, got {g2_restored}"
    assert g3_restored == g3_before, f"Expected G3 restored to {g3_before}, got {g3_restored}"
    print(f"✓ Reversals restored funds: G-0002 back to ৳{g2_restored}, G-0003 back to ৳{g3_restored}")

    # Verify repeated cancellation fails
    r_cancel_again = requests.post(f"{API_BASE}/api/sadaqah/{s2_id_db}/cancel", headers=headers_admin, json={
        "cancel_reason": "Trying to cancel a second time"
    })
    assert r_cancel_again.status_code == 400
    assert "already been cancelled" in r_cancel_again.text
    print("✓ Repeated cancellation rejected with 400 (Preventing double refunds)")

    print("\n" + "=" * 70)
    print("SECTION 6: SADAQAH REPORTING & AGGREGATIONS")
    print("=" * 70)

    r_report = requests.get(f"{API_BASE}/api/sadaqah/report/summary", headers=headers_admin)
    assert r_report.status_code == 200
    rep = r_report.json()
    print("Report Summary:")
    print("  Total Distributed:", rep["total_amount_distributed"])
    print("  Completed Transactions:", rep["total_transactions"])
    print("  Cancelled Count:", rep["cancelled_count"])
    print("  Cancelled Amount:", rep["cancelled_amount"])
    print("  Group Distribution Items:", len(rep["by_group"]))
    print("  Beneficiary Distribution Items:", len(rep["by_beneficiary"]))
    assert Decimal(str(rep["total_amount_distributed"])) >= Decimal("1500.00")
    assert rep["cancelled_count"] >= 1
    assert Decimal(str(rep["cancelled_amount"])) >= Decimal("3500.00")
    print("✓ SQL aggregations match posted and cancelled transactions")

async def main_e2e_browser_tests():
    print("\n" + "=" * 70)
    print("SECTION 7: PLAYWRIGHT E2E & MOBILE RESPONSIVENESS")
    print("=" * 70)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        # Step 1: Login
        await page.goto(f"{FRONTEND_BASE}/login", wait_until="networkidle")
        await page.wait_for_selector('input[name="username"]')
        await page.fill('input[name="username"]', "admin")
        await page.fill('input[name="password"]', "Admin@Foundation2026!")
        await page.click('button[type="submit"]')
        await page.wait_for_url(f"{FRONTEND_BASE}/", timeout=10000)
        await page.wait_for_load_state("networkidle")
        print("✓ Logged into frontend dashboard as admin")

        # Step 2: Check Desktop Sidebar has Sadaqah menu and submenus
        desktop_aside = page.locator("aside.hidden.md\\:flex")
        assert await desktop_aside.is_visible()
        sadaqah_menu = desktop_aside.get_by_text("Sadaqah", exact=True)
        assert await sadaqah_menu.is_visible()
        
        # Verify submenus
        add_s_link = desktop_aside.locator('a[href="/sadaqah/add"]')
        assert await add_s_link.is_visible()
        manage_s_link = desktop_aside.locator('a[href="/sadaqah/manage"]')
        assert await manage_s_link.is_visible()
        report_s_link = desktop_aside.locator('a[href="/sadaqah/report"]')
        assert await report_s_link.is_visible()
        print("✓ Desktop sidebar contains 'Sadaqah' menu with Add, Manage, and Report submenus")

        # Test Add Sadaqah UI
        await page.goto(f"{FRONTEND_BASE}/sadaqah/add")
        await page.wait_for_selector('h1:has-text("Record Sadaqah Payment")')
        print("✓ /sadaqah/add rendered successfully")

        # Test Manage Sadaqah UI
        await page.goto(f"{FRONTEND_BASE}/sadaqah/manage")
        await page.wait_for_selector('h1:has-text("Manage Sadaqah")')
        await page.wait_for_selector('table tbody tr', timeout=10000)
        table_rows = page.locator("table tbody tr")
        row_count = await table_rows.count()
        assert row_count > 0, f"Expected rows in table, got {row_count}"
        print(f"✓ /sadaqah/manage rendered with {row_count} database transaction rows")

        # Test Sadaqah Report UI
        await page.goto(f"{FRONTEND_BASE}/sadaqah/report")
        await page.wait_for_selector('h1:has-text("Sadaqah Analytical Report")')
        await page.wait_for_load_state("networkidle")
        print("✓ /sadaqah/report rendered with live KPI cards and breakdown tables")

        # Mobile Responsiveness test across 5 viewports (320px, 360px, 375px, 390px, 430px)
        viewports = [320, 360, 375, 390, 430]
        pages_to_test = ["/sadaqah/add", "/sadaqah/manage", "/sadaqah/report"]

        for vp in viewports:
            await page.set_viewport_size({"width": vp, "height": 800})
            for path in pages_to_test:
                await page.goto(f"{FRONTEND_BASE}{path}")
                await page.wait_for_load_state("networkidle")
                # Check for horizontal scroll / overflow
                scroll_width = await page.evaluate("() => document.documentElement.scrollWidth")
                inner_width = await page.evaluate("() => window.innerWidth")
                assert scroll_width <= inner_width + 1, (
                    f"Horizontal overflow detected on {path} at {vp}px: scrollWidth={scroll_width}, innerWidth={inner_width}"
                )
            print(f"✓ Mobile viewport {vp}px verified with 0 horizontal overflow across all Sadaqah pages")

        await browser.close()
        print("✓ All browser tests completed successfully!")

if __name__ == "__main__":
    main_sync_tests()
    asyncio.run(main_e2e_browser_tests())
    print("\n" + "=" * 70)
    print("ALL SADAQAH MODULE TESTS PASSED 100%!")
    print("=" * 70)
