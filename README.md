# CommunityOS

CommunityOS is a community-management platform for residents, property
administrators, security guards, and maintenance teams. It is built with React,
TypeScript, NestJS, PostgreSQL, and Prisma.

# Project Demo Video
https://drive.google.com/file/d/1RfaWBdALryEX3-SL1cI90xFLhr5o0oy1/view?usp=sharing

## Project structure

- [`backend/`](./backend) — NestJS API, PostgreSQL database, Prisma schema and
  migrations, and authentication/session endpoints.
- [`frontend/`](./frontend) — React and TypeScript resident portal with signup,
  login, persistent sessions, and a responsive dashboard.
- [`docs/`](./docs) — product/UI design, system architecture, technical
  reference, API documentation, and security notes.

# Project Screenshots
Administrator page 
<img width="1866" height="895" alt="image" src="https://github.com/user-attachments/assets/ae6d6517-7c70-4472-99a6-f80357b817e5" />

Request
<img width="1872" height="892" alt="image" src="https://github.com/user-attachments/assets/945a6d0d-d5a0-4958-8819-fca5cf89e9b4" />

Visitor Management
<img width="1860" height="900" alt="image" src="https://github.com/user-attachments/assets/684c08b3-e126-4751-ad17-c18346222826" />

Code
<img width="1871" height="877" alt="image" src="https://github.com/user-attachments/assets/d7c728a3-b976-4400-a513-0174f8415103" />

Amenities
<img width="1857" height="882" alt="image" src="https://github.com/user-attachments/assets/3d18a3dc-d823-4332-b526-208495ddf6f7" />

Request on Resident Side
<img width="1867" height="892" alt="image" src="https://github.com/user-attachments/assets/42f100e0-7d88-4548-99a0-533e1b6df583" />

Visitor Pass
<img width="1832" height="881" alt="image" src="https://github.com/user-attachments/assets/faeda4d0-9f3f-478e-bd6f-3e416660122b" />

Book
<img width="1862" height="891" alt="image" src="https://github.com/user-attachments/assets/36be5080-a0db-4791-81ba-88abd26d68f5" />

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
their community. Residents report issues from **My requests**; administrators
and maintenance staff use the **Service desk** to advance them through
resolution.

Administrators and maintenance staff can move a request from **Open** to **In
progress** and then **Resolved**. Each transition is saved with its actor,
timestamp, and optional note; residents can open **Status history** on a request
to follow those updates.

Residents can create apartment-linked visitor passes from **Visitor passes**.
Administrators and security guards use **Visitor management** to see
community-wide arrivals and record each visitor’s check-in and check-out.
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
