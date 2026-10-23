# CommunityOS security notes

## Security model

CommunityOS protects two boundaries: the user's identity and the user's
active membership in a specific community. A valid login alone does not grant
access to community records. Feature services look up active membership and
apply role, ownership, and community-scope rules.

## Implemented controls

- Passwords are bcrypt-hashed with 12 rounds; plaintext passwords are not
  stored or returned.
- Password input is restricted to bcrypt's 72-byte UTF-8 limit.
- Access tokens are signed JWTs with a 15-minute lifetime and contain the user
  subject; guards resolve the user from the database.
- Persistent session tokens are generated from 32 random bytes and only their
  SHA-256 hashes are stored in PostgreSQL.
- Session cookies are HttpOnly, SameSite=Strict, and scoped to `/auth`.
  Production mode adds `Secure`.
- The JWT secret is checked at startup and must be at least 32 characters.
- CORS is restricted to configured frontend origins; local development
  defaults to `http://localhost:5173`.
- Global DTO validation rejects unknown body properties and validates UUIDs,
  enums, dates, and lengths.
- Community-scoped foreign keys and service-level authorization help prevent
  cross-community record access.
- Invitation codes are generated with cryptographic randomness, stored as
  hashes, expire, can be revoked, and are redeemed once.
- Request/visitor transitions and amenity reservation writes use conditional
  updates/transactions to prevent stale state writes.
- Resident-facing amenity schedules do not disclose other members' names.

## Security boundaries and caveats

- The `X-CommunityOS-Client` auth header is a browser-client gate, not a
  cryptographic client identity. Non-browser clients can forge ordinary
  headers; authentication still depends on the session and access tokens.
- CORS is a browser policy, not an API authorization mechanism. Every API
  request must continue to perform server-side authentication and membership
  checks.
- The access token is held in frontend memory, but protection against
  cross-site scripting still depends on safe rendering, dependency hygiene,
  and deployment security headers.
- No rate limiting or account lockout is implemented; public deployment needs
  abuse controls for login, registration, invitation redemption, and other
  write endpoints.
- Password recovery, email verification, MFA, and account lifecycle workflows
  are not implemented.
- The persistent session has a 400-day browser max age and no explicit server
  expiry/rotation policy in the current schema. Define a revocation, expiry,
  and rotation policy before production use.
- HTTPS, secure secret injection, database backups, restore testing, audit-log
  retention, monitoring, and incident response are deployment
  responsibilities and are not supplied by the local project setup.
- A user's phone field is optional and unique, but phone verification is not
  implemented.

## Before production

1. Set a unique high-entropy `JWT_SECRET` through a secret manager; replace all
   development credentials.
2. Serve the frontend and API over HTTPS, use secure cookies, and configure
   exact production origins.
3. Add and test rate limiting, monitoring/alerting, account recovery, and
   email verification.
4. Specify session expiration, revocation, and rotation behavior.
5. Establish PostgreSQL backups, restore drills, migration review, and a
   retention policy for visitor and access records.
6. Review dependencies, security headers, logging redaction, and privacy
   requirements before inviting real communities.

This is an implementation summary, not a penetration-test report or a
production security certification.
