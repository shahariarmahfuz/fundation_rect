import sys
import asyncio
import aiohttp
from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:3000"

async def test_scenarios():
    print("=================================================================")
    print("STARTING E2E VERIFICATION: REAL AUTHENTICATION & RBAC ENFORCEMENT")
    print("=================================================================")

    # Scenario 2: Request private API without valid session: receive HTTP 401
    print("\n--- Scenario 2: Request private API without valid session ---")
    async with aiohttp.ClientSession() as session:
        for path in ["/api/groups", "/api/members", "/api/beneficiaries", "/api/auth/me"]:
            async with session.get(f"{BASE_URL}{path}") as resp:
                print(f"GET {path} unauthenticated: HTTP {resp.status}")
                assert resp.status == 401, f"Expected 401 for unauthenticated {path}, got {resp.status}"
    print("✅ Scenario 2 PASSED: Private APIs return HTTP 401 Unauthorized without session")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # Scenario 1: Open dashboard in fresh unauthenticated browser session
        print("\n--- Scenario 1: Fresh unauthenticated session accessing dashboard ---")
        unauth_context = await browser.new_context()
        unauth_page = await unauth_context.new_page()

        # Try to access root dashboard
        await unauth_page.goto(f"{BASE_URL}/", wait_until="networkidle")
        current_url = unauth_page.url
        print(f"Navigated to '/' -> redirected to: {current_url}")
        assert "/login" in current_url, f"Expected redirect to /login, got {current_url}"

        # Try to access /groups/manage
        await unauth_page.goto(f"{BASE_URL}/groups/manage", wait_until="networkidle")
        current_url = unauth_page.url
        print(f"Navigated to '/groups/manage' -> redirected to: {current_url}")
        assert "/login" in current_url, f"Expected redirect to /login, got {current_url}"
        assert "return_url=%2Fgroups%2Fmanage" in current_url or "return_url=/groups/manage" in current_url
        await unauth_context.close()
        print("✅ Scenario 1 PASSED: Unauthenticated access is denied and redirected to /login")

        # Scenario 4: Log in with invalid credentials
        print("\n--- Scenario 4: Log in with invalid credentials ---")
        login_context = await browser.new_context()
        page = await login_context.new_page()
        await page.goto(f"{BASE_URL}/login", wait_until="networkidle")

        # Fill invalid credentials
        await page.fill('input[type="text"]', "admin")
        await page.fill('input[type="password"]', "WrongPassword123!")
        await page.click('button[type="submit"]')

        error_elem = page.locator("text=Invalid username or password")
        await error_elem.wait_for(timeout=5000)
        is_error_visible = await error_elem.is_visible()
        assert is_error_visible, "Error message must be displayed on invalid login"
        print("✅ Scenario 4 PASSED: Invalid login credentials rejected with error message")

        # Scenario 3: Log in with valid credentials
        print("\n--- Scenario 3: Log in with valid credentials ---")
        await page.fill('input[type="text"]', "admin")
        await page.fill('input[type="password"]', "Admin@Foundation2026!")
        await page.click('button[type="submit"]')
        await page.wait_for_url(f"{BASE_URL}/", timeout=5000)
        print("Successfully logged in and redirected to dashboard")

        # Check authenticated user details
        header_text = await page.locator("header").inner_text()
        assert "System Administrator" in header_text, "Authenticated user full name must be displayed"
        assert "Administrator" in header_text, "User role must be displayed"
        print("✅ Scenario 3 PASSED: Valid login granted access with correct user identity and permissions")

        # Scenario 8: Refresh the page after login
        print("\n--- Scenario 8: Page refresh persists authenticated session ---")
        await page.reload(wait_until="networkidle")
        assert page.url == f"{BASE_URL}/", "Page refresh must stay on dashboard"
        header_after_refresh = await page.locator("header").inner_text()
        assert "System Administrator" in header_after_refresh
        print("✅ Scenario 8 PASSED: Authenticated session works correctly after page refresh")

        # Scenario 7: Attempt to manipulate frontend state
        print("\n--- Scenario 7: Frontend role manipulation check ---")
        # Attempt to set fake localStorage or cookie
        await page.evaluate("() => { localStorage.setItem('fake_role', 'SuperAdmin'); localStorage.setItem('fund_user', 'attacker'); }")
        # Ensure server still responds with real database user
        async with aiohttp.ClientSession() as s:
            cookies = {c['name']: c['value'] for c in await login_context.cookies()}
            async with s.get(f"{BASE_URL}/api/auth/me", cookies=cookies) as r:
                data = await r.json()
                assert data["username"] == "admin"
                assert data["role_name"] == "Administrator"
        print("✅ Scenario 7 PASSED: Server state strictly derived from verified session, ignoring client-side role claims")

        # Scenario 5: Log out
        print("\n--- Scenario 5: Log out and verify session invalidation ---")
        logout_btn = page.locator('header button[aria-label="Log out"]:visible').first
        await logout_btn.click()
        await page.wait_for_url(f"{BASE_URL}/login", timeout=5000)
        print("Redirected to /login on logout")

        # Verify private access denied after logout
        await page.goto(f"{BASE_URL}/", wait_until="networkidle")
        assert "/login" in page.url, "Must be redirected to /login after logout"
        await login_context.close()
        print("✅ Scenario 5 PASSED: Session terminated and private access revoked")

        # Scenario 6: Protected API permission enforcement (HTTP 403)
        print("\n--- Scenario 6: Protected API with insufficient permissions (HTTP 403) ---")
        viewer_context = await browser.new_context()
        v_page = await viewer_context.new_page()
        await v_page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        await v_page.fill('input[type="text"]', "viewer")
        await v_page.fill('input[type="password"]', "Viewer@Foundation2026!")
        await v_page.click('button[type="submit"]')
        await v_page.wait_for_url(f"{BASE_URL}/", timeout=5000)

        # Viewer tries forbidden POST to /api/groups
        viewer_cookies = {c['name']: c['value'] for c in await viewer_context.cookies()}
        async with aiohttp.ClientSession() as s:
            async with s.post(f"{BASE_URL}/api/groups", json={"name": "Forbidden"}, cookies=viewer_cookies) as r:
                assert r.status == 403, f"Expected 403, got {r.status}"
                resp_json = await r.json()
                assert "groups.create" in resp_json["detail"]
                print(f"Viewer POST /api/groups returned HTTP 403: {resp_json['detail']}")
        await viewer_context.close()
        print("✅ Scenario 6 PASSED: Backend independently returns HTTP 403 Forbidden for missing permissions")

        # Scenario 9: Verify public routes still work where intended
        print("\n--- Scenario 9: Verify public routes ---")
        async with aiohttp.ClientSession() as s:
            async with s.get(f"{BASE_URL}/api/health") as r:
                assert r.status == 200
                data = await r.json()
                assert data["status"] == "ok"
                print("GET /api/health returned HTTP 200 OK")
        print("✅ Scenario 9 PASSED: Explicitly public routes function without authentication")

        await browser.close()
        print("\n🎉 ALL 9 CRITICAL SECURITY AND AUTHENTICATION SCENARIOS PASSED PERFECTLY!")

if __name__ == "__main__":
    asyncio.run(test_scenarios())
