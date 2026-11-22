# Tigray Ramino 2.0

Tigray Ramino is a browser and Telegram Mini App card game with local/training
play and Firebase-backed multiplayer.

The 2.0 branch introduces an isolated, server-authoritative Firebase backend.
See [MIGRATION_PLAN.md](MIGRATION_PLAN.md) for architecture, security boundaries,
delivery phases, and approval gates.

## Local tests

```powershell
npm install
npm test
npm run test:telegram
npm run test:rules
```

Run the local Firebase stack with:

```powershell
npm run emulators
```

The Firestore emulator requires Java 11 or newer. The Telegram test command
requires Python 3.

For a local browser to use the emulators, set
`localStorage.ramino_use_emulators = "1"` or append `?emulators=1` to the URL.

The repository is linked only to `tigray-ramino-2-prod`. Do not add the legacy
`ramino-41` project as an alias.
