# Motive-Corp portfolio site

Marketing hub for Motive-Corp at [www.motive-corp.com](https://www.motive-corp.com).

## Local

```bash
pnpm install
pnpm --filter @forward/motive-corp dev
```

Open http://localhost:3010

## Deploy (Vercel)

**Live (production alias):** https://motive-corp.vercel.app  
**Project:** MotiveLife team → `motive-corp` (Root Directory = `apps/motive-corp` when deploying from this folder via CLI)

```bash
cd apps/motive-corp
npx vercel --prod --yes --scope motive-life
```

No environment variables required (static marketing site).

Domains attached on the project: `www.motive-corp.com`, `motive-corp.com` (DNS must be updated at Network Solutions before they resolve).

## DNS (Network Solutions → Vercel)

Keep the domain registered at Network Solutions (`ns85` / `ns86.worldnic.com`). In **DNS management**, replace any parking/default apex A record, then add:

| Host | Type | Value |
|------|------|--------|
| `@` (apex) | A | `216.150.1.1` |
| `@` (apex) | A | `216.150.16.1` |
| `www` | CNAME | `7edf29011160abef.vercel-dns-016.com` |

Fallback (also accepted by Vercel): apex A → `76.76.21.21`; www CNAME → `cname.vercel-dns.com`.

Canonical: prefer `https://www.motive-corp.com` (redirect apex → www in Vercel Domains once verified).

After saving DNS, wait for propagation, then:

```bash
npx vercel domains verify www.motive-corp.com --scope motive-life
npx vercel domains verify motive-corp.com --scope motive-life
```

## Conversion model

This site routes intent. Trials and subscriptions close on product domains with UTMs (`utm_source=motive-corp`).
