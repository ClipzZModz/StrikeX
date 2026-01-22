# StrikeX Storefront

Family-run fishing lure manufacturing brand focused on quality, affordability, and big-fish performance. We start local, build strong customer trust, and scale into a full online-first tackle brand.

## Mission Snapshot
- Build high-quality, affordable lures with strong quality control.
- Serve local anglers first, then expand nationally and internationally.
- Grow through a content-led social presence, SEO, and community engagement.

## Business Phases
- PH1: Injection-based molding and prototype lures.
- PH1/2: Resale of wholesale tackle (hooks and accessories).
- PH2: Website completed to take orders and advertise products.
- PH3: Business cards and marketing strategy with rewards/gifting.
- PH4: Affiliate system with local retailers and market sellers.
- PH5: Expanded gear (rods, reels, nets, waders).

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
- Business plan source: `docs/business-plan.pdf`.
- Environment variables are documented in `.env.example`.
