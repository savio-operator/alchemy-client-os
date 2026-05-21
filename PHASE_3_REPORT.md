# Phase 3 Report — Real Integrations

## What was built

### Discovery Engine (`src/lib/discovery-engine.ts`)
- **node-cron polling**: Auto-polls RSS sources every 10 minutes
- **RSS fetching**: Uses `rss-parser` to pull from Marketing Brew, Adweek, Know Your Meme, and all configured sources
- **Relevance scoring**: Batches of 20 items scored against client briefs via Anthropic SDK (0–10 scale)
- **Database backups**: Daily at 2am via `sqlite.backup()`
- **API routes**: `/api/discovery/start`, `/api/discovery/poll`, `/api/discovery/score`

### Integration Infrastructure
- **Encrypted token storage** (`src/lib/integration-store.ts`): AES-256-GCM encryption using `DB_KEY` env var, stored in SQLite `settings` table
- **CRUD operations**: `saveIntegrationTokens()`, `getIntegrationTokens()`, `deleteIntegrationTokens()`, `isIntegrationConnected()`, `listIntegrations()`
- **Settings UI**: Integration cards with Connect/Disconnect buttons, status indicators
- **API routes**: `GET /api/integrations` (list), `DELETE /api/integrations` (disconnect)

### Meta Graph API (`src/lib/integrations/meta.ts`)
- **OAuth flow**: `getMetaOAuthUrl()`, `exchangeMetaCode()` (short-lived → long-lived token exchange)
- **Publishing**: `publishToFacebook()`, `createInstagramContainer()` + `publishInstagramContainer()`
- **Reading**: `getPages()`, `getInstagramAccount()`, `getPageInsights()`
- **Routes**: `/api/integrations/meta/auth`, `/callback`, `/publish`

### X API v2 (`src/lib/integrations/x.ts`)
- **OAuth 2.0 + PKCE**: `getXOAuthUrl()` with code challenge, `exchangeXCode()` with verifier
- **Token refresh**: `refreshXToken()` for `offline.access` scope
- **Actions**: `postTweet()`, `getMentions()`, `getMe()`
- **In-memory PKCE store**: Auto-cleanup after 10 minutes
- **Routes**: `/api/integrations/x/auth`, `/callback`, `/tweet`

### Google Analytics 4 + Search Console (`src/lib/integrations/google.ts`)
- **OAuth 2.0**: `getGoogleOAuthUrl()`, `exchangeGoogleCode()` with `offline` access for refresh tokens
- **Auto-refresh**: Token refresh handler via googleapis `on('tokens')` event
- **GA4 Data API**: `listGA4Properties()`, `getGA4Report()` (sessions, users, pageviews, conversions, bounce rate, avg session duration by date), `getGA4TopPages()`, `getGA4TrafficSources()`
- **Search Console API**: `listSearchConsoleSites()`, `getSearchConsoleData()` (top queries with clicks, impressions, CTR, position), `getSearchConsolePages()`
- **Routes**: `/api/integrations/google/auth`, `/callback`, `/analytics`, `/search-console`

### Razorpay (`src/lib/integrations/razorpay.ts`)
- **Key-based auth**: Uses `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` (no OAuth needed)
- **Payments**: `listPayments()`, `getPayment()`, `getRevenueSummary()` (aggregates captured payments in INR)
- **Subscriptions**: `listSubscriptions()`, `getSubscription()`
- **Invoices**: `listInvoices()`
- **Routes**: `/api/integrations/razorpay/payments`, `/subscriptions`

## Environment variables required

```
# Meta (Facebook + Instagram)
META_APP_ID=         # From developers.facebook.com
META_APP_SECRET=

# X (Twitter)
X_CLIENT_ID=         # From developer.x.com/portal
X_CLIENT_SECRET=

# Google (Analytics + Search Console)
GOOGLE_CLIENT_ID=    # From console.cloud.google.com
GOOGLE_CLIENT_SECRET=

# Razorpay
RAZORPAY_KEY_ID=     # From dashboard.razorpay.com
RAZORPAY_KEY_SECRET=

# Encryption + App URL
DB_KEY=              # Any random string for AES-256-GCM
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## What was skipped

- **LinkedIn Marketing API**: Requires a LinkedIn Marketing Developer Platform app with special review/approval. The infrastructure is ready (listed in `listIntegrations()`), but the OAuth flow and API calls are not implemented. Can be added when LinkedIn app access is granted.
- **Webhook receivers**: Razorpay webhooks for real-time payment notifications. Current implementation uses polling/on-demand reads.
- **GA4 realtime reports**: Only historical data is fetched. Realtime API could be added later.

## Quality gates

- `pnpm typecheck` — passes clean
- `pnpm build` — passes clean, all routes render correctly

## API route summary

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/integrations` | GET | List all integrations + connection status |
| `/api/integrations` | DELETE | Disconnect an integration |
| `/api/integrations/meta/auth` | GET | Start Meta OAuth flow |
| `/api/integrations/meta/callback` | GET | Meta OAuth callback |
| `/api/integrations/meta/publish` | POST | Publish to Facebook/Instagram |
| `/api/integrations/x/auth` | GET | Start X OAuth flow |
| `/api/integrations/x/callback` | GET | X OAuth callback |
| `/api/integrations/x/tweet` | POST | Post a tweet |
| `/api/integrations/google/auth` | GET | Start Google OAuth flow |
| `/api/integrations/google/callback` | GET | Google OAuth callback |
| `/api/integrations/google/analytics` | GET | GA4 data (properties, reports, top pages, traffic sources) |
| `/api/integrations/google/search-console` | GET | Search Console data (sites, queries, pages) |
| `/api/integrations/razorpay/payments` | GET | Payments list, detail, or revenue summary |
| `/api/integrations/razorpay/subscriptions` | GET | Subscriptions list, detail, or invoices |
| `/api/discovery/start` | POST | Start discovery engine cron |
| `/api/discovery/poll` | POST | Manual RSS poll |
| `/api/discovery/score` | POST | Manual relevance scoring |

## Commands

```bash
pnpm dev          # Start development server
pnpm build        # Production build
pnpm typecheck    # TypeScript check
pnpm lint         # ESLint
pnpm format       # Prettier
```
