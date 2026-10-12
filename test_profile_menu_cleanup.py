import asyncio
from playwright.async_api import async_playwright

async def run_verification():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        print("\n=== STEP 1: LOGIN AS ADMIN ===")
        await page.goto("http://127.0.0.1:3000/login", wait_until="networkidle")
        await page.fill("input[name='username'], input[placeholder*='Username']", "admin")
        await page.fill("input[name='password'], input[placeholder*='Password']", "Admin@Foundation2026!")
        await page.click("button[type='submit']")
        await page.wait_for_url("http://127.0.0.1:3000/", timeout=10000)
        print("Logged in successfully as admin.")

        print("\n=== STEP 2: VERIFY DESKTOP SIDEBAR STRUCTURE ===")
        desktop_sidebar = page.locator("aside.hidden.md\\:flex")
        sidebar_text = await desktop_sidebar.inner_text()

        # 2.1 Verify user identity card remains removed from sidebar
        assert "System Administrator" not in sidebar_text, "User full name must NOT be inside sidebar"
        assert "admin@foundation.org" not in sidebar_text, "User email must NOT be inside sidebar"
        assert "@admin" not in sidebar_text, "Username @admin must NOT be inside sidebar"
        assert "RBAC Active" not in sidebar_text, "Old demo card text must NOT be in sidebar"
        assert "Switch:" not in sidebar_text, "Old switcher text must NOT be in sidebar"
        print("Duplicate sidebar user identity/profile card remains completely removed.")

        # 2.2 Verify navigation items in main scrollable section
        assert "Home" in sidebar_text, "Home must be in sidebar"
        assert "Group" in sidebar_text, "Group must be in sidebar"
        assert "Member" in sidebar_text, "Member must be in sidebar"
        assert "Beneficiary" in sidebar_text, "Beneficiary must be in sidebar"
        assert "Donation" in sidebar_text, "Donation must be in sidebar"
        assert "Sadaqah" in sidebar_text, "Sadaqah must be in sidebar"
        assert "Qard Hasan" in sidebar_text, "Qard Hasan must be in sidebar"
        assert "Contribution" in sidebar_text, "Contribution must be in sidebar"
        assert "Role Permissions" in sidebar_text, "Role Permissions must be in sidebar"
        print("Main navigation section contains all authorized modules.")

        # 2.3 Verify restored bottom actions: Settings above Log out
        bottom_section = desktop_sidebar.locator("div.mt-auto")
        assert await bottom_section.is_visible(), "Bottom actions section must be visible"
        bottom_text = await bottom_section.inner_text()
        assert "Settings" in bottom_text, "Settings must be restored at bottom of sidebar"
        assert "Log out" in bottom_text, "Log out must be restored at bottom of sidebar"

        settings_pos = bottom_text.find("Settings")
        logout_pos = bottom_text.find("Log out")
        assert settings_pos < logout_pos, "Settings must be placed above Log out"
        print("Sidebar bottom section contains Settings above Log out, separated by divider.")

        print("\n=== STEP 3: VERIFY SIDEBAR SETTINGS NAVIGATION AND ACTIVE STYLING ===")
        sidebar_settings_link = bottom_section.locator("a[href='/settings']")
        await sidebar_settings_link.click()
        await page.wait_for_url("http://127.0.0.1:3000/settings", timeout=10000)

        # Check active styling on sidebar Settings item
        settings_classes = await sidebar_settings_link.locator("div").first.get_attribute("class")
        assert "bg-black/5" in settings_classes or "font-medium" in settings_classes, f"Active styling missing on settings: {settings_classes}"
        print("Sidebar Settings navigates to /settings and preserves active-page styling.")

        print("\n=== STEP 4: VERIFY HEADER USER PROFILE BUTTON AND DROPDOWN ON DESKTOP ===")
        header = page.locator("header")
        profile_btn = header.locator("button[aria-label='User profile menu']")
        assert await profile_btn.is_visible(), "Header user profile button must be visible"

        btn_text = await profile_btn.inner_text()
        assert "System Administrator" in btn_text
        assert "Administrator" in btn_text

        # Click to open header dropdown
        await profile_btn.click()
        await page.wait_for_timeout(300)

        dropdown = header.locator("div.absolute.right-0")
        assert await dropdown.is_visible(), "Profile dropdown must appear on click"
        dropdown_text = await dropdown.inner_text()
        assert "System Administrator" in dropdown_text
        assert "admin@foundation.org" in dropdown_text
        assert "@admin" in dropdown_text
        assert "Administrator" in dropdown_text
        assert "Role Permissions" in dropdown_text
        assert "Settings" in dropdown_text
        assert "Log out" in dropdown_text
        print("Header profile dropdown contains full profile info, Role Permissions, Settings, and Log out.")

        # Close dropdown by outside click
        await page.locator("div.fixed.inset-0.z-40").click()
        await page.wait_for_timeout(200)

        print("\n=== STEP 5: VERIFY MOBILE LAYOUT AND BEHAVIOR (375px) ===")
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.wait_for_timeout(300)

        # 5.1 Mobile hamburger opens drawer with scrollable nav and pinned bottom actions
        hamburger_btn = header.locator("button[aria-label='Toggle navigation menu']")
        await hamburger_btn.click()
        await page.wait_for_timeout(300)

        mobile_drawer = page.locator("aside[aria-label='Mobile Navigation Drawer']")
        assert await mobile_drawer.is_visible(), "Mobile drawer must open on hamburger click"

        mobile_bottom_section = mobile_drawer.locator("div.mt-auto")
        assert await mobile_bottom_section.is_visible(), "Mobile drawer must display bottom actions section"
        mobile_bottom_text = await mobile_bottom_section.inner_text()
        assert "Settings" in mobile_bottom_text, "Mobile drawer bottom must contain Settings"
        assert "Log out" in mobile_bottom_text, "Mobile drawer bottom must contain Log out"

        # Verify no duplicate user identity card in mobile drawer
        drawer_full_text = await mobile_drawer.inner_text()
        assert "System Administrator" not in drawer_full_text, "User profile card must NOT be in mobile drawer"

        # Close mobile drawer via close button
        close_btn = mobile_drawer.locator("button[aria-label='Close menu drawer']")
        await close_btn.click()
        await page.wait_for_timeout(300)
        assert not (await mobile_drawer.is_visible()), "Mobile drawer must close on close button"

        # 5.2 Header profile dropdown opens independently on mobile with zero horizontal scroll
        mobile_profile_btn = header.locator("button[aria-label='User profile menu']")
        await mobile_profile_btn.click()
        await page.wait_for_timeout(300)

        mobile_dropdown = header.locator("div.absolute.right-0")
        assert await mobile_dropdown.is_visible(), "Mobile header dropdown must open"
        scroll_width_375 = await page.evaluate("() => document.documentElement.scrollWidth")
        inner_width_375 = await page.evaluate("() => window.innerWidth")
        assert scroll_width_375 <= inner_width_375, f"Horizontal overflow at 375px! scrollWidth={scroll_width_375}, innerWidth={inner_width_375}"

        # Close mobile dropdown
        await page.locator("div.fixed.inset-0.z-40").click()
        await page.wait_for_timeout(200)
        print("Mobile drawer and header dropdown verified with zero overflow.")

        print("\n=== STEP 6: VERIFY SIDEBAR LOGOUT ACTION EXECUTES SECURE LOGOUT ===")
        await page.set_viewport_size({"width": 1280, "height": 900})
        sidebar_logout_btn = desktop_sidebar.locator("div.mt-auto span:has-text('Log out')")
        await sidebar_logout_btn.click()
        await page.wait_for_url("http://127.0.0.1:3000/login", timeout=10000)
        print("Sidebar Log out button executed secure logout and redirected to /login.")

        print("\n=== STEP 7: VERIFY RBAC IN SIDEBAR BOTTOM ACTIONS FOR VIEWER (WITHOUT settings.view) ===")
        await page.fill("input[name='username'], input[placeholder*='Username']", "viewer")
        await page.fill("input[name='password'], input[placeholder*='Password']", "Viewer@Foundation2026!")
        await page.click("button[type='submit']")
        await page.wait_for_url("http://127.0.0.1:3000/", timeout=10000)

        v_bottom_section = page.locator("aside.hidden.md\\:flex div.mt-auto")
        v_bottom_text = await v_bottom_section.inner_text()
        assert "Settings" not in v_bottom_text, "Viewer without settings.view must NOT see Settings in sidebar bottom"
        assert "Log out" in v_bottom_text, "Viewer must see Log out in sidebar bottom"
        print("Viewer correctly sees Log out only, and NOT Settings in sidebar bottom.")

        # Log out viewer via header dropdown to test header logout as well
        await page.locator("header button[aria-label='User profile menu']").click()
        await page.wait_for_timeout(300)
        await page.click("header div.absolute.right-0 button:has-text('Log out')")
        await page.wait_for_url("http://127.0.0.1:3000/login", timeout=10000)
        print("Header dropdown Log out button also verified successfully.")

        print("\n=== STEP 8: VERIFY RBAC IN SIDEBAR BOTTOM ACTIONS FOR FINANCE OFFICER (WITH settings.view) ===")
        await page.fill("input[name='username'], input[placeholder*='Username']", "finance")
        await page.fill("input[name='password'], input[placeholder*='Password']", "Finance@Foundation2026!")
        await page.click("button[type='submit']")
        await page.wait_for_url("http://127.0.0.1:3000/", timeout=10000)

        f_bottom_section = page.locator("aside.hidden.md\\:flex div.mt-auto")
        f_bottom_text = await f_bottom_section.inner_text()
        assert "Settings" in f_bottom_text, "Finance Officer with settings.view MUST see Settings in sidebar bottom"
        assert "Log out" in f_bottom_text, "Finance Officer must see Log out in sidebar bottom"
        print("Finance Officer correctly sees both Settings and Log out in sidebar bottom.")

        print("\n=== ALL PLAYWRIGHT VERIFICATION CHECKS PASSED SUCCESSFULLY! ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
