<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

CommunityOS backend: a NestJS API for managing apartment communities.

## Project setup

```bash
$ npm install
```

## Database setup

The backend uses PostgreSQL and Prisma. For local development, copy the example
environment file, start PostgreSQL with Docker, and generate the Prisma client:

```powershell
Copy-Item .env.example .env
npm run db:up
npm run prisma:generate
npm run prisma:validate
npx prisma migrate dev --name create_community_foundation
```

The credentials in `.env.example` are for local development only. Do not use
them in production. The Prisma schema is in `prisma/schema.prisma`. It defines
users, communities, blocks, units, community memberships, multiple roles per
membership, and unit occupancy links. Prisma migrations are stored in
`prisma/migrations`.

Stop the database container with `npm run db:down`. Its named volume is retained
so local data is preserved.

## Authentication

The API provides `POST /auth/register`, `POST /auth/login`, `POST /auth/refresh`,
`POST /auth/logout`, and protected `GET /auth/me`. Signup creates a row in the
PostgreSQL `User` table. Passwords are stored only as bcrypt hashes; they are
never written to frontend code or returned by the API. Persistent sessions are
stored in the `AuthSession` table as SHA-256 hashes of random session tokens.
The browser receives the session token in an `HttpOnly`, `SameSite=Strict`
cookie, while short-lived access tokens stay in frontend memory. Sessions can
be revoked by signing out and remain available until signed out or browser
cookie data is cleared. The cookie renews on use and has a browser-enforced
maximum of 400 days between uses.

The authenticated `GET /communities/mine` endpoint lists the signed-in user's
active community memberships. `POST /communities` creates a community and
atomically makes its creator the initial administrator. Signup creates an
account first; the first sign-in then prompts the account holder to create a
community. Administrators can retrieve its structure with
`GET /communities/:communityId/structure`, create blocks with
`POST /communities/:communityId/blocks`, and add apartments with
`POST /communities/:communityId/blocks/:blockId/units`. Active members can
retrieve the structure, but apartment numbers are returned only to
administrators. Creating blocks and apartments requires an active
administrator membership, and apartment records are constrained to their
community and block by the database.

Administrators can create a seven-day, single-use invitation for an apartment
with `POST /communities/:communityId/invitations` and `{ "unitId": "..." }`,
list invitation statuses with `GET /communities/:communityId/invitations`, and
revoke an unused code with `DELETE /communities/:communityId/invitations/:invitationId`.
The generated code is returned once and stored only as a SHA-256 hash.
Residents redeem a code after signing in with
`POST /communities/invitations/redeem` and `{ "code": "..." }`. Redemption
atomically creates an active membership, grants only the `RESIDENT` role, and
links the member to the invited apartment as an occupant. Codes cannot be
reused, expired, revoked, or used to join an unrelated apartment.

Active community members can submit a service request with
`POST /communities/:communityId/requests`, providing a title, category,
location, and optional description. Requests start with `OPEN` status.
`GET /communities/:communityId/requests` returns a member's own requests;
administrators and maintenance staff can see all requests in their community.
Requests are scoped to an active membership and are persisted in PostgreSQL.
Administrators and maintenance staff can advance status with
`PATCH /communities/:communityId/requests/:requestId/status`, using
`{ "status": "IN_PROGRESS", "note": "Technician assigned" }` or
`{ "status": "RESOLVED" }`. Only `OPEN → IN_PROGRESS → RESOLVED` transitions
are allowed. Each change and its actor, timestamp, and optional note are stored
in `ServiceRequestStatusUpdate` and included in request responses as
`statusHistory`.

Active members with an apartment linked to their membership can create a
visitor pass with `POST /communities/:communityId/visitor-passes`, providing
`visitorName`, `unitId`, `purpose` (`PERSONAL_VISIT`, `DELIVERY`, or `SERVICE`),
and a future ISO-8601 `expectedAt`. Members can list their own passes and
assigned apartments using `GET /communities/:communityId/visitor-passes` and
`GET /communities/:communityId/visitor-passes/units`. Administrators and
security guards can view all passes in their community and update a pass with
`PATCH /communities/:communityId/visitor-passes/:passId/status` to record
`CHECKED_IN` and then `CHECKED_OUT`; each action records its timestamp and
staff member.
Administrators manage security-guard access for active community members with
`GET /communities/:communityId/members` and
`PATCH /communities/:communityId/members/:membershipId/security-role` using
`{ "enabled": true }` or `{ "enabled": false }`. Role changes affect only the
security-guard role and preserve each member’s other roles.

Administrators can create amenities with
`POST /communities/:communityId/amenities`, providing a `name` and optional
`description` and `location`. They can list all amenities and pause or resume
bookings with
`PATCH /communities/:communityId/amenities/:amenityId/availability` and
`{ "isActive": false }`. Active community members can list available amenities
with `GET /communities/:communityId/amenities`, see the upcoming schedule
with `GET /communities/:communityId/amenities/bookings`, and reserve an active
amenity with `POST /communities/:communityId/amenities/bookings`, providing
`amenityId`, future ISO-8601 `startsAt`, and `endsAt` values. Reservations may
last up to four hours; overlapping reservations are rejected, and concurrent
booking attempts for one amenity are serialized. Members can cancel their own
reservations with
`POST /communities/:communityId/amenities/bookings/:bookingId/cancel`;
administrators can cancel any reservation in their community. The schedule
hides other residents’ names from non-administrators.

Passwords must be at least 12
characters and may not exceed bcrypt's 72-byte UTF-8 limit. Account recovery,
email verification, and request rate limiting are not implemented yet; add
these before opening authentication to public production traffic.

Send the access token as `Authorization: Bearer <token>`. Access tokens expire
after 15 minutes. Set a unique, high-entropy `JWT_SECRET` of at least 32
characters in `.env` before deploying; the example value is only for local
development. Configure `FRONTEND_ORIGINS` as a comma-separated list of exact
frontend origins when deploying the API separately. Protected community
endpoints should use `JwtAuthGuard` and `CommunityRolesGuard` with
`@CommunityRoles(...)`. The role guard reads active membership and roles from
PostgreSQL on each request, rather than trusting role claims embedded in a
token.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
