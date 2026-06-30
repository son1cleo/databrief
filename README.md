# DataBrief

> Your data knows something you don't. Find out what.

Upload any data — CSV, Excel, XML, PDF, images, unstructured text — and get a
curiosity-driven narrative story back as PDF, Word, or a branded PowerPoint
deck.

## Stack

- **Frontend**: Next.js 16 (App Router) + shadcn/ui + Tailwind CSS, NextAuth v5
- **Backend**: FastAPI, SQLAlchemy + Alembic, Celery + Redis
- **Analysis**: pandas/numpy/scipy stats engine, Claude (Anthropic) for narration
- **Exports**: WeasyPrint (PDF), python-docx (Word), python-pptx (5 PPTX themes)
- **Billing**: Stripe (subscriptions + metered overage)

## Local development

```bash
cp .env.example backend/.env       # fill in the values you have
cp .env.example frontend/.env.local
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API + docs: http://localhost:8000/docs
- Run migrations (first boot, or after a schema change):
  ```bash
  docker compose exec api alembic upgrade head
  ```

### Required external credentials

The app runs and degrades gracefully without these, but each feature needs
its corresponding key to fully work:

| Feature | Env vars | Where to get them |
|---|---|---|
| Google sign-in | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (frontend) | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) — OAuth client, redirect URI `http://localhost:3000/api/auth/callback/google` |
| GitHub sign-in | `GITHUB_ID`, `GITHUB_SECRET` (frontend) | [GitHub OAuth Apps](https://github.com/settings/developers) — callback URL `http://localhost:3000/api/auth/callback/github` |
| AI-written stories | `ANTHROPIC_API_KEY` (backend) | [console.anthropic.com](https://console.anthropic.com) — without it, reports still generate using a deterministic fallback narrator |
| Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_STARTER_PRICE_ID`, `STRIPE_GROWTH_PRICE_ID`, `STRIPE_BUSINESS_PRICE_ID` (backend), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (frontend) | [Stripe Dashboard](https://dashboard.stripe.com) test mode — create 3 recurring Prices, then `stripe listen --forward-to localhost:8000/api/billing/webhook` for local webhook testing |

`NEXTAUTH_SECRET` must be identical in `backend/.env` and `frontend/.env.local`
— it's the shared secret used to mint and verify the API bearer tokens.

## Project layout

```
frontend/   Next.js app (App Router, route groups for marketing/auth/app shell)
backend/    FastAPI app (src/api routes, src/services business logic,
            src/workers Celery tasks, src/models SQLAlchemy, alembic/ migrations)
docker-compose.yml   frontend + api + worker + postgres + redis
```

## Pipeline

```
Upload (CSV/Excel/XML/JSON/PDF/DOCX/TXT/image)
  -> file_service        format detection + parsing
  -> analysis_service     stats engine (trends, outliers, correlation, distribution)
  -> insight_service       ranks findings by surprise/impact/confidence
  -> story_service          builds the narrative arc
  -> llm_service              Claude narrates it (or a template fallback)
  -> pdf/word/pptx_service      builds the requested export files
```

Each report generation request is queued to Celery and polled by the
frontend (`GET /api/reports/{id}`) until `status` flips to `done` or `failed`.
