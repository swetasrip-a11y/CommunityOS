# CommunityOS documentation

This folder documents the product, user experience, system architecture,
implementation details, API, and security posture of the current CommunityOS
codebase.

## Documents

- [Product and UI design](./DESIGN.md) — product goals, roles, workflows, and
  current visual design.
- [System architecture](./ARCHITECTURE.md) — component boundaries, runtime
  topology, request flow, and data relationships.
- [Technical reference](./TECHNICAL.md) — stack rationale, modules, schema,
  conventions, local setup, and verification.
- [API reference](./API.md) — current authentication and community endpoints.
- [Security notes](./SECURITY.md) — current controls, responsibilities, and
  production-readiness gaps.

## Status at a glance

Persisted features include authentication, community and apartment setup,
resident invitations, service requests and status history, visitor passes and
security check-in/out, security-role administration, amenity setup, and
amenity bookings.

Maintenance billing and payment records are not implemented. The dashboard's
payment figures and announcements are sample presentation data; they are not
backed by billing or announcement APIs. Block-specific announcements are not
part of the current project scope.
