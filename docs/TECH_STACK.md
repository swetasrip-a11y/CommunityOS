# CommunityOS technology selection

## Decision summary

CommunityOS uses a TypeScript-centered stack: React and Vite in the browser,
NestJS on Node.js for the API, PostgreSQL for persistence, and Prisma for
typed database access and migrations.

## Why this stack fits the project

### TypeScript across frontend and backend

The UI and API share the same language and type system. This makes it easier
to work with API payloads, domain states, and validation without introducing
separate frontend and backend programming models. TypeScript catches many
integration mistakes during the production build, while leaving runtime
validation to the API.

### React 19 for the resident portal

The product needs interactive, role-aware screens: request histories, visitor
state controls, amenity schedules, forms, and community switching. React's
component and state model suits those views and lets the application evolve
one feature at a time. The UI is a browser SPA; a separate native mobile app
is not required for the current scope.

### Vite 8 for frontend development and packaging

Vite provides a fast local development server and production bundle. Its
development proxy forwards the frontend's `/auth` and `/communities` routes to
the API on port `3000`, so local browser requests can use one frontend origin.

### NestJS 10 for backend organization

NestJS provides modules, dependency injection, controllers, guards, and a
structured testing setup. Those conventions map naturally to distinct
CommunityOS domains such as authentication, communities, requests, visitors,
and amenities. A modular monolith keeps deployment simple while retaining
clear feature boundaries.

### PostgreSQL 16 for transactional community data

The domain contains strongly related entities: communities, memberships,
roles, apartments, invitations, requests, visitors, amenities, and bookings.
PostgreSQL supplies relational constraints, foreign keys, indexes, and
transactions needed to preserve those relationships. It is especially useful
for enforcing that a booking's member and amenity belong to the same
community.

### Prisma 6 for typed persistence

Prisma's schema is the source for generated TypeScript database types and
versioned SQL migrations. It reduces handwritten query plumbing while
allowing transactions and parameterized SQL where a domain operation needs
specific PostgreSQL behavior, such as serializing amenity reservations.

### Docker Compose for local database setup

Docker Compose provides a repeatable PostgreSQL instance without requiring a
separately installed local database server. The named volume keeps development
data when the container is stopped.

### JWT and database-backed sessions

Short-lived JWTs provide a standard bearer-token mechanism for protected API
requests. A separate random refresh-session token in an HttpOnly cookie
supports persistent sign-in; only the token hash is stored in PostgreSQL.
This separates short access-token lifetime from longer-lived browser
authentication state.

## Why not microservices yet?

The current product is built incrementally by a small development effort and
has a modest number of closely related domains. Splitting it into services
would add deployment, networking, observability, and data-consistency work
without a demonstrated scaling or ownership need. The module boundaries leave
room to extract a service later if traffic, team structure, or independent
scaling justifies it.

## Trade-offs and alternatives

| Choice | Benefit | Trade-off |
| --- | --- | --- |
| React SPA | Interactive experience and component reuse | SEO is not a major strength; client must call an API |
| NestJS modular monolith | Consistent boundaries and straightforward deployment | One API deployment scales as a whole |
| PostgreSQL | Strong relational integrity and transactions | Requires database operation, migrations, backup planning |
| Prisma | Generated types and maintainable schema migrations | Generated client and ORM abstractions require discipline for unusual queries |
| JWT access token + cookie session | Short-lived API tokens with persistent sign-in | Cookie/CORS/CSRF settings and token lifecycle need careful production configuration |

## When to revisit these decisions

Re-evaluate the choices if the application needs native offline/mobile
experience, server-rendered public pages, very high independent domain scaling,
large analytical workloads, or an external payment provider. Such changes
should follow measured needs and a threat/operations review rather than being
added pre-emptively.
