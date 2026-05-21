# Phase 1 Report — Adchemy Client OS

## What was built

### Design System
- Custom color tokens (light + dark) mapped to shadcn/ui CSS variables in `globals.css`
- Typography: Source Serif 4 (headings), Inter (body), JetBrains Mono (code)
- Base size 15px, line height 1.55, max measure 68ch
- Custom radii (6/10/14px), single shadow tier, panel-in animation (220ms)
- Focus ring: 2px solid accent-clay with 2px offset on all interactive elements

### Database
- SQLite via better-sqlite3 + Drizzle ORM at `./data/adchemy.db`
- Tables: `clients`, `client_profile`, `client_brief`, `sessions`, `settings`
- WAL mode enabled, foreign keys enforced
- Auto-creates tables on first import

### Auth (PIN-based, single user)
- First launch: set a 6-digit PIN, hashed with argon2
- Login: enter PIN, verified against hash
- Session: HttpOnly cookie, 30-day rolling expiry
- Middleware redirects unauthenticated requests to `/login`
- API routes: `/api/auth/setup`, `/api/auth/login`, `/api/auth/status`

### App Shell
- **Left sidebar**: 64px collapsed / 240px expanded, animated with Framer Motion
  - Client list, "+ New client" button, settings link
  - Tooltips on collapsed state (base-ui tooltips via shadcn)
- **Top bar**: breadcrumb navigation, command palette trigger, notifications bell, agent drawer toggle
- **Command palette** (`Cmd+K`): search clients, jump to sections, create new client
- **Agent drawer** (`Cmd+J`): 400px slide-in panel with Phase 2 empty state

### Onboarding Wizard (7-step)
1. Client name + industry + description
2. Business stage (radio cards)
3. Target customer (with "common mistakes" helper)
4. 12-month success definition
5. Budget (log-scale slider, INR) + ad-spend appetite
6. Channels (multi-select chips) + handles
7. What's not working (free text)

- Progressive save (state persists across steps)
- On completion, calls Anthropic API to synthesize a structured brief
- Falls back to manual brief if AI call fails
- Shows synthesized brief for editing before final save
- Creates client with profile + brief in one transaction

### Project Home Page (`/clients/[slug]`)
- Hero card: name (serif), industry, stage chip, created date, north star
- 2x3 section tile grid: Profile, History, Ideas, Marketing, Social, Agents
- Recent activity placeholder
- Staggered panel-in animation

### Section Routes
- **Profile** (`/clients/[slug]/profile`): full editable brief with all fields (summary, north star, audience, voice, constraints)
- **History, Ideas, Marketing, Social, Agents**: designed empty states with section-specific icons, descriptions, and "Coming in Phase 2" badge

### Settings
- Stub page with empty state

### Anthropic SDK Wrapper
- Single `lib/anthropic.ts` with `callAI()` function
- Retry-compatible, 60s default, kill switch via `AI_DISABLED=1`
- Used only for brief synthesis (no copy generation)

### State Management
- Zustand stores: sidebar, drawer, command palette
- TanStack Query provider wired up (ready for Phase 2)

## What was skipped and why

- **ESLint config**: Next.js 16 no longer bundles eslint config by default. The `--no-eslint` flag was used during setup. Linting can be configured in Phase 2 with a custom flat config.
- **Lucia auth**: Replaced with a simpler custom session system since this is a single-user app. Lucia's multi-user session model adds unnecessary complexity. Can migrate later if needed.
- **Dark mode toggle**: CSS variables for dark mode are fully defined, but no toggle UI exists yet. Add `class="dark"` to `<html>` to activate.
- **Database backup cron**: Defined in spec but belongs to Phase 2's cron infrastructure.
- **Lighthouse audit**: Requires a running server for measurement. Run manually with `pnpm build && pnpm start`.

## Known Issues

1. Next.js 16 shows a deprecation warning about `middleware` → `proxy` migration. The middleware still works but should be migrated to the new proxy convention in Phase 2.
2. The esbuild version is pinned to 0.25.12 via pnpm overrides due to macOS compatibility (Darwin 20.6.0 / Big Sur). Upgrading macOS would remove this constraint.
3. The `(auth)` route group for `/login` does not use the `(app)` layout, which is intentional — login should not show the sidebar.

## Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Type check
pnpm typecheck

# Production build
pnpm build

# Start production server
pnpm start

# Format code
pnpm format
```

## Environment Variables

Create `.env.local` in the project root:

```
ANTHROPIC_API_KEY=your-api-key-here
AI_DISABLED=0
```

Set `AI_DISABLED=1` to skip AI calls (onboarding will use a manual fallback brief).
