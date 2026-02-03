# Changelog
All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]
### Changed
- Added hover cursor to the header cart button.
- Changed theme over to new fresh theme
- Rebuilt `index-02.ejs` with a StrikeX-focused layout and updated copy.
- Removed the legacy home-3 layout and route.
- Wired the `index-02.ejs` "Top Picks for Local Waters" list to live products.
- Updated the product detail page to use dynamic product data and fixed asset paths.
- Extracted the index-02 navigation into a shared partial and applied it across storefront pages.
- Aligned product page header logo styling with the shared storefront header.
- Added active nav highlighting in the shared storefront header.
- Moved shared header logo styling into the global stylesheet.
- Made `index-02.ejs` the main homepage and redirected `/home2` to `/`.
- Wired the header cart dropdown to live cart summary data.
- Made the cart page render live cart items and support percent-off coupons.
- Moved coupons to the database with optional scheduling and usage limits.
- Added `/order/:orderId` confirmation route and redirected `/account/order/:orderId` to it.
- Rebuilt the order confirmation view to render live order, address, and totals.
- Updated order confirmation assets to use absolute paths and live links.
- Rebuilt login and register pages with the new theme layout and wired forms to auth routes.
- Added reCAPTCHA widgets and updated auth page assets to use absolute paths.
- Styled email inputs and adjusted auth page CTA button spacing.
- Fixed checkout payment section markup, added VAT line, and appended currency codes to cart/checkout totals.
- Switched header currency selector default to GBP.
- Enabled guest checkout with auto account creation and saved delivery addresses.
- Added checkout guard to require login if the email already has an account, with redirect back to checkout.
- Fixed header cart dropdown checkout link to use the active cart.
- Enabled cart dropdown item removal and improved long title wrapping.
- Added sidebar empty-state spacing and live cart count/sidebar updates after add-to-cart.
- Rebuilt customer account page with orders list and address management.
- Normalized account page layout using a flex sidebar/content split and aligned table typography to theme fonts.

## [1.0.1-pre] - 2026-01-22
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
