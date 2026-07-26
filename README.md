# DataBrief

> Your data knows something you don't. Find out what.

Upload any data — CSV, Excel, XML, PDF, images, unstructured text — and get a
curiosity-driven narrative story back as PDF, Word, or a branded PowerPoint
deck.

## Stack

Everything runs as a single Next.js app — no separate backend service.

- **App**: Next.js 16 (App Router) + shadcn/ui + Tailwind CSS, NextAuth v5
  (Google, GitHub, and email/password)
- **Database**: Neon Postgres (serverless driver adapter) via Prisma
- **Storage**: Neon Object Storage (S3-compatible) for uploads and exports
- **Background jobs**: Inngest for report generation, with a direct/synchronous
  fallback when Inngest isn't reachable (e.g. local dev without the dev server
  running)
- **Analysis**: a hand-ported TypeScript stats engine (trends, outliers,
  correlation, distribution, data quality, rankings, dose-response)
- **Narration**: Groq, Mistral, and NVIDIA NIM, tried in order via
  LangChain.js/LangGraph.js, falling back to a deterministic template narrator
  if none are configured or all calls fail
- **Charts**: hand-drawn server-side via `@napi-rs/canvas` (no headless
  browser, no client-side charting library for reports)
- **Exports**: React-PDF (PDF), `docx` (Word), `pptxgenjs` (5 PPTX themes)
- **Billing**: Stripe (subscriptions + metered overage)

## Local development

```bash
cd frontend
npm install
cp ../.env.example .env.local   # fill in the values you have
npm run dev
```

- App: http://localhost:3000
- Inngest dev server (optional locally — report generation falls back to
  running inline if it isn't running): from `frontend/`, run
  `npm run inngest:dev` in a second terminal. It listens on
  `http://localhost:8288` and connects to the Next.js `/api/inngest` endpoint.
- Database schema is managed by Prisma — after changing `frontend/prisma/schema.prisma`:
  ```bash
  cd frontend
  npx prisma migrate dev
  npx prisma generate
  ```

### Required external credentials

The app runs and degrades gracefully without most of these — each feature
just needs its corresponding key to fully work:

| Feature | Env vars | Where to get them |
|---|---|---|
| Database | `DATABASE_URL` (pooled), `DIRECT_URL` (unpooled) | [Neon Console](https://console.neon.tech) |
| Object storage | `NEON_STORAGE_ENDPOINT`, `NEON_STORAGE_ACCESS_KEY_ID`, `NEON_STORAGE_SECRET_ACCESS_KEY`, `NEON_STORAGE_BUCKET_NAME` | Neon Console → branch → Credentials |
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — OAuth client, redirect URI `http://localhost:3000/api/auth/callback/google` |
| GitHub sign-in | `GITHUB_ID`, `GITHUB_SECRET` | [GitHub OAuth Apps](https://github.com/settings/developers) — callback URL `http://localhost:3000/api/auth/callback/github` |
| AI-written stories | `GROQ_API_KEY`, `MISTRAL_API_KEY`, `NVIDIA_API_KEY` | Any (or none) of these — without any set, reports still generate using a deterministic fallback narrator |
| Background jobs | `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | [Inngest Dashboard](https://app.inngest.com) — not required locally (`INNGEST_DEV=1` uses the local dev server, or the app falls back to running inline) |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | [Stripe Dashboard](https://dashboard.stripe.com) test mode — create 3 recurring Prices, then `stripe listen --forward-to localhost:3000/api/billing/webhook` for local webhook testing |

## Project layout

```
frontend/   Next.js app — the entire product
  app/                route groups: (marketing), (auth), (app) shell, api/*
  lib/                stats engine, chart rendering, LLM narration, exports,
                      storage, reports/uploads/datasets business logic
  lib/inngest/        background report-generation pipeline
  prisma/             schema + migrations (Neon Postgres)
```

## Pipeline

```
Upload (CSV/Excel/XML/JSON/PDF/DOCX/TXT/image)
  -> lib/fileParsing        format detection + parsing
  -> lib/analysis           stats engine (trends, outliers, correlation, distribution)
  -> lib/insight            ranks findings by surprise/impact/confidence
  -> lib/story              builds the narrative arc
  -> lib/llm                Groq/Mistral/NVIDIA narrates it (or a template fallback)
  -> lib/exports            builds the requested PDF/Word/PPTX files
```

Report generation is triggered via an Inngest event (`GET /api/reports/{id}`
is polled by the frontend until `status` flips to `done` or `failed`); if
Inngest can't be reached, the same pipeline runs directly inline instead.
