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

        print("\n=== STEP 2: VERIFY DESKTOP SIDEBAR CONTAINS ONLY NAVIGATION ITEMS ===")
        desktop_sidebar = page.locator("aside.hidden.md\\:flex")
        sidebar_text = await desktop_sidebar.inner_text()

        # Verify duplicate profile UI is completely absent from sidebar
        assert "System Administrator" not in sidebar_text, "User full name must NOT be inside sidebar"
        assert "admin@foundation.org" not in sidebar_text, "User email must NOT be inside sidebar"
        assert "@admin" not in sidebar_text, "Username @admin must NOT be inside sidebar"
        assert "RBAC Active" not in sidebar_text, "Old demo card text must NOT be in sidebar"
        assert "Switch:" not in sidebar_text, "Old switcher text must NOT be in sidebar"
        assert "Log out" not in sidebar_text, "Log out must NOT be at bottom of sidebar"

        # Verify pure navigation items ARE present
        assert "Home" in sidebar_text, "Home must be in sidebar"
        assert "Group" in sidebar_text, "Group must be in sidebar"
        assert "Member" in sidebar_text, "Member must be in sidebar"
        assert "Beneficiary" in sidebar_text, "Beneficiary must be in sidebar"
        assert "Donation" in sidebar_text, "Donation must be in sidebar"
        assert "Sadaqah" in sidebar_text, "Sadaqah must be in sidebar"
        assert "Qard Hasan" in sidebar_text, "Qard Hasan must be in sidebar"
        assert "Contribution" in sidebar_text, "Contribution must be in sidebar"
        assert "Role Permissions" in sidebar_text, "Role Permissions must be in sidebar"
        print("Desktop sidebar contains navigation items ONLY (no duplicate user profile card or bottom actions).")

        print("\n=== STEP 3: VERIFY HEADER USER PROFILE BUTTON AND DROPDOWN ON DESKTOP ===")
        header = page.locator("header")
        profile_btn = header.locator("button[aria-label='User profile menu']")
        assert await profile_btn.is_visible(), "Header user profile button must be visible"

        # Profile button shows user's name & role
        btn_text = await profile_btn.inner_text()
        assert "System Administrator" in btn_text, "Profile button must show user full name"
        assert "Administrator" in btn_text, "Profile button must show user role"

        # Click to open dropdown
        await profile_btn.click()
        await page.wait_for_timeout(300)

        # Dropdown items check
        dropdown = header.locator("div.absolute.right-0")
        assert await dropdown.is_visible(), "Profile dropdown must appear on click"
        dropdown_text = await dropdown.inner_text()
        assert "System Administrator" in dropdown_text, "Dropdown must display user full name"
        assert "admin@foundation.org" in dropdown_text, "Dropdown must display email"
        assert "@admin" in dropdown_text, "Dropdown must display username"
        assert "Administrator" in dropdown_text, "Dropdown must display role badge"
        assert "Role Permissions" in dropdown_text, "Admin must see Role Permissions in profile dropdown"
        assert "Settings" in dropdown_text, "Admin must see Settings in profile dropdown"
        assert "Log out" in dropdown_text, "Dropdown must contain Log out button"
        print("Header profile dropdown on desktop correctly displays full profile, Role Permissions, Settings, and Log out.")

        # Click backdrop to close
        await page.locator("div.fixed.inset-0.z-40").click()
        await page.wait_for_timeout(200)
        assert not (await dropdown.is_visible()), "Dropdown must close when clicking outside"
        print("Profile dropdown closes on outside click.")

        print("\n=== STEP 4: VERIFY MOBILE RESPONSIVENESS AND BEHAVIOR (375px) ===")
        await page.set_viewport_size({"width": 375, "height": 812})
        await page.wait_for_timeout(300)

        # 4.1 Mobile profile button can be opened independently without opening sidebar
        mobile_profile_btn = header.locator("button[aria-label='User profile menu']")
        assert await mobile_profile_btn.is_visible(), "Mobile header profile button must be visible"
        await mobile_profile_btn.click()
        await page.wait_for_timeout(300)

        mobile_dropdown = header.locator("div.absolute.right-0")
        assert await mobile_dropdown.is_visible(), "Mobile profile dropdown opens independently"
        mobile_dropdown_text = await mobile_dropdown.inner_text()
        assert "System Administrator" in mobile_dropdown_text
        assert "admin@foundation.org" in mobile_dropdown_text
        assert "Settings" in mobile_dropdown_text
        assert "Log out" in mobile_dropdown_text

        # Verify no horizontal scroll on mobile
        scroll_width = await page.evaluate("() => document.documentElement.scrollWidth")
        inner_width = await page.evaluate("() => window.innerWidth")
        assert scroll_width <= inner_width, f"Horizontal overflow detected! scrollWidth={scroll_width}, innerWidth={inner_width}"
        print("Mobile profile dropdown opens independently with zero horizontal scroll.")

        # Close dropdown
        await page.locator("div.fixed.inset-0.z-40").click()
        await page.wait_for_timeout(200)

        # 4.2 Hamburger button opens sidebar drawer
        hamburger_btn = header.locator("button[aria-label='Toggle navigation menu']")
        await hamburger_btn.click()
        await page.wait_for_timeout(300)

        mobile_drawer = page.locator("aside[aria-label='Mobile Navigation Drawer']")
        assert await mobile_drawer.is_visible(), "Mobile navigation drawer must open on hamburger click"
        drawer_text = await mobile_drawer.inner_text()

        # Drawer must contain navigation only
        assert "System Administrator" not in drawer_text, "User info must NOT be in mobile drawer"
        assert "Log out" not in drawer_text, "Log out must NOT be inside mobile drawer"
        assert "Home" in drawer_text
        assert "Group" in drawer_text
        assert "Member" in drawer_text

        # Close mobile drawer via X button
        close_btn = mobile_drawer.locator("button[aria-label='Close menu drawer']")
        await close_btn.click()
        await page.wait_for_timeout(300)
        assert not (await mobile_drawer.is_visible()), "Mobile drawer closes on close button"
        print("Mobile drawer opens and closes cleanly with navigation items only.")

        print("\n=== STEP 5: VERIFY NARROW MOBILE (320px) ZERO OVERFLOW ===")
        await page.set_viewport_size({"width": 320, "height": 600})
        await page.wait_for_timeout(200)
        await mobile_profile_btn.click()
        await page.wait_for_timeout(300)

        scroll_width_320 = await page.evaluate("() => document.documentElement.scrollWidth")
        inner_width_320 = await page.evaluate("() => window.innerWidth")
        assert scroll_width_320 <= inner_width_320, f"Horizontal overflow at 320px! scrollWidth={scroll_width_320}, innerWidth={inner_width_320}"
        print("Narrow 320px mobile viewport verified with zero overflow.")

        # Close dropdown
        await page.locator("div.fixed.inset-0.z-40").click()
        await page.wait_for_timeout(200)

        print("\n=== STEP 6: VERIFY LOGOUT ACTION IN HEADER PROFILE DROPDOWN ===")
        await page.set_viewport_size({"width": 1280, "height": 900})
        await page.locator("header button[aria-label='User profile menu']").click()
        await page.wait_for_timeout(300)
        # Click Log out inside dropdown
        await page.click("header div.absolute.right-0 button:has-text('Log out')")
        await page.wait_for_url("http://127.0.0.1:3000/login", timeout=10000)
        print("Logged out successfully via header profile menu.")

        print("\n=== STEP 7: VERIFY RBAC IN HEADER PROFILE DROPDOWN FOR VIEWER ===")
        await page.fill("input[name='username'], input[placeholder*='Username']", "viewer")
        await page.fill("input[name='password'], input[placeholder*='Password']", "Viewer@Foundation2026!")
        await page.click("button[type='submit']")
        await page.wait_for_url("http://127.0.0.1:3000/", timeout=10000)

        v_profile_btn = page.locator("header button[aria-label='User profile menu']")
        await v_profile_btn.click()
        await page.wait_for_timeout(300)

        v_dropdown = page.locator("header div.absolute.right-0")
        v_dropdown_text = await v_dropdown.inner_text()
        assert "Alice Viewer" in v_dropdown_text
        assert "Viewer" in v_dropdown_text
        assert "Role Permissions" not in v_dropdown_text, "Viewer must NOT see Role Permissions link"
        assert "Settings" not in v_dropdown_text, "Viewer without settings.view must NOT see Settings link"
        assert "Log out" in v_dropdown_text, "Viewer must see Log out"
        print("Viewer correctly sees name, role, email, and Log out, but neither Role Permissions nor Settings.")

        # Log out as viewer
        await page.click("header div.absolute.right-0 button:has-text('Log out')")
        await page.wait_for_url("http://127.0.0.1:3000/login", timeout=10000)

        print("\n=== STEP 8: VERIFY RBAC IN HEADER PROFILE DROPDOWN FOR FINANCE OFFICER ===")
        await page.fill("input[name='username'], input[placeholder*='Username']", "finance")
        await page.fill("input[name='password'], input[placeholder*='Password']", "Finance@Foundation2026!")
        await page.click("button[type='submit']")
        await page.wait_for_url("http://127.0.0.1:3000/", timeout=10000)

        f_profile_btn = page.locator("header button[aria-label='User profile menu']")
        await f_profile_btn.click()
        await page.wait_for_timeout(300)

        f_dropdown = page.locator("header div.absolute.right-0")
        f_dropdown_text = await f_dropdown.inner_text()
        assert "Bob Finance" in f_dropdown_text
        assert "Finance Officer" in f_dropdown_text
        assert "Role Permissions" not in f_dropdown_text, "Finance Officer lacks roles.manage, must NOT see Role Permissions"
        assert "Settings" in f_dropdown_text, "Finance Officer has settings.view, MUST see Settings"
        assert "Log out" in f_dropdown_text
        print("Finance Officer correctly sees Settings and Log out, but not Role Permissions.")

        print("\n=== ALL PLAYWRIGHT VERIFICATION CHECKS PASSED SUCCESSFULLY! ===")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_verification())
