# Changelog
All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Added
- Simple Node.js + Express + EJS layout with MySQL storage files.
- Theme assets wired into `app/public` and homepage aligned to the StrikeX mission.
- Legacy EJS views and assets brought forward from `old_strikex`.
- Legacy routes, middleware, and cart sidebar wiring restored for working cart views.
- Stripe Payment Intents flow with Elements UI and webhook handler.
- Checkout guards for empty carts before rendering or creating payments.

### Changed
- Scoped the project to a single Express app using EJS views and the legacy DB schema.
- Removed Braintree references and prepared Stripe env keys and schema field.
