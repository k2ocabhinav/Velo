# Velo landing site

The landing app is a static Next.js export. It has no runtime dependency on the Velo API or backend.

## Netlify deploy

1. Create a Netlify site from the repository and set its base directory to `velo-frontend/` so npm can install the monorepo workspaces.
2. Use this build command: `npm run build --workspace=@velo/landing`.
3. Set the publish directory to `apps/landing/out`.
4. Add any needed environment variables below, then deploy. These `NEXT_PUBLIC_*` values are included at build time, so redeploy after changing them.

The same app can be built locally from `velo-frontend/` with `npm run build --workspace=@velo/landing`. Run `npx next dev -p 6100` from `velo-frontend/apps/landing` for local review. The static output is written to `velo-frontend/apps/landing/out`.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `NEXT_PUBLIC_CONTACT_FORM_ACTION` | Optional HTTPS endpoint that accepts a `POST` with `multipart/form-data` and returns a 2xx response on success. | Unset; opens a prefilled mailto draft instead. |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Recipient used by the mailto fallback, footer and policy pages. | `hello@velo.dev` |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin used in metadata, `sitemap.xml` and `robots.txt`. | `https://velo.app` |

Configure the form endpoint with the endpoint URL supplied by your form provider. If no endpoint is set, the form opens the visitor’s email app with the request details addressed to `NEXT_PUBLIC_CONTACT_EMAIL`.

The generated `out/` directory contains the home, privacy and terms pages plus static sitemap and robots files. No server process, API URL, database or backend credentials are needed to serve it.
