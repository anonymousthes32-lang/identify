# Bitespeed Backend Task: Identity Reconciliation

This implementation uses **Node.js** for the backend service and **SQLite** (SQL database) for persistence, matching the task's requested stack constraints.

## Why this approach

- **Node.js HTTP server**: keeps runtime simple and deployable without framework lock-in.
- **SQLite**: satisfies the "any SQL database" requirement with zero external infrastructure.
- **Deterministic reconciliation flow**:
  1. Find all contacts matching incoming `email` or `phoneNumber`.
  2. If none exist, create one `primary` contact.
  3. If multiple contact trees are discovered, keep the oldest `primary` and demote newer primaries to `secondary`.
  4. If incoming payload introduces new email/phone in that consolidated tree, create a `secondary` contact.
  5. Return a single canonical response.

## Project files

- `app.js` — exposes `POST /identify`
- `identity.js` — reconciliation algorithm
- `db.js` — SQLite initialization and query helpers
- `test_identity.js` — test coverage for key flows

## Run locally

```bash
node app.js
```

Server starts at `http://localhost:3000`.

## API contract

### POST `/identify`

Request JSON:

```json
{
  "email": "lorraine@hillvalley.edu",
  "phoneNumber": "123456"
}
```

Response JSON:

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["lorraine@hillvalley.edu", "mcfly@hillvalley.edu"],
    "phoneNumbers": ["123456"],
    "secondaryContactIds": [2]
  }
}
```

## Test

```bash
node --test test_identity.js
```

## Deploy

Deploy to Render/Railway/Fly with start command:

```bash
node app.js
```

Hosted endpoint URL: _add your deployed URL here_.
