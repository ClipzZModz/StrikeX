# StrikeX Storefront

StrikeX storefront built with Node.js, Express, and EJS, backed by a MySQL schema in `app/storage/initialization.sql`.

## Stack
- Node.js + Express
- EJS views
- MySQL (schema in `app/storage/initialization.sql`)

## Repo Layout
- `app/app.js`: Express app entry.
- `app/bin/www`: HTTP server bootstrap.
- `app/routes`: View + API routes.
- `app/views`: EJS templates.
- `app/public`: Static assets.
- `app/storage`: DB helper + initialization SQL.

## Notes
- Environment variables are documented in `.env.example`.
