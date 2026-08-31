# Phase 1.5 isolated route tests

These tests must never use the website database.

## Start the disposable MongoDB

```powershell
docker compose -p dashboard-phase15 -f docker-compose.test.yml up -d --wait
```

The container binds only to `127.0.0.1:27019` and uses no persistent volume.

## Set test-only environment variables

Use `.env.test.example` as a template in the current shell. Do not copy test
values into `.env`. `server.js` does not load `.env` when `NODE_ENV=test`.

Required safety variables:

- `NODE_ENV=test`
- `TEST_DATABASE_URI` with a database beginning `test_` or ending `_test`
- `ALLOW_TEST_DB_RESET=true` before seed/cleanup
- `ALLOW_TEST_DB_HOST_MATCH=true` only when a same-host runtime URI has been
  reviewed and the Mongo instances/databases are demonstrably isolated

Never place a production URI or real credentials in test files or command
history.

## Run only Phase 1.5

```powershell
npm run test:phase15:unit
npm run test:phase15:integration
```

The integration runner starts its own API process on a dedicated port. It does
not reuse an API already listening on port 5000.

## Stop and remove the disposable MongoDB

```powershell
docker compose -p dashboard-phase15 -f docker-compose.test.yml down -v
```

If Docker, the URI guard, or the healthcheck fails, do not substitute
`MONGODB_URI`; report the integration suite as not run.
