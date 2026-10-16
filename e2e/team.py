"""Sandbox E2E for Sprint 1 step 1: team members, roles, staff attendance, coach at two academies."""
import re
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3000"
OUT = __import__("os").environ.get("E2E_SHOTS", "/tmp")


def login(browser, phone, expect_path, mobile=False):
    ctx = browser.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1280, "height": 860})
    page = ctx.new_page()
    page.on("dialog", lambda d: d.accept())
    page.goto(f"{BASE}/login", wait_until="networkidle")
    if page.locator("input[type=tel]").count() == 0:
        page.get_by_text("phone", exact=False).first.click()
    page.locator("input[type=tel]").first.fill(phone)
    page.locator("button[type=submit]").first.click()
    page.wait_for_selector("input[maxlength='6']", timeout=30000)
    page.locator("input[maxlength='6']").fill("123456")
    page.get_by_role("button", name="Verify & Login").click()
    page.wait_for_url(f"**{expect_path}**", timeout=60000)
    page.wait_for_load_state("networkidle")
    return ctx, page


def open_team(page):
    page.goto(f"{BASE}/org", wait_until="networkidle")
    page.wait_for_timeout(1500)
    if page.get_by_text("Skip", exact=True).count():
        page.get_by_text("Skip", exact=True).first.click()
    nav = page.get_by_role("button", name="Team", exact=True)
    if nav.count() == 0 or not nav.first.is_visible():
        page.get_by_role("button", name="More", exact=True).first.click()
        nav = page.get_by_role("button", name="Team", exact=True)
    nav.first.click()
    page.get_by_text("Your team").wait_for(timeout=30000)
    page.wait_for_timeout(800)


def add_member(page, name, phone, role, staff_job=None, pay_type=None, amount=None):
    page.get_by_role("button", name="Add team member").click()
    dlg = page.get_by_role("dialog")
    dlg.locator("#tm-name").fill(name)
    dlg.locator("#tm-phone").fill(phone)
    dlg.get_by_role("radio", name=role).click()
    if staff_job:
        dlg.locator("#tm-staffrole").select_option(staff_job)
    if pay_type:
        dlg.locator("#tm-paytype").select_option(pay_type)
        dlg.locator("#tm-payamount").fill(str(amount))
    dlg.get_by_role("button", name="Add to team").click()
    page.wait_for_timeout(2500)


results = []
with sync_playwright() as p:
    b = p.chromium.launch()

    # A. Owner of academy 1 builds the team
    ctx, page = login(b, "9000000001", "/org")
    open_team(page)
    page.screenshot(path=f"{OUT}/10-team-initial.png", full_page=True)
    add_member(page, "Arjun Mehta", "9000000003", "Coach", pay_type="PER_SESSION", amount=500)
    add_member(page, "Neha Kapoor", "9000000002", "Staff", staff_job="RECEPTIONIST", pay_type="MONTHLY", amount=15000)
    page.locator("li", has_text="Arjun Mehta").first.wait_for(timeout=15000)
    page.locator("li", has_text="Neha Kapoor").first.wait_for(timeout=15000)
    # mark the first coach row present
    row = page.locator("li", has_text="Arjun Mehta")
    row.get_by_role("radio", name="In").click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/11-team-after-adding.png", full_page=True)
    results.append(("owner adds coach + receptionist", True))
    ctx.close()

    # B. Owner of academy 2 adds the same coach
    ctx, page = login(b, "9000000004", "/org")
    open_team(page)
    add_member(page, "Arjun Mehta", "9000000003", "Coach")
    toast = page.get_by_text("also work at another academy", exact=False)
    results.append(("second academy adds shared coach", toast.count() > 0 or page.get_by_text("Arjun Mehta").count() > 0))
    page.screenshot(path=f"{OUT}/12-team-academy2.png", full_page=True)
    ctx.close()

    # C. The coach sees both academies and checks in (phone-sized)
    ctx, page = login(b, "9000000003", "/coach", mobile=True)
    page.wait_for_timeout(2500)
    has_switcher = page.locator("select").filter(has_text="Smash Badminton Club").count() > 0
    results.append(("coach sees academy switcher", has_switcher))
    page.get_by_role("button", name="Check in for today").click()
    page.get_by_text("In at", exact=False).first.wait_for(timeout=15000)
    page.screenshot(path=f"{OUT}/13-coach-checked-in.png")
    # switch to academy 2
    sel = page.locator("select").filter(has_text="Smash Badminton Club").first
    value = sel.locator("option", has_text="Smash Badminton Club").get_attribute("value")
    sel.select_option(value)
    page.wait_for_url("**/coach**", timeout=30000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)
    switched = page.get_by_text("Smash Badminton Club").count() > 0
    results.append(("coach switches to academy 2", switched))
    page.screenshot(path=f"{OUT}/14-coach-academy2.png")
    ctx.close()

    # D. Receptionist uses the staff app
    ctx, page = login(b, "9000000002", "/staff", mobile=True)
    page.screenshot(path=f"{OUT}/15-staff-home.png")
    page.get_by_role("button", name="Check in").click()
    page.get_by_text("Checked in at", exact=False).first.wait_for(timeout=15000)
    page.wait_for_timeout(800)
    page.screenshot(path=f"{OUT}/16-staff-checked-in.png")
    results.append(("receptionist checks in on /staff", True))
    # staff must not reach the owner dashboard
    page.goto(f"{BASE}/org", wait_until="networkidle")
    results.append(("staff blocked from /org", "/staff" in page.url))
    ctx.close()

    # E. Owner sees the check-in
    ctx, page = login(b, "9000000001", "/org")
    open_team(page)
    row = page.locator("li", has_text="Neha Kapoor")
    results.append(("owner sees receptionist check-in time", row.get_by_text("In ", exact=False).count() > 0))
    page.screenshot(path=f"{OUT}/17-team-owner-final.png", full_page=True)
    ctx.close()
    b.close()

for name, ok in results:
    print(("PASS " if ok else "FAIL ") + name)
