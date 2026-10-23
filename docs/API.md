# CommunityOS API reference

This document describes the current API surface. Community endpoints require
an active membership in the route's community unless an endpoint is explicitly
for joining a community. IDs shown as `:communityId` and similar are UUIDs.

## Base URL and conventions

- Local API: `http://localhost:3000`
- JSON request/response bodies.
- Authenticated community requests use
  `Authorization: Bearer <accessToken>`.
- Auth routes use an HttpOnly `communityos_session` cookie for refresh and
  logout. The browser client also sends `X-CommunityOS-Client:
  communityos-web` on auth requests.
- Request bodies are validated with a global Nest validation pipe. Unknown
  fields are rejected; DTO rules enforce enums, UUIDs, date formats, and
  lengths.

## Authentication

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/auth/register` | Create account and authenticated session |
| `POST` | `/auth/login` | Authenticate and issue access token/session cookie |
| `POST` | `/auth/refresh` | Refresh short-lived access token from session cookie |
| `POST` | `/auth/logout` | Revoke current session and clear cookie |
| `GET` | `/auth/me` | Return the authenticated user's basic profile |

Registration expects `fullName`, `email`, and `password`. Passwords must be at
least 12 characters and cannot exceed 72 UTF-8 bytes. Login errors do not
distinguish an unknown email from an incorrect password.

## Community and membership

| Method | Route | Purpose / access |
| --- | --- | --- |
| `GET` | `/communities/mine` | List the caller's active community memberships |
| `POST` | `/communities` | Create community; caller becomes initial administrator |
| `POST` | `/communities/invitations/redeem` | Redeem a one-time invitation after login |
| `GET` | `/communities/:communityId/structure` | Read community structure |
| `POST` | `/communities/:communityId/blocks` | Administrator creates block |
| `POST` | `/communities/:communityId/blocks/:blockId/units` | Administrator creates apartment |
| `GET` | `/communities/:communityId/invitations` | Administrator lists invitations |
| `POST` | `/communities/:communityId/invitations` | Administrator creates apartment invitation |
| `DELETE` | `/communities/:communityId/invitations/:invitationId` | Administrator revokes unused invitation |
| `GET` | `/communities/:communityId/members` | Administrator lists active members and roles |
| `PATCH` | `/communities/:communityId/members/:membershipId/security-role` | Administrator grants/revokes security role |

Community creation accepts `{ "name": "..." }`. Invitation creation accepts
`{ "unitId": "<uuid>" }`; the generated single-use code is returned once.
Redeem with `{ "code": "..." }`. Security-role updates accept
`{ "enabled": true }` or `{ "enabled": false }`.
Apartment numbers in the structure response are restricted to administrators.

## Service requests

| Method | Route | Purpose / access |
| --- | --- | --- |
| `GET` | `/communities/:communityId/requests` | Members see their own; administrators/maintenance staff see all |
| `POST` | `/communities/:communityId/requests` | Active member creates a request |
| `PATCH` | `/communities/:communityId/requests/:requestId/status` | Administrator or maintenance staff advances status |

Create body:

```json
{
  "title": "Water leak",
  "category": "PLUMBING",
  "location": "Apartment 204",
  "description": "Leak under the kitchen sink"
}
```

Categories are `PLUMBING`, `ELECTRICAL`, `CLEANING`, `SECURITY`, and `GENERAL`.
Status body supports `IN_PROGRESS` with an optional note, or `RESOLVED`.
Allowed transitions are `OPEN -> IN_PROGRESS -> RESOLVED`.

## Visitor passes

| Method | Route | Purpose / access |
| --- | --- | --- |
| `GET` | `/communities/:communityId/visitor-passes` | Resident sees own passes; admin/security sees all |
| `GET` | `/communities/:communityId/visitor-passes/units` | List caller-linked apartments |
| `POST` | `/communities/:communityId/visitor-passes` | Create pass for a linked apartment |
| `PATCH` | `/communities/:communityId/visitor-passes/:passId/status` | Admin/security check-in/out |

Create body includes `visitorName`, `unitId`, `purpose`, and future ISO-8601
`expectedAt`. Purposes are `PERSONAL_VISIT`, `DELIVERY`, or `SERVICE`. Status
updates progress `CHECKED_IN` then `CHECKED_OUT`.

## Amenities and bookings

| Method | Route | Purpose / access |
| --- | --- | --- |
| `GET` | `/communities/:communityId/amenities` | Active members list; admins also see paused amenities |
| `POST` | `/communities/:communityId/amenities` | Administrator creates amenity |
| `PATCH` | `/communities/:communityId/amenities/:amenityId/availability` | Administrator pauses/resumes booking availability |
| `GET` | `/communities/:communityId/amenities/bookings` | List upcoming bookings; all confirmed bookings are community-visible |
| `POST` | `/communities/:communityId/amenities/bookings` | Active member reserves an amenity |
| `POST` | `/communities/:communityId/amenities/bookings/:bookingId/cancel` | Owner or administrator cancels booking |

Amenity creation accepts `name` and optional `description` and `location`.
Availability accepts `{ "isActive": true }` or `{ "isActive": false }`.
Booking body:

```json
{
  "amenityId": "<uuid>",
  "startsAt": "2026-10-20T10:00:00.000Z",
  "endsAt": "2026-10-20T11:00:00.000Z"
}
```

Bookings must start in the future, last no longer than four hours, and not
overlap another confirmed booking for the amenity. The list is limited to
upcoming reservations. Members also see their own cancelled upcoming entries;
non-administrators do not receive other residents' names in the schedule.

## Error behavior

The API uses standard Nest HTTP errors: `400` for invalid input or state
transitions, `401` for invalid/missing access tokens, `403` for insufficient
membership/role/ownership, `404` for unavailable or out-of-scope records, and
`409` for concurrent state conflicts or overlapping reservations.

## Not implemented

There are no persisted endpoints for announcements, bills, payment records,
payment processing, or payment reconciliation.
