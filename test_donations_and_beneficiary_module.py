import asyncio
import time
import requests
from decimal import Decimal
from datetime import date, timedelta
from playwright.async_api import async_playwright

API_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://127.0.0.1:3000"

def test_backend_donations_and_beneficiaries():
    print("=== 1. TESTING REAL AUTHENTICATION & TOKEN ACQUISITION ===")
    login_res = requests.post(f"{API_BASE}/api/auth/login", json={
        "username": "admin",
        "password": "Admin@Foundation2026!"
    })
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    admin_data = login_res.json()
    admin_token = admin_data["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print(f"Logged in as admin, permissions count: {len(admin_data['user']['permissions'])}")
    assert "donations.create" in admin_data["user"]["permissions"]
    assert "donations.view" in admin_data["user"]["permissions"]
    assert "donations.update" in admin_data["user"]["permissions"]
    assert "donations.cancel" in admin_data["user"]["permissions"]
    assert "donation_reports.view" in admin_data["user"]["permissions"]
    assert "beneficiaries.view" in admin_data["user"]["permissions"]

    # Also log in as viewer to test RBAC restrictions
    viewer_login = requests.post(f"{API_BASE}/api/auth/login", json={
        "username": "viewer",
        "password": "Viewer@Foundation2026!"
    })
    assert viewer_login.status_code == 200
    viewer_token = viewer_login.json()["access_token"]
    viewer_headers = {"Authorization": f"Bearer {viewer_token}"}

    print("\n=== 2. TESTING BENEFICIARY MANAGEMENT API ===")
    # List beneficiaries
    list_b = requests.get(f"{API_BASE}/api/beneficiaries?limit=5", headers=admin_headers)
    assert list_b.status_code == 200
    b_data = list_b.json()
    print(f"Total beneficiaries found: {b_data['total']}")

    # Create new beneficiary
    b_create_res = requests.post(f"{API_BASE}/api/beneficiaries", headers=admin_headers, json={
        "name": "Automated Test Beneficiary",
        "phone": "+1 555-0199",
        "address": "456 Oak Avenue",
        "registration_date": str(date.today()),
        "status": "Active",
        "notes": "Testing beneficiary management"
    })
    assert b_create_res.status_code == 201
    created_b = b_create_res.json()
    b_id = created_b["id"]
    b_code = created_b["beneficiary_id"]
    print(f"Created beneficiary: {b_code} ({created_b['name']})")
    assert b_code.startswith("B-")

    # Update beneficiary (PATCH)
    b_patch_res = requests.patch(f"{API_BASE}/api/beneficiaries/{b_id}", headers=admin_headers, json={
        "name": "Updated Test Beneficiary",
        "phone": "+1 555-0200"
    })
    assert b_patch_res.status_code == 200
    assert b_patch_res.json()["name"] == "Updated Test Beneficiary"
    assert b_patch_res.json()["beneficiary_id"] == b_code, "Beneficiary ID must remain unchanged"
    print(f"Successfully updated beneficiary details; ID {b_code} remained strictly read-only.")

    # Deactivate beneficiary
    deact_res = requests.post(f"{API_BASE}/api/beneficiaries/{b_id}/deactivate", headers=admin_headers)
    assert deact_res.status_code == 200
    assert deact_res.json()["status"] == "Inactive"
    print(f"Deactivated beneficiary {b_code}: status is now Inactive.")

    # Activate beneficiary
    act_res = requests.post(f"{API_BASE}/api/beneficiaries/{b_id}/activate", headers=admin_headers)
    assert act_res.status_code == 200
    assert act_res.json()["status"] == "Active"
    print(f"Activated beneficiary {b_code}: status is now Active.")

    # Test viewer RBAC restrictions on beneficiary modification
    viewer_patch = requests.patch(f"{API_BASE}/api/beneficiaries/{b_id}", headers=viewer_headers, json={
        "name": "Malicious Change"
    })
    assert viewer_patch.status_code == 403, "Viewer must be rejected with 403 on update"
    viewer_deact = requests.post(f"{API_BASE}/api/beneficiaries/{b_id}/deactivate", headers=viewer_headers)
    assert viewer_deact.status_code == 403, "Viewer must be rejected with 403 on deactivate"
    print("RBAC verified: viewer cannot update or toggle beneficiary status (HTTP 403).")

    print("\n=== 3. TESTING DONATION CREATION & CONCURRENCY-SAFE ID ===")
    # Unauthenticated request must return 401
    unauth_res = requests.post(f"{API_BASE}/api/donations", json={"donor_name": "Ghost", "amount": 100})
    assert unauth_res.status_code == 401, "Unauthenticated request must return 401"
    print("Unauthenticated donation request rejected: HTTP 401")

    # Viewer without donations.create must return 403
    forbidden_res = requests.post(f"{API_BASE}/api/donations", headers=viewer_headers, json={
        "donation_date": str(date.today()),
        "donor_name": "Anonymous",
        "amount": 50.00,
        "payment_method": "Cash"
    })
    assert forbidden_res.status_code == 403, "Viewer must be rejected with 403"
    print("Unauthorized donation creation rejected: HTTP 403")

    # Amount <= 0 validation
    bad_amt_res = requests.post(f"{API_BASE}/api/donations", headers=admin_headers, json={
        "donation_date": str(date.today()),
        "donor_name": "Generous Donor",
        "amount": -50.00,
        "payment_method": "Cash"
    })
    assert bad_amt_res.status_code in (400, 422), f"Negative amount must be rejected: {bad_amt_res.status_code}"
    print("Negative amount rejected correctly.")

    zero_amt_res = requests.post(f"{API_BASE}/api/donations", headers=admin_headers, json={
        "donation_date": str(date.today()),
        "donor_name": "Generous Donor",
        "amount": 0.00,
        "payment_method": "Cash"
    })
    assert zero_amt_res.status_code in (400, 422), "Zero amount must be rejected"
    print("Zero amount rejected correctly.")

    # Create 3 sequential donations
    unique_ref = f"REF-TEST-{int(time.time() * 1000)}"
    d1_res = requests.post(f"{API_BASE}/api/donations", headers=admin_headers, json={
        "donation_date": str(date.today()),
        "donor_name": "Alice Johnson",
        "amount": 1500.00,
        "payment_method": "Bank Transfer",
        "transaction_reference": unique_ref,
        "notes": "Annual community support fund"
    })
    assert d1_res.status_code == 201, f"Donation creation failed: {d1_res.text}"
    d1 = d1_res.json()
    assert d1["donation_id"].startswith("D-")
    assert d1["status"] == "COMPLETED"
    assert Decimal(str(d1["amount"])) == Decimal("1500.00")
    print(f"Created Donation 1: {d1['donation_id']}, Amount: ${d1['amount']}, Method: {d1['payment_method']}")

    # Test duplicate transaction reference prevention
    dup_ref_res = requests.post(f"{API_BASE}/api/donations", headers=admin_headers, json={
        "donation_date": str(date.today()),
        "donor_name": "Bob Smith",
        "amount": 200.00,
        "payment_method": "Bank Transfer",
        "transaction_reference": unique_ref,
    })
    assert dup_ref_res.status_code == 400, f"Duplicate reference must be rejected: {dup_ref_res.text}"
    print(f"Duplicate transaction reference '{unique_ref}' correctly rejected with HTTP 400.")

    # Create Donation 2
    d2_ref = f"CARD-AUTH-{int(time.time() * 1000)}"
    d2_res = requests.post(f"{API_BASE}/api/donations", headers=admin_headers, json={
        "donation_date": str(date.today() - timedelta(days=5)),
        "donor_name": "Bob Smith",
        "amount": 500.50,
        "payment_method": "Card",
        "transaction_reference": d2_ref,
        "notes": "Medical assistance sponsorship"
    })
    assert d2_res.status_code == 201
    d2 = d2_res.json()
    assert d2["donation_id"].startswith("D-")
    assert d2["donation_id"] != d1["donation_id"]
    print(f"Created Donation 2: {d2['donation_id']}, Amount: ${d2['amount']}, Method: {d2['payment_method']}")

    # Create Donation 3
    d3_res = requests.post(f"{API_BASE}/api/donations", headers=admin_headers, json={
        "donation_date": str(date.today() - timedelta(days=10)),
        "donor_name": "Charlie Davis",
        "amount": 250.00,
        "payment_method": "Cash",
        "notes": "General foundation donation"
    })
    assert d3_res.status_code == 201
    d3 = d3_res.json()
    print(f"Created Donation 3: {d3['donation_id']}, Amount: ${d3['amount']}, Method: {d3['payment_method']}")

    print("\n=== 4. TESTING DONATION LISTING, SEARCH, FILTERS & SORTING ===")
    # Search by donor name
    search_res = requests.get(f"{API_BASE}/api/donations?q=Alice", headers=admin_headers)
    assert search_res.status_code == 200
    assert any(x["donor_name"] == "Alice Johnson" for x in search_res.json()["items"])
    print("Search by donor name verified: True")

    # Search by donation ID
    search_id_res = requests.get(f"{API_BASE}/api/donations?q={d1['donation_id']}", headers=admin_headers)
    assert search_id_res.status_code == 200
    assert len(search_id_res.json()["items"]) >= 1
    assert search_id_res.json()["items"][0]["donation_id"] == d1["donation_id"]
    print("Search by Donation ID verified: True")

    # Filter by payment method
    filter_method_res = requests.get(f"{API_BASE}/api/donations?payment_method=Card", headers=admin_headers)
    assert filter_method_res.status_code == 200
    assert all(x["payment_method"] == "Card" for x in filter_method_res.json()["items"])
    print("Filter by payment method ('Card') verified: True")

    # Filter by date range
    start_d = str(date.today() - timedelta(days=2))
    end_d = str(date.today())
    filter_date_res = requests.get(f"{API_BASE}/api/donations?start_date={start_d}&end_date={end_d}", headers=admin_headers)
    assert filter_date_res.status_code == 200
    print(f"Date range filter ({start_d} to {end_d}) returned {len(filter_date_res.json()['items'])} records.")

    # Sorting by amount desc
    sort_res = requests.get(f"{API_BASE}/api/donations?sort_by=amount&order=desc", headers=admin_headers)
    assert sort_res.status_code == 200
    amounts = [float(x["amount"]) for x in sort_res.json()["items"]]
    assert amounts == sorted(amounts, reverse=True), "Donations must be sorted by amount descending"
    print("Sorting by amount descending verified: True")

    print("\n=== 5. TESTING DONATION EDITING & AUDIT-PRESERVED CANCELLATION ===")
    # Update donation 3
    edit_res = requests.patch(f"{API_BASE}/api/donations/{d3['id']}", headers=admin_headers, json={
        "donor_name": "Charlie Davis Jr.",
        "amount": 300.00
    })
    assert edit_res.status_code == 200
    updated_d3 = edit_res.json()
    assert updated_d3["donor_name"] == "Charlie Davis Jr."
    assert Decimal(str(updated_d3["amount"])) == Decimal("300.00")
    print(f"Donation {d3['donation_id']} updated successfully: Amount is now $300.00.")

    # Cancel donation 2 with reason
    cancel_res = requests.post(f"{API_BASE}/api/donations/{d2['id']}/cancel", headers=admin_headers, json={
        "cancel_reason": "Duplicate transaction issued by bank processor"
    })
    assert cancel_res.status_code == 200
    cancelled_d2 = cancel_res.json()
    assert cancelled_d2["status"] == "CANCELLED"
    assert cancelled_d2["cancel_reason"] == "Duplicate transaction issued by bank processor"
    assert cancelled_d2["cancelled_by_name"] == admin_data["user"]["full_name"]
    print(f"Donation {d2['donation_id']} successfully cancelled with audit trail preserved.")

    # Attempting to edit a cancelled donation must fail
    edit_cancelled = requests.patch(f"{API_BASE}/api/donations/{d2['id']}", headers=admin_headers, json={
        "amount": 100.00
    })
    assert edit_cancelled.status_code == 400, "Cannot edit a cancelled donation"
    print("Editing a cancelled donation rejected with HTTP 400: True")

    print("\n=== 6. TESTING DONATION REPORTING & AGGREGATE STATS ===")
    # Unauthenticated report request must return 401
    unauth_rep = requests.get(f"{API_BASE}/api/donations/report/summary")
    assert unauth_rep.status_code == 401
    print("Unauthenticated report access rejected: HTTP 401")

    # Report summary
    rep_res = requests.get(f"{API_BASE}/api/donations/report/summary?group_by=month", headers=admin_headers)
    assert rep_res.status_code == 200
    rep_data = rep_res.json()
    print(f"Report Total Amount: ${rep_data['total_amount']}, Transactions: {rep_data['total_transactions']}")
    assert Decimal(str(rep_data["total_amount"])) > Decimal("0.00")
    assert rep_data["total_transactions"] >= 2
    assert len(rep_data["by_payment_method"]) >= 2
    print(f"Breakdown by Payment Method: {[m['payment_method'] + ': $' + str(m['total_amount']) for m in rep_data['by_payment_method']]}")
    print(f"Periodic summary count: {len(rep_data['periodic_summary'])}")


async def test_frontend_ui_and_mobile_responsiveness():
    print("\n=== 7. TESTING FRONTEND SIDEBAR, NAVIGATION, AND MOBILE VIEWPORTS ===")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # Step 1: Login via UI
        await page.goto(f"{FRONTEND_BASE}/login", wait_until="networkidle")
        await page.fill('input[name="username"]', 'admin')
        await page.fill('input[name="password"]', 'Admin@Foundation2026!')
        await page.click('button[type="submit"]')
        await page.wait_for_url(f"{FRONTEND_BASE}/", timeout=10000)
        print("Logged into frontend dashboard successfully.")

        # Step 2: Verify Sidebar Navigation Items & Search Removal
        # On desktop (1280px)
        await page.set_viewport_size({"width": 1280, "height": 900})
        await page.goto(f"{FRONTEND_BASE}/", wait_until="networkidle")

        # Confirm Search item is completely removed from sidebar
        search_link = page.locator('aside').get_by_text("Search", exact=True)
        assert await search_link.count() == 0, "Search navigation item must be completely removed from sidebar"
        print("CONFIRMED: Search navigation item completely removed from sidebar.")

        # Confirm Beneficiary Submenu items and order
        desktop_aside = page.locator('aside.hidden.md\\:flex')
        b_parent = desktop_aside.get_by_text("Beneficiary", exact=True)
        assert await b_parent.is_visible(), "Beneficiary menu must be present"

        add_b_link = desktop_aside.locator('a[href="/beneficiaries/add"]')
        assert await add_b_link.is_visible()
        manage_b_link = desktop_aside.locator('a[href="/beneficiaries/manage"]')
        assert await manage_b_link.is_visible()
        ledger_b_link = desktop_aside.locator('a[href="/beneficiaries/ledger"]')
        assert await ledger_b_link.is_visible()
        print("CONFIRMED: Beneficiary menu has Add Beneficiary, Manage Beneficiary, and Beneficiary Ledger.")

        # Confirm Donation Parent Menu and Submenu items
        donation_parent = desktop_aside.get_by_text("Donation", exact=True)
        assert await donation_parent.is_visible(), "Donation parent menu must be visible"

        add_d_link = desktop_aside.locator('a[href="/donations/add"]')
        assert await add_d_link.is_visible()
        manage_d_link = desktop_aside.locator('a[href="/donations/manage"]')
        assert await manage_d_link.is_visible()
        report_d_link = desktop_aside.locator('a[href="/donations/report"]')
        assert await report_d_link.is_visible()
        print("CONFIRMED: Donation parent menu contains Add Donation, Manage Donation, and Donation Report.")

        # Step 3: Test Manage Beneficiary UI
        print("\n=== Testing Manage Beneficiary Page UI ===")
        await page.goto(f"{FRONTEND_BASE}/beneficiaries/manage", wait_until="networkidle")
        h1 = await page.locator("h1").inner_text()
        assert "Manage Beneficiary" in h1
        # Check table headers: Beneficiary ID, Name, Phone, Registration Date, Status
        table_text = await page.locator("table thead").inner_text()
        assert "Beneficiary ID" in table_text
        assert "Name" in table_text
        assert "Phone" in table_text
        assert "Registration Date" in table_text
        assert "Status" in table_text
        print("Manage Beneficiary table columns verified: True")

        # Step 4: Test Add Donation UI
        print("\n=== Testing Add Donation Page UI ===")
        await page.goto(f"{FRONTEND_BASE}/donations/add", wait_until="networkidle")
        h1 = await page.locator("h1").inner_text()
        assert "Record New Donation" in h1
        # Fill in a donation
        await page.fill('input[type="text"][placeholder*="John Doe"]', 'Frontend Automated Donor')
        await page.fill('input[type="number"]', '750.00')
        await page.select_option('select', 'Card')
        await page.fill('input[placeholder*="TXN-"]', f'FRONTEND-CARD-{int(time.time() * 1000)}')
        await page.click('button[type="submit"]')
        await page.wait_for_selector('text=Donation Recorded Successfully!', timeout=10000)
        print("Donation created via frontend form successfully: True")

        # Step 5: Test Manage Donation UI
        print("\n=== Testing Manage Donation Page UI ===")
        await page.goto(f"{FRONTEND_BASE}/donations/manage", wait_until="networkidle")
        h1 = await page.locator("h1").inner_text()
        assert "Manage Donations" in h1
        # Check table headers: Donation ID, Date, Donor Name, Amount, Payment Method, Reference, Status
        table_text = await page.locator("table thead").inner_text()
        assert "Donation ID" in table_text
        assert "Date" in table_text
        assert "Donor Name" in table_text
        assert "Amount" in table_text
        assert "Payment Method" in table_text
        assert "Status" in table_text
        print("Manage Donations table columns verified: True")

        # Step 6: Test Donation Report UI
        print("\n=== Testing Donation Report Page UI ===")
        await page.goto(f"{FRONTEND_BASE}/donations/report", wait_until="networkidle")
        h1 = await page.locator("h1").inner_text()
        assert "Donation Financial Report" in h1
        # Check KPI cards
        await page.wait_for_selector('text=Total Received', timeout=10000)
        body_text = (await page.locator("main").inner_text()).lower()
        assert "total received" in body_text
        assert "transactions" in body_text
        assert "breakdown by payment method" in body_text
        print("Donation Financial Report KPIs and analytical breakdowns verified: True")

        # Step 7: Test Mobile Responsiveness across all 5 viewports
        print("\n=== 8. TESTING MOBILE RESPONSIVENESS ACROSS VIEWPORTS (320px, 360px, 375px, 390px, 430px) ===")
        viewports = [320, 360, 375, 390, 430]
        test_routes = [
            "/beneficiaries/manage",
            "/donations/add",
            "/donations/manage",
            "/donations/report",
            "/",
            "/groups/manage",
            "/members/manage"
        ]

        for width in viewports:
            print(f"\n--- Testing mobile viewport width: {width}px ---")
            await page.set_viewport_size({"width": width, "height": 800})
            for route in test_routes:
                await page.goto(f"{FRONTEND_BASE}{route}", wait_until="networkidle")
                await page.wait_for_timeout(200)

                # Check horizontal scroll width
                scroll_width = await page.evaluate("() => document.documentElement.scrollWidth")
                client_width = await page.evaluate("() => document.documentElement.clientWidth")
                body_scroll_width = await page.evaluate("() => document.body.scrollWidth")

                assert scroll_width <= width, f"Horizontal overflow on {route} at {width}px: scrollWidth={scroll_width} > {width}"
                assert body_scroll_width <= width, f"Body overflow on {route} at {width}px: bodyScrollWidth={body_scroll_width} > {width}"
                print(f"✅ PASS: {route} (width={width}px, scrollWidth={scroll_width}px, 0 overflow)")

        # Verify Mobile Drawer toggle and links on 375px
        await page.set_viewport_size({"width": 375, "height": 800})
        await page.goto(f"{FRONTEND_BASE}/donations/manage", wait_until="networkidle")
        menu_btn = page.locator('header button[aria-label="Toggle navigation menu"]')
        assert await menu_btn.is_visible()
        await menu_btn.click()
        await page.wait_for_timeout(300)

        drawer = page.locator('aside[aria-label="Mobile Navigation Drawer"]')
        drawer_class = await drawer.get_attribute("class")
        assert "translate-x-0" in drawer_class, "Mobile drawer must slide in"

        # Check that Donation links are present in drawer
        drawer_donations = drawer.locator('a[href="/donations/manage"]')
        assert await drawer_donations.is_visible(), "Donation links must be accessible inside mobile drawer"
        print("Mobile drawer opens cleanly with donation items accessible: True")

        await browser.close()
        print("\n🎉 ALL TESTS PASSED SUCCESSFULLY! 100% VERIFIED!")

if __name__ == "__main__":
    test_backend_donations_and_beneficiaries()
    asyncio.run(test_frontend_ui_and_mobile_responsiveness())
