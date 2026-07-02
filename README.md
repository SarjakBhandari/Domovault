# Domovault

Secure-by-design home rental management platform. 


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
cp .env.example .env   # root .env: sets Mongo's root username/password
docker compose up --build
```

The frontend is run separately with `npm run dev` inside `frontend/` and
talks to the dockerized backend through `BACKEND_ORIGIN` in its own
`.env`.

## Security notes

- JWTs are signed with a single hard-coded algorithm (HS256) everywhere;
  `jwt.verify()` always passes `algorithms: ['HS256']` explicitly. No route
  ever calls `jwt.decode()` for a trust decision.
- Passwords are hashed with Argon2id; the hash is never returned in any API
  response.
- Sensitive PII fields are encrypted at rest with AES-256-GCM via
  `backend/src/utils/crypto.js`.
- Every state-changing auth request (register/login/refresh/logout) requires
  a CSRF token (double-submit cookie), fetched from `GET /api/auth/csrf-token`.
- Every route accepts only its required HTTP method; any other verb returns
  `405 Method Not Allowed` with an `Allow` header (`src/middleware/methodGuard.js`).
- Login locks an account after exactly 15 failed attempts, with an escalating
  cooldown persisted on the user document, plus `express-rate-limit` at the
  network level.
