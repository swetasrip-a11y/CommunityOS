# CommunityOS product and UI design

## Product

CommunityOS is a shared operations portal for residential communities. It
brings residents, community administrators, security guards, and maintenance
staff into one community-scoped application.

The product goal is to make common community tasks easy to submit, track, and
coordinate without requiring residents to know which staff member to contact.
Data and permissions are scoped to a community; apartment-level information is
shown only where the member has an appropriate relationship to that apartment.

## Users and permissions

| User | Main tasks | Current access |
| --- | --- | --- |
| Resident | Report an issue, track its progress, invite a visitor, book shared amenities | Own requests and passes; bookings and active amenities in their community |
| Administrator | Set up the community, blocks, apartments, and invitations; manage security access and amenities | Community-wide operations and administration |
| Security guard | Process expected visitors | Community-wide visitor log and check-in/check-out actions |
| Maintenance staff | Work through repair requests | Community-wide request list and status progression |

A user can have multiple community roles. An active membership is required
before any community operation is available.

## Main workflows

### Join a community

An account holder creates a community and becomes its first administrator, or
uses an administrator-issued, single-use invitation code linked to an
apartment. An invitation grants resident access, not administrative or
security access.

### Report and resolve a service request

Residents submit a title, category, location, and optional details. The
request begins as `OPEN`. Administrators and maintenance staff move it through
`IN_PROGRESS` to `RESOLVED`. Each transition has a persistent actor,
timestamp, and optional note for the resident-visible history.

### Manage a visitor

A resident with a linked apartment creates an expected visitor pass. An
administrator or security guard sees community arrivals and advances the pass
from `EXPECTED` to `CHECKED_IN` to `CHECKED_OUT`. The system records the
timestamps and staff user for each entry action.

### Book a shared amenity

An administrator creates an amenity and can pause or resume its availability.
Active members view upcoming reservations and book a future, non-overlapping
time range of up to four hours. Members can cancel their own bookings;
administrators can cancel community bookings.

## Information architecture

- **Overview** — community snapshot, issue status, visitor counts, upcoming
  member reservations, quick actions, and presentation-only sample content.
- **My requests** — request list, status history, and staff status controls.
- **Visitor log** — expected guests, apartment and host, visit status, and
  staff check-in/check-out actions.
- **Amenities** — active amenity catalog, administrator setup and availability
  controls, upcoming reservation list, booking, and cancellation.
- **Blocks & homes** — administrator setup of the community structure.
- **Invitations** — administrator creation, status review, and revocation.
- **Security team** — administrator assignment or removal of security access.
- **My payments** and **Announcements** currently contain preview/sample
  dashboard content; their underlying production features are not implemented.

## Visual design

The UI is designed to feel modern, friendly, energetic, and legible rather
than like a traditional property-management form. The current resident
experience uses:

- A dark midnight-purple foundation with high-contrast lime, mint, magenta,
  and violet accents.
- Space Grotesk for prominent headings and DM Sans for general interface text.
- A locally bundled original neighborhood illustration on the sign-in and
  dashboard welcome areas, avoiding a runtime dependency on a remote image
  host.
- Rounded cards, clear status labels, contextual icons, layered gradients,
  and restrained movement to establish hierarchy and feedback.
- Responsive layouts for small screens, keyboard-visible focus indicators,
  and a reduced-motion preference.

The principal presentation code is in `frontend/src/main.tsx` and
`frontend/src/style.css`; the illustration is
`frontend/src/assets/community-illustration.svg`.

## Interaction and content principles

- Show useful context next to an action: request status, visitor host and
  arrival time, or amenity and reservation time.
- Confirm success with an in-app message, update the visible record
  immediately, and expose API errors instead of silently presenting success.
- Disable actions while a write is in flight to reduce duplicate submissions.
- Keep sensitive data out of screens where a user does not need it; for
  example, non-admins do not see other residents' names on the amenity
  schedule.
- Clearly distinguish persistent features from sample content. The current
  dashboard still contains sample announcements and a sample maintenance due
  amount; neither is an implemented community record.

## Out of scope for this version

- Block-specific announcements, as explicitly excluded from the desired
  project scope.
- Maintenance invoice generation, resident billing, payment processing, and
  payment reconciliation. The current payment display is sample data only.
- Mobile-native apps and external payment or messaging integrations.
