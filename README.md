# Domovault

Secure-by-design home rental management platform. See
`Domovault-Project-Plan.md` (repo root, one level up) for the full feature and
threat-model plan.

## Architecture

- `backend/` - Express + MongoDB/Mongoose API, runs on its own port, never
  exposed directly to the browser.
- `frontend/` - Next.js (App Router) app. Every browser-facing page lives
  here. `app/api/[...path]/route.ts` proxies all `/api/*` calls to the
  backend server-side, so the browser only ever talks to one origin.

## Local development

### Backend

```
cd backend
cp .env.example .env   # fill in real secrets, never commit .env
npm install
npm run dev
```

### Frontend

```
cd frontend
cp .env.example .env
npm install
npm run dev
```

### Full stack via Docker (backend + MongoDB)

```
docker compose up --build
```

The frontend is run separately with `npm run dev` inside `frontend/` and
talks to the dockerized backend through `BACKEND_ORIGIN` in its own
`.env`.

## Security notes

- JWTs are signed with a single hard-coded algorithm (HS256) everywhere;
  `jwt.verify()` always passes `algorithms: ['HS256']` explicitly.
- Passwords are hashed with Argon2id; the hash is never returned in any API
  response.
- Sensitive PII fields are encrypted at rest with AES-256-GCM via
  `backend/src/utils/crypto.js` (added in `feature/auth-jwt`).
