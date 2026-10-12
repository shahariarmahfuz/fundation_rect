import asyncio
from playwright.async_api import async_playwright

FRONTEND_BASE = "http://127.0.0.1:3000"

async def run_e2e_tests():
    print("=" * 70)
    print("STARTING QARD HASAN E2E AND RESPONSIVENESS PLAYWRIGHT TESTS")
    print("=" * 70)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        # Step 1: Login
        print("\n1. Testing Login...")
        await page.goto(f"{FRONTEND_BASE}/login", wait_until="networkidle")
        await page.wait_for_selector('input[name="username"]')
        await page.fill('input[name="username"]', "admin")
        await page.fill('input[name="password"]', "Admin@Foundation2026!")
        await page.click('button[type="submit"]')
        await page.wait_for_url(f"{FRONTEND_BASE}/", timeout=15000)
        await page.wait_for_load_state("networkidle")
        print("✓ Logged into Foundation dashboard as System Admin")

        # Step 2: Sidebar Navigation Verification
        print("\n2. Testing Desktop Sidebar Navigation Structure...")
        desktop_aside = page.locator("aside.hidden.md\\:flex")
        assert await desktop_aside.is_visible(), "Desktop sidebar aside is not visible"

        qh_parent = desktop_aside.get_by_text("Qard Hasan", exact=True)
        assert await qh_parent.is_visible(), "'Qard Hasan' parent menu not found in sidebar"
        print("✓ 'Qard Hasan' parent menu is visible in sidebar")

        # Verify exact 4 submenus in exact order
        sub_links = desktop_aside.locator('a[href^="/qard-hasan/"]')
        count = await sub_links.count()
        assert count == 4, f"Expected 4 Qard Hasan submenus, found {count}"

        hrefs = []
        titles = []
        for i in range(count):
            link = sub_links.nth(i)
            href = await link.get_attribute("href")
            text = (await link.inner_text()).strip()
            hrefs.append(href)
            titles.append(text)

        print(f"Discovered submenus: {list(zip(titles, hrefs))}")
        assert hrefs[0] == "/qard-hasan/add", f"Submenu 1 href expected /qard-hasan/add, got {hrefs[0]}"
        assert "Add Qard Hasan" in titles[0], f"Submenu 1 title expected 'Add Qard Hasan', got '{titles[0]}'"

        assert hrefs[1] == "/qard-hasan/manage", f"Submenu 2 href expected /qard-hasan/manage, got {hrefs[1]}"
        assert "Manage Qard Hasan" in titles[1], f"Submenu 2 title expected 'Manage Qard Hasan', got '{titles[1]}'"

        assert hrefs[2] == "/qard-hasan/repayment", f"Submenu 3 href expected /qard-hasan/repayment, got {hrefs[2]}"
        assert "Repayment" in titles[2], f"Submenu 3 title expected 'Repayment', got '{titles[2]}'"

        assert hrefs[3] == "/qard-hasan/report", f"Submenu 4 href expected /qard-hasan/report, got {hrefs[3]}"
        assert "Report" in titles[3], f"Submenu 4 title expected 'Report', got '{titles[3]}'"

        print("✓ All 4 submenus present in exact required order:")
        print("   1. Add Qard Hasan (/qard-hasan/add)")
        print("   2. Manage Qard Hasan (/qard-hasan/manage)")
        print("   3. Repayment (/qard-hasan/repayment)")
        print("   4. Report (/qard-hasan/report)")

        # Step 3: Test Add Qard Hasan Page
        print("\n3. Testing /qard-hasan/add Page UI...")
        await page.goto(f"{FRONTEND_BASE}/qard-hasan/add", wait_until="networkidle")
        await page.wait_for_selector('h1:has-text("Add Qard Hasan")')
        assert await page.locator('text=Qard Hasan Principle').is_visible()
        assert await page.locator('text=Repayment Arrangement').is_visible()
        assert await page.locator('text=Group Funding Allocations').is_visible()
        print("✓ /qard-hasan/add rendered with interest-free callout, multi-group allocation, and schedule controls")

        # Step 4: Test Manage Qard Hasan Page
        print("\n4. Testing /qard-hasan/manage Page UI...")
        await page.goto(f"{FRONTEND_BASE}/qard-hasan/manage", wait_until="networkidle")
        await page.wait_for_selector('h1:has-text("Manage Qard Hasan")')
        await page.wait_for_selector('text=Total Disbursed')
        await page.wait_for_selector('text=Total Repaid')
        await page.wait_for_selector('text=Total Outstanding')
        assert await page.locator('table').is_visible()
        print("✓ /qard-hasan/manage rendered with KPI cards, filtering bar, and loans table")

        # Step 5: Test Repayment Page
        print("\n5. Testing /qard-hasan/repayment Page UI...")
        await page.goto(f"{FRONTEND_BASE}/qard-hasan/repayment", wait_until="networkidle")
        await page.wait_for_selector('h1:has-text("Qard Hasan Repayment")')
        assert await page.locator('button:has-text("Record Repayment")').is_visible()
        assert await page.locator('button:has-text("Repayment History")').is_visible()
        # Switch to History tab
        await page.click('button:has-text("Repayment History")')
        await page.wait_for_selector('th:has-text("Receipt ID")')
        print("✓ /qard-hasan/repayment rendered with Record Repayment form and Repayment History tab")

        # Step 6: Test Report Page
        print("\n6. Testing /qard-hasan/report Page UI...")
        await page.goto(f"{FRONTEND_BASE}/qard-hasan/report", wait_until="networkidle")
        await page.wait_for_selector('h1:has-text("Qard Hasan Report")')
        await page.wait_for_selector('text=Principal Disbursed')
        await page.wait_for_selector('text=Overdue Principal')
        await page.wait_for_selector('text=Disbursements by Funding Group')
        await page.wait_for_selector('text=Repayments Received by Group')
        await page.wait_for_selector('text=Beneficiary-Wise Loan Balances')
        print("✓ /qard-hasan/report rendered with live KPI cards, group distributions, and CSV export")

        # Step 7: Mobile Responsiveness Verification across 5 viewports
        print("\n7. Testing Mobile Responsiveness across 5 viewports (320px, 360px, 375px, 390px, 430px)...")
        viewports = [320, 360, 375, 390, 430]
        pages_to_test = [
            "/qard-hasan/add",
            "/qard-hasan/manage",
            "/qard-hasan/repayment",
            "/qard-hasan/report"
        ]

        for vp in viewports:
            await page.set_viewport_size({"width": vp, "height": 800})
            for p_url in pages_to_test:
                await page.goto(f"{FRONTEND_BASE}{p_url}", wait_until="networkidle")
                scroll_width = await page.evaluate("() => document.documentElement.scrollWidth")
                inner_width = await page.evaluate("() => window.innerWidth")
                assert scroll_width <= inner_width + 1, (
                    f"Horizontal overflow on {p_url} at {vp}px! scrollWidth: {scroll_width}, innerWidth: {inner_width}"
                )
            print(f"✓ Viewport {vp}px: 0 horizontal overflow across all 4 Qard Hasan pages")

        await browser.close()
        print("\n" + "=" * 70)
        print("ALL PLAYWRIGHT TESTS PASSED 100%!")
        print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
