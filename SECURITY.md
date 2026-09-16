# Security Notes

## Secrets

The administrator password must be configured as the Cloudflare Pages secret `ADMIN_PASSWORD`.
Do not commit `.dev.vars`, `.env`, Wrangler credentials, or any other secret material.

## Local/generated files

The repository intentionally excludes Wrangler state/cache and generated Hugo output. Do not force-add `.wrangler/` or `public/` to Git.

## Administrator access

Admin API endpoints require the `Authorization: Bearer <ADMIN_PASSWORD>` header. The project intentionally uses a shared administrator secret because this application is for a low-stakes tournament.

For a higher-stakes deployment, replace the shared bearer password with a proper expiring session/authentication system and add Cloudflare rate limiting/WAF rules to the admin endpoints.
