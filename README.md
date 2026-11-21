# Pokmira NFC contact cards

Cloudflare Pages Functions, D1 and a small static card interface. The ZIP is an overlay for the existing site repository. It includes no account credentials or generated card secrets.

## 1. Scan the locked tags first

Read the NDEF URL on a few tags, then inventory the batch. For unique URLs already encoded as `https://your-domain/k/<12-character-token>`, keep the exact hostname, case and token. Run the generator in import mode with one exact URL per line. Ensure you control the encoded domain. Imported URLs must already have been assigned securely; random-looking syntax alone cannot prove entropy.

If every locked tag contains the same URL, all those tags open the same destination. Independently editable cards require unique tag URLs. Use a writable replacement tag, a dedicated printed QR per card, or a unique URL already written to each tag. If the locked tags use a different unique path on a domain you control, add exact redirects from the old paths to the provisioned card URLs before distribution. An encoded URL on a domain you do not control requires cooperation from that domain's operator.

**Write only the public NFC URL to the chip.** Put the claim code and separate backup code on a private printed insert. A tap alone must not grant ownership. Provision and check a tag before locking it. If the locked tags are already distributed without an insert, give the matching claim and backup codes privately to their known holders.

## 2. Merge into the GitHub site repo

1. Create an integration branch. Put `functions/`, `lib/`, `scripts/`, `schema.sql` and the Wrangler settings at the existing Pages project root. Keep the current Pages project name, compatibility settings and other bindings. Copy or merge the provided package scripts, tests and ignore patterns if you want to run the test suite in that repo.
2. Copy `public/nfc/` to the site's **actual Pages build output**. For a static site, `public/` can be the build output and contain the existing homepage and all its assets. For a framework that builds to `dist/`, place `nfc/` in the framework's copied static assets directory and set `pages_build_output_dir = "./dist"`. Keep existing content and the established output directory. The card uses absolute paths and is intended for the site root.
3. Place `_routes.json` in the deployed output root. If one exists, merge the `/k`, `/k/*`, `/api`, and `/api/*` patterns without dropping the existing Functions routes. If the site already has a catch-all API, integrate the card route into that handler or move the catch-all alongside a more specific card route. Keep unrelated static paths out of Functions to conserve the request allowance.
4. Preserve the existing website and routes. Use the existing GitHub-connected Pages project and mapped custom domain. The supplied `wrangler.toml` is a template, so match its project name and output directory to the live project.

## 3. Set up Cloudflare and local development

Use Node.js 24 or newer for the local test suite. From the project directory:

```sh
npm test
npx wrangler login
npx wrangler d1 create pokmira-cards
```

Copy the database UUID into `wrangler.toml` and keep the binding named `DB`. Create a second D1 database for the Pages preview environment and use its own binding and session secret there. Confirm in **Workers & Pages → your Pages project → Settings** that the production and preview bindings use the intended databases. Treat the repo's Wrangler file as the source of truth once Pages configuration is managed through it.

```sh
npx wrangler d1 execute pokmira-cards --remote --file=schema.sql
npx wrangler d1 execute pokmira-cards --local --file=schema.sql
npx wrangler pages dev
```

Generate a session secret with `openssl rand -hex 32`. Put it in local `.dev.vars` as `SESSION_SECRET` for development. Set a separately generated secret under the Pages project's encrypted runtime variables, or use `npx wrangler pages secret put SESSION_SECRET --project-name YOUR_PAGES_PROJECT`. Redeploy after production binding or secret changes. Keep production secrets, database exports and private batch files out of Git. Merge the ignore patterns into the existing repo.

## 4. Provision cards

For new writable tags:

```sh
node scripts/generate-batch.mjs --origin https://YOUR_DOMAIN --count 500 --out launch
```

For already written compatible tags:

```sh
node scripts/generate-batch.mjs --origin https://YOUR_DOMAIN --existing-urls path/to/urls.txt --out locked-launch
```

In a private location, keep `private-batches/<batch>/print-private.csv` for printing inserts. It contains the public URL plus both private codes. If a programming vendor needs an import, export **only the nfc_url column**. Apply `seed.sql` to the intended database before giving out a tag, substituting the selected batch name:

```sh
npx wrangler d1 execute pokmira-cards --remote --file=private-batches/launch/seed.sql
```

For local testing provision a throwaway batch using an HTTPS example origin and apply its seed with `--local`. Open its token on the Wrangler development origin. Use HTTPS for realistic testing of the secure cookie. Run an end-to-end test on the actual HTTPS preview or custom domain before distributing tags. Seed D1 production with production tokens only. Keep the preview database isolated.

