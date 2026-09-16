# One Tournament

Hugo + Cloudflare Pages Functions + Cloudflare D1 tournament and pari-mutuel betting board.

## Deployment

```bash
hugo --gc --minify
npx wrangler pages deploy public --project-name one-tournament
```

D1 migrations are tracked by Wrangler. Only run them when adding a new migration:

```bash
npx wrangler d1 migrations apply one-tournament --remote
```

The admin password is a Cloudflare Pages secret named `ADMIN_PASSWORD`. It is not stored in this repository.

## URLs

- `/` public tournament list
- `/tournaments/?id=1` public tournament detail
- `/admin/` admin dashboard

## Betting

The system records wagers manually in gold. Current payout odds are 90% of the pool divided by the selected side's pool. On settlement, 10% of the total pool becomes the tournament cut and 90% is distributed proportionally among winning wagers. Whole-gold rounding uses largest fractional remainder so the full payout pool is distributed.
