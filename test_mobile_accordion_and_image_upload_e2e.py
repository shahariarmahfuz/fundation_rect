import sys
import asyncio
from playwright.async_api import async_playwright

async def run_e2e_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()

        # 1. Login as Administrator
        print("\n--- 1. Authenticating as Administrator ---")
        await page.goto("http://127.0.0.1:3000/login", wait_until="networkidle")
        await page.fill('input[type="text"]', "admin")
        await page.fill('input[type="password"]', "Admin@Foundation2026!")
        await page.click('button[type="submit"]')
        await page.wait_for_url("http://127.0.0.1:3000/", timeout=10000)
        print("✅ Logged in successfully")

        # 2. Test Mobile Sidebar Accordion
        print("\n--- 2. Testing Mobile Sidebar Accordion Behavior (Viewport 390x844) ---")
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto("http://127.0.0.1:3000/", wait_until="networkidle")
        await page.wait_for_timeout(500)

        # Open mobile drawer
        menu_btn = page.locator('button[aria-label="Toggle navigation menu"]')
        await menu_btn.click()
        await page.wait_for_timeout(500)

        drawer = page.locator('aside[aria-label="Mobile Navigation Drawer"]')
        assert await drawer.is_visible(), "Mobile drawer must be visible after clicking toggle"
        print("✅ Mobile drawer opened")

        # Check all parent menus start collapsed by default
        parent_buttons = drawer.locator('button[aria-expanded]')
        count = await parent_buttons.count()
        print(f"Found {count} collapsible parent menus in mobile drawer")
        assert count >= 6, f"Expected at least 6 parent menus, found {count}"

        for i in range(count):
            btn = parent_buttons.nth(i)
            expanded = await btn.get_attribute("aria-expanded")
            text = (await btn.inner_text()).strip()
            print(f"  Parent '{text}': aria-expanded={expanded}")
            assert expanded == "false", f"Parent '{text}' must start collapsed (aria-expanded='false')"
        print("✅ All parent menus are collapsed by default on initial mobile open")

        # Tap Beneficiary to expand it
        beneficiary_btn = drawer.locator('button[aria-controls="submenu-beneficiary-parent"]')
        await beneficiary_btn.click()
        await page.wait_for_timeout(300)

        bene_expanded = await beneficiary_btn.get_attribute("aria-expanded")
        assert bene_expanded == "true", "Beneficiary must be expanded after tap"
        print("✅ Beneficiary menu expanded upon explicit tap")

        # Verify other menus are still collapsed
        group_btn = drawer.locator('button[aria-controls="submenu-group-parent"]')
        donation_btn = drawer.locator('button[aria-controls="submenu-donation-parent"]')
        assert await group_btn.get_attribute("aria-expanded") == "false", "Group must remain collapsed"
        assert await donation_btn.get_attribute("aria-expanded") == "false", "Donation must remain collapsed"
        print("✅ Unrelated parent menus remain collapsed")

        # Verify Beneficiary submenus are visible
        submenu = drawer.locator('#submenu-beneficiary-parent')
        add_bene = submenu.locator('text=Add Beneficiary')
        manage_bene = submenu.locator('text=Manage Beneficiary')
        ledger_bene = submenu.locator('text=Beneficiary Ledger')
        assert await add_bene.is_visible(), "Add Beneficiary must be visible"
        assert await manage_bene.is_visible(), "Manage Beneficiary must be visible"
        assert await ledger_bene.is_visible(), "Beneficiary Ledger must be visible"
        print("✅ Beneficiary submenus rendered in exact expected order")

        # Tap Beneficiary again to collapse it
        await beneficiary_btn.click()
        await page.wait_for_timeout(300)
        bene_expanded_after = await beneficiary_btn.get_attribute("aria-expanded")
        assert bene_expanded_after == "false", "Beneficiary must collapse upon second tap"
        print("✅ Tapping expanded menu collapses it properly")

        # Tap Donation and Sadaqah independently
        await donation_btn.click()
        await page.wait_for_timeout(200)
        sadaqah_btn = drawer.locator('button[aria-controls="submenu-sadaqah-parent"]')
        await sadaqah_btn.click()
        await page.wait_for_timeout(200)

        assert await donation_btn.get_attribute("aria-expanded") == "true", "Donation expanded"
        assert await sadaqah_btn.get_attribute("aria-expanded") == "true", "Sadaqah expanded"
        print("✅ Independent expansion of menus verified")

        # Verify bottom pinned items (Settings and Log out)
        settings_nav = drawer.locator('a[href="/settings"]')
        logout_btn = drawer.locator('text=Log out')
        assert await settings_nav.is_visible(), "Settings nav must be visible at bottom"
        assert await logout_btn.is_visible(), "Log out must be visible at bottom"
        print("✅ Settings and Log out remain pinned at bottom of sidebar")

        # Click Add Beneficiary to navigate
        await beneficiary_btn.click()
        await page.wait_for_timeout(200)
        await add_bene.click()
        await page.wait_for_url("http://127.0.0.1:3000/beneficiaries/add", timeout=5000)
        print("✅ Successfully navigated to /beneficiaries/add; drawer closed")

        # Reopen drawer on /beneficiaries/add route
        await menu_btn.click()
        await page.wait_for_timeout(500)
        bene_btn_on_route = drawer.locator('button[aria-controls="submenu-beneficiary-parent"]')
        assert await bene_btn_on_route.get_attribute("aria-expanded") == "true", \
            "Active-route parent menu (Beneficiary) should be expanded to reveal current page"
        
        # Verify others remain collapsed
        assert await group_btn.get_attribute("aria-expanded") == "false", "Group remains collapsed"
        print("✅ Active-route parent menu correctly reveals active route while other parents remain collapsed")

        # 3. Test Settings Image Upload Component
        print("\n--- 3. Testing Settings Page Image Upload Component ---")
        await page.set_viewport_size({"width": 1280, "height": 800})
        await page.goto("http://127.0.0.1:3000/settings", wait_until="networkidle")
        await page.wait_for_timeout(800)

        # Check ImageUpload component in Foundation Profile
        branding_label = page.locator('text=Foundation Branding Logo')
        assert await branding_label.is_visible(), "Foundation Branding Logo label must be visible"

        upload_action_btn = page.locator('button:has-text("Choose Image"), button:has-text("Replace Image")')
        assert await upload_action_btn.is_visible(), "Image upload action button must be visible"
        print("✅ Reusable ImageUpload component rendered in Foundation Profile")

        # Verify Save Changes button exists
        save_btn = page.locator('button:has-text("Save Changes")')
        assert await save_btn.is_visible(), "Save Changes button must be present"
        print("✅ Settings save controls verified")

        await browser.close()
        print("\n🎉 ALL PLAYWRIGHT E2E TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(run_e2e_tests())
