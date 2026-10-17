# End-to-end checks (Playwright, Python)

Browser journeys run against a **local** app with a **test database** — never production.

| Script | Covers |
|---|---|
| `team.py` | Owner adds coach + receptionist, coach at two academies, staff check-in, staff blocked from `/org` |
| `payroll.py` | Per-session and monthly pay, absence deduction, mark paid / undo, WhatsApp payslip, expenses, phone layout |
| `today.py` | Today screen: team check-ins, money strip, absent students with WhatsApp to parent, phone layout |

## Requirements
- App running at `http://localhost:3000` against a seeded test database (`npm run db:seed`, then the SQL files here).
- Test login phones `9000000001`–`9000000004` with `OTP_TEST_PHONES` / `OTP_TEST_CODE=123456` set in `.env.local`.
- `pip install playwright && playwright install chromium`

## Run
```
psql "$DATABASE_URL" -f e2e/reset_team.sql
python e2e/team.py
psql "$DATABASE_URL" -f e2e/seed_payroll.sql -f e2e/seed_today.sql
python e2e/payroll.py
python e2e/today.py
```
Login is rate-limited to 3 OTPs per phone per minute; wait a minute between runs.
Screenshots go to `$E2E_SHOTS` (default `/tmp`).
