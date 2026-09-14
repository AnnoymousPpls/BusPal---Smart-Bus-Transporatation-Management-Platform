# BusPal Backend (PHP + MySQL, for WAMP)

Plain PHP (no framework) + MySQL backend, built to run directly under
WAMP's Apache. Replaces the Spring Boot backend (`buspal-backend/`,
kept in this project for reference only — not used by this setup).

## Setup (WAMP)

1. **Copy this whole folder** into `wamp64/www/`, e.g.
   `wamp64/www/buspal-backend-php/`.
2. **Start WAMP** — wait for the tray icon to go green.
3. **Import the schema**: open `localhost/phpmyadmin` → New → name it
   `buspal` → Import tab → choose `config/schema.sql` → Go.
   (The `CREATE DATABASE` line in that file also works if you'd rather
   run it via `mysql -u root buspal < config/schema.sql` directly.)
4. **Seed demo accounts** — passwords can't be hardcoded into SQL
   safely (see the big comment in `schema.sql` for why), so run this
   once instead: open `http://localhost/buspal-backend-php/seed.php`
   in your browser. It's safe to reload; it won't duplicate accounts
   it already created.
5. **Check `config/db.php`** — defaults match WAMP exactly (`root`,
   blank password). Only edit this if you changed WAMP's MySQL setup.
6. **Test it**: `http://localhost/buspal-backend-php/api/buses/index.php`
   should return your seeded fleet as JSON.
7. **Point the frontend at it** — wherever `buspal-platform` currently
   calls its mock `BusPalAPI`/`OpsAPI` functions, those become
   `fetch('http://localhost/buspal-backend-php/api/...')` calls. Send
   the token from login as `Authorization: Bearer <token>` on every
   subsequent request.

## How verification actually worked here

This was written in a sandbox with no direct access to your WAMP
setup, so nothing here has touched a real MySQL install. But this
environment *did* have PHP 8.3 and (surprisingly) enough access to
install a temporary MariaDB and SQLite — so verification wasn't purely
"read the code and hope." Here's exactly what was and wasn't proven:

| Module | Verification level |
|---|---|
| **Auth** (login, register, manager self-registration + approval, team CRUD, password reset) | **Full HTTP test suite**, run against real PHP + SQLite over `curl`: wrong password rejected, phone/password validation enforced, pending accounts blocked from login until approved, role-based 403s confirmed (passenger blocked from owner routes), last-owner deletion protection confirmed, duplicate-email prevention confirmed. |
| **Bookings** (search, create, cancel, delete) | **Full HTTP test suite**: public trip search, seat-conflict double-booking correctly rejected with 409, a different seat succeeds, cancelling a booking correctly frees the seat for a new search, unauthenticated booking attempts blocked. Also caught and fixed a real operator-precedence bug here (`&&`/`\|\|` mixed without parentheses) that would have let non-GET requests slip past the public/private boundary — found by testing, not by reading. |
| **Conductor trip codes** (generate, no-login lookup, counter booking) | **Full HTTP test suite**: code generation, genuinely no-login manifest lookup, counter booking without auth, manifest correctly reflects the new booking, invalid codes rejected. |
| Buses, bus photos, routes, departures, staff, fuel, maintenance, feedback, SOS, live tracking, emergency contacts | **Syntax-checked only** (`php -l`, zero errors on every file) — not run against a live database. These follow the exact same patterns (PDO prepared statements, the same `auth_helper.php`, the same response envelope) already proven correct in the modules above, but "follows a proven pattern" isn't the same guarantee as "tested." Expect to find and fix a few things once these run against your real WAMP setup — same honest caveat as every backend built in this project. |

## Endpoint reference

All endpoints live under `/api/`. Auth: send `Authorization: Bearer
<token>` (from login/register's response) on anything not marked public.

| Area | Endpoint | Notes |
|---|---|---|
| Login | `POST auth/login.php` | Public |
| Register (passenger) | `POST auth/register.php` | Public |
| Request staff access | `POST auth/request-access.php` | Public — creates a `pending` account |
| Pending requests | `GET/POST auth/pending.php` | Owner only |
| Team | `GET/POST/PATCH/DELETE auth/team.php` | Owner only |
| Password reset | `POST auth/reset-password.php` | `{email}` = public self-service, `{id}` = owner-triggered |
| Buses | `GET/POST/PATCH/DELETE buses/index.php` | GET is public |
| Bus photos | `POST/DELETE buses/photos.php` | Owner/manager, multipart upload |
| Routes | `GET/POST/PATCH/DELETE routes/index.php` | `?scope=public` for passenger-visible only |
| Departures | `POST/PATCH/DELETE routes/departures.php` | Owner/manager |
| Staff | `GET/POST/PATCH/DELETE staff/index.php` | GET is public |
| Fuel log | `GET/POST/PATCH/DELETE fuel/index.php` | Owner/manager |
| Maintenance | `GET/POST/PATCH/DELETE maintenance/index.php` | `?action=status\|send\|return\|interval` |
| Trip search | `GET bookings/index.php?from=&to=&date=` | Public |
| Bookings | `GET/POST/PATCH/DELETE bookings/index.php` | Passenger for their own; DELETE is operator-only |
| Feedback | `GET/POST/PATCH/DELETE feedback/index.php` | Role-aware (own vs. all) |
| SOS | `GET/POST/PATCH sos/index.php` | `?count=1` for the operator badge |
| Live tracking | `GET/POST/PATCH/DELETE tracking/index.php` | `?action=advance\|toggle-visible`; passenger GET is read-only lookup |
| Emergency contacts | `GET/POST/DELETE contacts/index.php` | Passenger only |
| Conductor codes | `POST conductor/index.php?action=generate` | Owner/manager |
| Conductor lookup | `GET conductor/index.php?code=XXXXXX` | **No login** — by design |
| Conductor booking | `POST conductor/index.php?action=book` | **No login** — by design |

## Known simplifications

- **Bearer tokens, not JWT** — a random 64-char token stored in
  `auth_tokens`, checked against the DB on every request. Same
  security shape as JWT (possession of the token = logged in), far
  less code, no library dependency. Trade-off: revoking a session
  means deleting the row (already done automatically on password
  reset); there's no built-in expiry — add a `created_at` check in
  `auth_helper.php`'s `require_auth()` if you want sessions to time out.
- **Seats as JSON** in `bookings.seats`, not a normalized join table —
  same simplification the Spring Boot backend used, fine at this scale.
- **CORS is wide open** (`Access-Control-Allow-Origin: *` in
  `response.php`) — tighten this to your actual frontend origin before
  this goes anywhere near a real deployment.
