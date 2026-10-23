# CommunityOS technical reference

## Technology stack

| Layer | Technology | Role |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite 8 | Interactive, typed browser application and fast local development |
| Backend | Node.js, NestJS 10, TypeScript | Modular HTTP API, dependency injection, guards, DTO validation, and business rules |
| Persistence | PostgreSQL 16 | Relational, transactional storage with community-scoped foreign keys |
| Data access | Prisma 6 | Typed database client, schema, and versioned migrations |
| Authentication | JWT, bcryptjs, Node crypto, HttpOnly cookie | Short access tokens, password hashing, and persistent refresh sessions |
| UI fonts | DM Sans, Space Grotesk | Locally bundled typography for body copy and headings |
| Local infrastructure | Docker Compose | Repeatable local PostgreSQL service with persistent volume |

See [TECH_STACK.md](./TECH_STACK.md) for the selection rationale.

## Repository map

```text
backend/
  prisma/
    schema.prisma
    migrations/
  src/
    auth/
    communities/
    requests/
    visitors/
    amenities/
    prisma/
  test/                    API/e2e tests
frontend/
  src/
    assets/
    main.tsx               React application and feature screens
    style.css              Responsive visual system
docs/
```

## Data model

The canonical schema is `backend/prisma/schema.prisma`. UUIDs are used for
primary identifiers; timestamps use PostgreSQL `timestamptz(3)`.

| Entity | Purpose and key relationships |
| --- | --- |
| `User` | Account identity, email, full name, and bcrypt password hash |
| `AuthSession` | Persistent login session by SHA-256 token hash; belongs to a user |
| `Community` | Tenant root and owner of blocks, memberships, requests, visitors, and amenities |
| `Block` | Community building/tower; owns units; block code is unique within its community |
| `Unit` | Apartment within a block; apartment number is unique per block |
| `CommunityMembership` | User's active/invited/suspended participation in one community |
| `CommunityMembershipRole` | Join table for one or more roles per membership |
| `CommunityMembershipUnit` | Apartment assignment and occupancy relationship |
| `CommunityInvitation` | Hashed, expiring, single-use invitation linked to an apartment |
| `ServiceRequest` | Member-created issue with category and current state |
| `ServiceRequestStatusUpdate` | Append-only transition record with actor, old/new status, note, and timestamp |
| `VisitorPass` | Apartment-linked expected visitor and check-in/out details |
| `Amenity` | Community-managed bookable shared space and active flag |
| `AmenityBooking` | Membership's interval reservation with confirmed/cancelled state |

The database uses composite foreign keys to enforce community consistency for
membership and amenity relationships. Cascading deletion is configured for
community-owned operational data.

## Domain state machines

### Service request

```text
OPEN -> IN_PROGRESS -> RESOLVED
```

Only administrators and maintenance staff can advance the state; resolved
requests are terminal.

### Visitor pass

```text
EXPECTED -> CHECKED_IN -> CHECKED_OUT
```

Only administrators and security guards can record entry actions. The actor
and time are stored separately for check-in and check-out.

### Amenity booking

```text
CONFIRMED -> CANCELLED
```

Bookings must start in the future, have a positive duration no longer than
four hours, and not overlap another confirmed booking for the same amenity.

## Authentication/session behavior

- Registration normalizes email and hashes passwords with bcryptjs using 12
  rounds. Passwords are limited to bcrypt's 72-byte UTF-8 maximum.
- Access JWTs expire after 15 minutes. The frontend keeps the access token in
  memory and refreshes through the auth API.
- A 32-byte random session token is stored in the browser as an HttpOnly,
  SameSite=Strict cookie. PostgreSQL stores only its SHA-256 hash.
- The cookie is scoped to `/auth`, has a 400-day browser max age, and receives
  the `Secure` attribute when `NODE_ENV=production`.
- Logout revokes the matching database session and clears the cookie.

## Configuration

Copy `backend/.env.example` to `backend/.env` for local development. The
important settings are:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Credentials/database used by the local Docker Compose database |
| `DATABASE_URL` | Prisma connection string; local default uses port `5433` |
| `JWT_SECRET` | JWT signing key; application startup requires at least 32 characters |
| `FRONTEND_ORIGINS` | Optional comma-separated exact browser origins for API CORS |

The checked-in environment example is for local development only. Replace
credentials and the JWT secret with managed high-entropy secrets in any
deployed environment. Never commit `.env`.

## Local setup and operation

Follow the root [README](../README.md) for Windows PowerShell startup
commands. The usual developer commands are:

```powershell
# Backend, from backend\
npm run db:up
npm run start:dev

# Frontend, from frontend\ in a second terminal
npm run dev
```

After changing the Prisma schema, update the Prisma client and create/apply a
migration using the backend Prisma scripts. For a new local development
migration, use `npm run prisma:migrate -- --name descriptive_name`; for
deploying already-created migrations, use `npx prisma migrate deploy`.

## Testing and quality checks

Backend unit tests are under `backend/src/**/*.spec.ts`; API/e2e tests are
under `backend/test/**/*.e2e-spec.ts`. Current checks:

```powershell
# backend
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run prisma:validate
npm run build

# frontend
npm run build
```

The frontend production build runs TypeScript checking before Vite packaging.
Tests use Nest's test application and stub the database provider for focused
API behavior tests.

## Current implementation boundaries

- Payment and maintenance billing APIs, tables, and workflows do not exist.
- Dashboard maintenance totals and announcements are sample data.
- Block-specific announcements are not in the current scope.
- Email verification, password recovery, authentication rate limits, audit
  retention policy, and production deployment automation are not implemented.