## 5. Protect and publish

- Keep the account on Workers Free and D1 Free. Check the account's existing usage. Current free limits and requests/rows are shared with other workloads according to Cloudflare's plan rules. API reads increment the active card view counter once per successful active read, including refreshes and QR visits. This is a view count, not proof of a physical NFC tap. When the write quota is exhausted, counting is best effort; owner writes and authentication require available D1 quota. Enable fail-closed behavior for Pages Functions if available in your project settings.
- At the Cloudflare-proxied custom domain, use a rate limiting rule matching card authentication POST paths by client IP with a target of 10 requests per minute, or the closest available free-plan interval/threshold. Include `/verify`, `/activate` and `/recover` when the rule allows it. The application independently locks each card for 15 minutes on five failed attempts. Card lockout can temporarily affect the real owner. Public cards are shareable by anyone holding the URL. Random tokens and noindex reduce discovery; neither makes public fields confidential.
- Push the preview branch. Verify claim, iOS Safari and Android Chrome contact import with Arabic text, Owner Edit, PIN lockout, recovery rotation, pause/resume, and an edited phone appearing on a fresh tap. Test the actual hardware and camera QR decoder. The QR generator supports URLs up to 134 UTF-8 bytes.
- Merge to the production branch after the preview passes. Confirm the domain serves the Functions routes with `Cache-Control: no-store` and `X-Robots-Tag: noindex, nofollow`. Turn off any custom Cache Everything rule for these paths. Do not block search crawlers from fetching the noindex directive via a blanket robots.txt disallow.
- Owner recovery uses the printed backup code once. Recovery rotates the code and invalidates old sessions. Recovery email is optional private metadata for assisted support. No email is sent and there is no email-only reset. If the owner loses both PIN and backup code, any assisted reset needs a separate proof-of-ownership process.

## 6. Change the launch CTA

Edit a single runtime value, `BRAND_CONFIG`, and deploy it to Pages. Before launch, set `links` to the existing waitlist, order or product landing URL. The default links to the current homepage. Supply `label_ar` for Arabic visitors.

```json
{
  "mode": "live",
  "links": [
    {"label":"Google Play","label_ar":"جوجل بلاي","url":"https://play.google.com/store/apps/details?id=YOUR_PACKAGE"},
    {"label":"App Store","label_ar":"آب ستور","url":"https://apps.apple.com/app/idYOUR_APP_ID"}
  ],
  "perk": "Founders perk instructions for verified card owners."
}
```

The optional perk text appears in the authenticated owner editor, keeping the instructions out of the public card API. It can explain how to claim a perk. Automatic in-app entitlement redemption requires a separate app-side integration. Contact save stays a native vCard download and does not auto-redirect, so the OS can complete the contact import.

References: [Pages configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/), [Git integration](https://developers.cloudflare.com/pages/get-started/git-integration/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/).

## Pokmira website snapshot integration

This project includes the production site snapshot with the SVG fix. Its existing
site files are preserved byte for byte beneath `public/`. Use `public` as the
Pages build output for this layout. The card API is scoped to `/api/card/*`.
The snapshot contained no existing `_routes.json` or Wrangler config. If the live
repo is newer, merge these files into that checkout and retain its existing
routes, exclusions, bindings and build settings.

The site's canonical homepage is `https://pokmira.online/`, which is the
configured pre-launch destination. A separate waitlist URL and the exact Pages
project name were unavailable. Pages custom domains are attached under the
existing project's **Custom domains** tab, outside Wrangler configuration.
Keep the current domain association and DNS.

### Commands for the existing Git-connected Pages project

Run from the repository root after confirming the production branch and output
directory in Pages. In the examples below, enter the exact existing Pages
project name and the new D1 UUID in `wrangler.toml` before setting the secret.

```sh
npx wrangler login
npx wrangler d1 create pokmira-cards
# Paste the returned UUID in wrangler.toml, and set name to the existing Pages project.
npx wrangler d1 execute pokmira-cards --remote --file=schema.sql
read -r -p "Existing Cloudflare Pages project name: " PAGES_PROJECT
openssl rand -hex 32 | npx wrangler pages secret put SESSION_SECRET --project-name "$PAGES_PROJECT"
npm test
git push -u origin HEAD
```

Push from an integration branch and check the Git-triggered preview before
merging into the production branch. Use a separate preview D1 binding and
preview secret for test data. For an intentional direct preview deployment of
this static layout to the existing project, run:

```sh
npx wrangler pages deploy public --project-name "$PAGES_PROJECT" --branch nfc-integration
```
