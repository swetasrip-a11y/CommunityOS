# CommunityOS

CommunityOS is a community-management platform for residents, property
administrators, security guards, and maintenance teams. It is built with React,
TypeScript, NestJS, PostgreSQL, and Prisma.

## Project structure

- [`backend/`](./backend) — NestJS API, PostgreSQL database, Prisma schema and
  migrations, and authentication/session endpoints.
- [`frontend/`](./frontend) — React and TypeScript resident portal with signup,
  login, persistent sessions, and a responsive dashboard.
- [`docs/`](./docs) — product/UI design, system architecture, technical
  reference, API documentation, and security notes.

## Run locally on Windows

Install Node.js 20 or newer and Docker Desktop first. Start Docker Desktop
before starting the database.

### 1. Start the backend and database

Open a PowerShell terminal at the project folder and run:

```powershell
Set-Location .\backend
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
npm run db:up
npm run prisma:generate
npx prisma migrate deploy
npm run start:dev
```

Keep this terminal open. The API runs at `http://localhost:3000`.

### 2. Start the frontend

Open a second PowerShell terminal at the project folder and run:

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Open the Vite URL printed in that terminal (normally
`http://localhost:5173`). Sign up to create an account, then create a community
to become its first administrator.

For later runs, start Docker Desktop and run `npm run db:up` and
`npm run start:dev` in the backend terminal, then `npm run dev` in the
frontend terminal. Do not repeat the `.env` copy step if the file already
exists. To stop the local database container without deleting its saved data,
run `npm run db:down` from the backend folder.

The local PostgreSQL container listens on port `5433` to avoid conflicting
with a PostgreSQL service already using the default port. Its Docker volume is
retained when the container is stopped with `npm run db:down`.

The frontend proxies `/auth` and `/communities` requests to the backend on
port `3000`. If the frontend is started on a different origin, configure that
origin in the backend's `FRONTEND_ORIGINS`.

After signing up, create a community to become its first administrator, then
add blocks and apartments from **Blocks & homes**. Only community administrators
can manage this structure; shared structure views do not expose apartment
numbers to non-administrators. Members can view only apartments linked to their
own account when creating visitor passes. Administrators can create single-use,
apartment-specific invitation codes from **Invitations**. A resident signs in
or creates an account, then redeems the code to join with resident access. Codes expire after seven days,
are stored as hashes, and can be revoked before redemption. The dashboard’s
request tracker now saves issues to PostgreSQL: residents see their own
requests, while administrators and maintenance staff can see requests across
their community. New reports appear at the top of the dashboard and under
**My requests**. Maintenance payments remain preview data for now.

Administrators and maintenance staff can move a request from **Open** to **In
progress** and then **Resolved**. Each transition is saved with its actor,
timestamp, and optional note; residents can open **Status history** on a request
to follow those updates.

Residents can also create apartment-linked visitor passes from **Visitor log**.
Administrators and security guards can see all passes in their community and
record each visitor’s check-in and check-out.
Administrators can grant or remove security-guard access for active members in
the **Security team** section.

Administrators can add shared spaces and pause or resume their availability
from **Amenities**. Active community members can check the upcoming schedule,
book an open time for up to four hours, and cancel their own reservations.
Overlapping reservations are rejected, including simultaneous booking attempts.

Account data is stored in PostgreSQL, not in source code:

- Database: `communityos` on `localhost:5433` in local development.
- Account records: the `User` table. Passwords are bcrypt hashes.
- Persistent login sessions: the `AuthSession` table. Only a hash of the
  browser's HttpOnly session cookie is stored.
- The persistent login cookie renews when used. Browser cookie limits may sign
  you out after 400 days without using the app.
- The Docker volume `communityos-postgres-data` keeps the database data when
  the container is stopped. Do not delete this volume if you want to preserve
  accounts.

Signing out revokes the current session.
