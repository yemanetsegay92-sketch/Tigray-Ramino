# Tigray Ramino 2.0 Firebase Migration Plan

## Decision and boundaries

Tigray Ramino 2.0 uses a new, independent production Firebase project:

- Project ID: `tigray-ramino-2-prod`
- Display name: `Tigray Ramino 2 Production`
- Web app ID: `1:1042823690441:web:e6c70ca97fdc79d813f518`
- Billing: not enabled
- Firestore database: `(default)`
- Firestore region: `africa-south1`
- Firestore edition: Standard (free tier)
- Firestore deletion protection: enabled
- Cloud Functions region: `africa-south1`

The temporary empty `nam5` database has been deleted by the owner. The permanent
empty `(default)` database was recreated successfully in `africa-south1` on
November 18, 2026. The regional migration is complete; no application data or
deployed rules required migration.

The legacy `ramino-41` project is out of scope. It must not be inspected,
recovered, linked, migrated, or modified. No Tigray Ramino 2.0 configuration
references it.

Production Vercel deployment, Firebase Functions deployment, billing changes,
and pull-request merge require explicit owner approval.

## Architecture

The browser signs in with durable Firebase Anonymous Authentication. The UID is
the security identity; Telegram profile fields are treated only as untrusted,
bounded display data until a future server-side Telegram validation flow is
introduced.

```text
Browser / Telegram Mini App
  ├─ anonymous Firebase Auth (durable UID)
  ├─ callable commands only (create, join, leave, start, action)
  └─ read-only Firestore listeners
        ├─ room and public table state
        └─ current player's private hand only

Callable Functions
  ├─ membership, host, capacity, status, turn and revision checks
  ├─ idempotent action IDs
  ├─ existing Ramino engine executes each action
  └─ atomic publication of public state and all private hands

Firestore
  ├─ rooms/{code}                         member-scoped lobby metadata
  ├─ rooms/{code}/members/{uid}           member records
  ├─ rooms/{code}/game/public             safe synchronized table view
  ├─ rooms/{code}/privateHands/{uid}      owner-only cards
  └─ rooms/{code}/server/game             server-only canonical state
```

Clients cannot write multiplayer documents directly. Deck order and other
players' cards exist only in the server-only canonical document. Public state
and private hands carry the same monotonic revision so the client applies only
matching snapshots after reconnecting.

## Delivery phases

### Phase 1 — foundation (implemented on the feature branch)

- Create the isolated Firebase project and web app without billing.
- Replace the legacy client configuration with the new project.
- Add persistent anonymous authentication.
- Add default-deny, member-scoped Firestore Security Rules.
- Add emulator tests for unauthorized reads, cross-player hand access,
  canonical-state access, and all direct client writes.
- Add callable room creation, joining, leaving, reconnection, and start flows.
- Add server-authoritative game actions with optimistic-concurrency revisions
  and recent action IDs for retry safety.
- Reuse the existing Ramino engine on the server and preserve local/training
  mode and its rule tests.
- Preserve the Telegram webhook and initialize/expand the Telegram Mini App.
- Improve safe-area, scrolling, touch targets, and small-screen lobby layout.

### Phase 2 — production readiness (before broad release)

- Permanent Firestore location resolved: `(default)` is provisioned in
  `africa-south1` with Standard edition and deletion protection enabled.
- Enable Anonymous Authentication in the new project.
- Deploy only Auth configuration and reviewed Firestore rules/indexes.
- Run full Auth, Firestore, and Functions emulator end-to-end tests.
- Add App Check after the production domain is approved.
- Add structured logging, alerting, room expiry/cleanup, and abuse quotas.
- Complete multiplayer device testing in browsers and Telegram on Android/iOS.
- Obtain approval for a billing plan before any Functions deployment; callable
  Functions cannot be treated as live until that approval and deployment occur.

## Activation and deployment gates

### Anonymous Authentication

The browser implementation and `firebase.json` provider configuration are
ready. Anonymous Authentication is not active until the owner approves one of
these configuration changes:

1. Deploy only the prepared Authentication configuration with
   `firebase deploy --only auth`, or enable Anonymous in Firebase Console.
2. Confirm the production and preview domains are listed under Authentication
   authorized domains.
3. Verify a fresh browser and Telegram Mini App session both receive a durable
   anonymous UID, and that refresh/reopen preserves it.

Anonymous Authentication itself does not require Blaze billing. This activation
must happen before real clients can call the authenticated multiplayer backend.

### Cloud Functions

All callable functions explicitly target `africa-south1`, matching Firestore.
Deploying second-generation Cloud Functions requires the project to use the
Blaze plan and may enable required Google Cloud APIs and create billable
resources. No Functions deployment may occur until the owner explicitly
approves billing and deployment. After approval, deploy only the `ramino2`
Functions codebase, verify every function reports `africa-south1`, and perform
the two-device smoke test before wider access.

### Production test readiness

The automated emulator flow covers two independent anonymous users, room
creation, joining, reconnection, game start, private-hand isolation, synchronized
revisions, and a server-validated first action. Real-device testing still
requires Anonymous Authentication, reviewed Firestore rules/indexes, and the
callable Functions to be deployed. App Check, abuse controls, monitoring, and
room cleanup remain pre-broad-release hardening work.

### Phase 3 — expandable competition platform

- `players_public/{uid}` for display-only profile fields.
- `players_private/{uid}` for owner-only settings and linked identities.
- Server-written match history and auditable results.
- Derived, server-written leaderboards.
- Tournament definitions, registrations, brackets, and organizer roles using
  custom claims or another server-controlled authorization source.
- Optional account linking so anonymous players can keep progress across
  devices without weakening guest play.

## Verification gates

Every release candidate must pass:

1. Existing Ramino rule and Telegram webhook tests.
2. Server-engine authority/privacy tests.
3. Firestore Rules emulator tests and rules syntax validation.
4. Functions emulator tests for duplicate actions, stale revisions, room
   capacity, reconnection, and out-of-turn/forged actions.
5. Manual two-to-four-device game flow, refresh/reconnect, and mobile Telegram
   Mini App checks.

No production deployment or merge is part of this migration branch without
explicit approval.
