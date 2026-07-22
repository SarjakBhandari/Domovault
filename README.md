# Domovault

Secure rental management platform. Three roles: admin (landlord), tenant, applicant.

## Quick start

**Requirements:** Node.js 20+, MongoDB

```
# Terminal 1 — backend
cd backend && npm install && npm run dev

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
```

Open `http://localhost:3000`.

**Admin login:** `admin1987@local.com` / `admin569!pp+_22355`

If the admin account is missing: `cd backend && node scripts/reset-admin.js`

## Docker

```
docker compose up --build   # starts Mongo + backend
cd frontend && npm run dev  # frontend still runs separately
```

## Email (local dev)

Emails go to an SMTP server on port 1025. Install [Mailpit](https://mailpit.axllent.org/) to catch them.

## Roles and pages

| Role | How to get it | Key pages |
|---|---|---|
| Admin | Seeded from `.env` | `/admin`, `/admin/properties`, `/admin/applications`, `/admin/billing`, `/admin/tenants`, `/admin/users`, `/admin/maintenance`, `/admin/audit` |
| Applicant | Register at `/register` | `/browse`, `/applications`, `/profile`, `/data-export` |
| Tenant | Promoted by admin | All applicant pages + `/lease`, `/billing`, `/maintenance` |

## Security

- Argon2id password hashing
- AES-256-GCM encryption at rest for national ID and MFA secrets
- HS256 JWT (algorithm hard-coded, never negotiated)
- CSRF double-submit tokens on all state-changing requests
- 15-attempt brute-force lockout with escalating cooldown
- Refresh tokens stored as SHA-256 hashes; reuse detection revokes the session
- TOTP two-factor authentication with one-time backup codes
- Rate limiting (30 req/15 min per IP)
- SSRF protection on outbound fetches
- Magic-byte file type validation + EXIF stripping on uploads
