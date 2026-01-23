# CLAUDE.md

Guidance for Claude Code when working on the BanKing project.

## Quick Start

1. **Read `docs/PROJECT-STATE.md`** first - It tracks current phase, progress, and blockers
2. **Current Status:** Phase 1 (Data Layer) ✅ DONE. Phase 3 (Dashboard Charts) 🔄 IN PROGRESS
3. **Latest Commit:** `c5cc5a3` - Sprint 1 complete (data layer, server actions, statistics)
4. **Next Sprint:** Build dashboard charts, connect to real data, add demo mode UI

When finishing work:
- Always update `docs/PROJECT-STATE.md` with progress
- Commit with clear sprint/phase info
- Push to `origin/rebuild`

## Project Overview

BanKing — a personal banking app rebuilt with Next.js 16 (App Router) for importing and analyzing financial transactions from German bank accounts via DKB API. Built entirely locally with no cloud dependency.

**Current Status:** Phase 1 (Data Layer) complete. Phase 2-5 (API integration, dashboard, filters, demo mode) in progress. See `docs/PROJECT-STATE.md` for detailed progress tracking.

## Build & Development Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

No test framework or type-check script configured yet.

## Architecture

### Current Implementation

This is a fresh Next.js 16 setup with:

- **UI Foundation:** shadcn/ui component library (Button, Card, Dropdown, Input, Label, Table)
- **Layout:** Header with navigation, Footer, theme toggle
- **Theme System:** next-themes with OKLCH color space, light/dark mode support
- **Styling:** Tailwind CSS 4 with native PostCSS integration

### Implemented Architecture (Phase 1 Complete)

#### Data Flow

DKB API (cookie + CSRF token) → HTTP fetch → Zod validation → SHA256 deduplication → LowDB persistence → Server actions → Dashboard with ECharts

#### Key Layers (Complete)

- **Server Actions:** `src/actions/` - accounts, transactions, stats, sync, demo operations
- **Database:** `src/lib/db/` - LowDB file-based storage with typed schema
- **Banking Layer:** `src/lib/banking/` - Unified types, adapter interface, DKB adapter stub
- **Statistics:** `src/lib/stats/` - 8 KPI calculations + 13-category transaction classifier
- **Sync Engine:** `src/lib/banking/sync.ts` - Fetch → Map → Dedupe → Persist orchestration
- **Dashboard:** `src/components/dashboard/` - Neo-Glass UI (charts pending Phase 3)

## Project Structure

```
banking/
├── src/                        # All source code
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout (includes ThemeProvider)
│   │   ├── page.tsx            # Home page
│   │   ├── globals.css         # Theme variables + Tailwind imports
│   │   └── favicon.ico
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── layout/             # Header, Nav, Footer
│   │   ├── theme-provider.tsx  # next-themes wrapper
│   │   └── theme-toggle.tsx    # Dark mode toggle button
│   └── lib/
│       └── utils.ts            # cn() helper for class merging
├── .claude/                    # Claude Code configuration
│   ├── agents/                 # Agent definitions
│   └── settings.json           # Claude settings
├── next.config.ts              # Next.js configuration (minimal)
├── tsconfig.json               # TypeScript config with path aliases
├── eslint.config.mjs           # Flat ESLint config (Next.js + TypeScript)
├── postcss.config.mjs          # PostCSS config for Tailwind CSS 4
├── .prettierrc                 # Code formatting rules
└── package.json                # Dependencies and scripts
```

## Tech Stack

### Current Dependencies

- **Next.js:** 16.1.4 (App Router, React 19.2.3)
- **TypeScript:** 5.x (strict mode enabled)
- **Styling:** Tailwind CSS 4 with PostCSS integration
- **UI Components:** shadcn/ui (Radix UI: @radix-ui/react-dropdown-menu, react-label, react-slot)
- **Utilities:** class-variance-authority, clsx, tailwind-merge
- **Icons:** lucide-react
- **Animations:** motion (Framer Motion v12)
- **Theme:** next-themes
- **Fonts:** Geist Sans & Geist Mono (next/font/google)

### Added Dependencies (Phase 1)

- **Zod** (schema validation) ✅
- **lowdb** (file-based persistence) ✅
- **date-fns** (date manipulation) ✅
- **echarts** & **echarts-for-react** (charting) ✅
- **currency.js** (EUR formatting) ✅

### Future Dependencies

- PapaParse (CSV parsing - for Deutsche Bank fallback)

## Code Conventions

### Path Aliases

```typescript
"@/*" → "./src/*"
```

Example imports:

```typescript
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/components/theme-provider";
```

### Formatting & Linting

- **Prettier:** Double quotes, trailing commas (ES5), 2-space indent, tabs disabled
- **Prettier Plugin:** prettier-plugin-tailwindcss (auto-sorts classes)
- **ESLint:** Flat config format with next/core-web-vitals and next/typescript presets
- **TypeScript:** Strict mode, incremental builds, jsx: "react-jsx"

### Component Patterns

- **Server Components:** Default for all components (Next.js 16 standard)
- **Client Components:** Explicitly marked with `"use client"` directive when needed (interactive components, hooks, browser APIs)
- **Async Components:** No need for async markers on server components unless doing data fetching
- **Styling:** Use `cn()` utility for conditional classes

### Theme System

- **Colors:** OKLCH color space defined in `globals.css`
- **Dark Mode:** Class-based strategy (`.dark` class on `<html>`)
- **Theme Provider:** Wraps app in `layout.tsx` with system preference detection
- **CSS Variables:** All theme tokens exposed as CSS custom properties (e.g., `--background`, `--foreground`)

## Next.js 16 Specifics

### Key Differences from Next.js 14

1. **React 19 Features:**
   - React Compiler optimizations enabled by default
   - Improved server components performance
   - Better hydration error messages

2. **Caching Strategy:**
   - **Opt-in caching** with `"use cache"` directive (replaces Next.js 14's default caching)
   - Server actions and route handlers are NOT cached by default
   - Use `"use cache"` at top of file or function for explicit caching

3. **Tailwind CSS 4:**
   - Native CSS integration via `@import "tailwindcss"`
   - Theme configuration in CSS with `@theme inline { }`
   - Custom variants with `@custom-variant dark (&:is(.dark *))`
   - No separate `tailwind.config.ts` file needed

4. **TypeScript:**
   - `jsx: "react-jsx"` (replaces "preserve")
   - Built-in Next.js types via plugin

5. **ESLint:**
   - Flat config format (`eslint.config.mjs`)
   - No more `.eslintrc.json`

### Server Components (Default)

```tsx
// This is a server component by default
export default function Page() {
  return <div>No need for async unless fetching data</div>;
}
```

### Caching Example

```tsx
"use cache"; // Opt-in to caching

export async function getCachedData() {
  // This function's result will be cached
  return await fetchData();
}
```

### Client Components

```tsx
"use client"; // Explicit marker for client-side interactivity

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

## Development Guidelines

### When Adding Features

1. **UI Components:** Check if shadcn/ui has the component before building custom
2. **Styling:** Use Tailwind classes + `cn()` utility for conditionals
3. **Theme:** Use CSS custom properties from `globals.css` (e.g., `bg-background`, `text-foreground`)
4. **Server vs Client:** Default to server components, use `"use client"` only when needed
5. **Data Fetching:** Will use server actions (to be implemented)

### Theme & Components System (CRITICAL)

The application uses a highly customized "Neo-Glass" theme. Follow these rules strictly:

1.  **Strictly Use shadcn/ui Base**:
    -   Do not build custom UI primitives (buttons, cards, inputs, lists, etc.) from scratch.
    -   Always install the shadcn component first: `npx shadcn@latest add [component]`.

2.  **Extend to Match Theme**:
    -   **Glass Effect**: New components often need glassmorphism. Use `bg-card` (which has opacity) + `backdrop-blur-xl`.
    -   **Borders**: dark mode borders should be subtle (`border-white/10` or `white/5`), not the default grey.
    -   **Padding**: Enforce standard spacing. Cards typically use `p-6` for headers and content.
    -   **Shadows**: Use colorful shadows in light mode (`shadow-primary/20`).

3.  **Do Not Break Layout**:
    -   The base `Card` component has been relaxed (no enforced flex/gap).
    -   You MUST handle internal layout (e.g., `flex flex-col gap-4`) when using the component.

4.  **Charts & Visuals**:
    -   Use the defined gradient tokens (`from-primary/20 to-primary`) for charts/visuals to maintain the neon aesthetic.

### File Naming

- **Components:** PascalCase (e.g., `ThemeToggle.tsx`)
- **Utilities:** kebab-case (e.g., `utils.ts`)
- **Server Actions:** kebab-case with `.actions.ts` suffix (planned)
- **Pages:** lowercase (e.g., `page.tsx`, `layout.tsx`)

### Git Ignore

Configured to exclude:

- Standard Next.js build artifacts (`.next/`, `out/`)
- Dependencies (`node_modules/`)
- Environment files (`.env*`)
- IDE files (`.idea/`, `.vscode/`)
- Banking-specific files (`/uploads/*.json`, `db.json`) — for future implementation

## Implementation Phases & Progress

**Phase 1: Data Layer** ✅ COMPLETE (Sprint 1)
- Unified types, database, sync engine, server actions
- Statistics module with 8 KPI functions
- Demo mode with 6-month realistic sample data
- Commit: `c5cc5a3`

**Phase 2: DKB API Integration** 🔄 PENDING
- DKB adapter implementation (API client + mapper)
- Pagination handling for large transaction sets
- Credentials management (cookie + CSRF token)
- See `docs/DKB-API-SPEC.md` for endpoint details

**Phase 3: Dashboard Charts & KPIs** 📋 NEXT
- Wire dashboard to real data (demo mode first)
- ECharts integration (balance, income/expense, category breakdown)
- KPI card updates with real calculations
- Demo mode UI toggle

**Phase 4: Filters & Transactions Page** 📋 PLANNED
- DateRangePicker component with presets
- Full transactions table with filtering (date, category, account)
- Mobile responsive refinement

**Phase 5: Demo & Polish** 📋 PLANNED
- Extended KPI widgets (savings rate, volatility, trends)
- Error handling and edge cases
- Final QA pass

## Project Documentation

- **`docs/PRD.md`** - Product requirements (12 features + 12 KPIs)
- **`docs/ROADMAP.md`** - Implementation phases with dependency graph
- **`docs/PROJECT-STATE.md`** - Session progress tracking (START HERE for context)
- **`docs/DKB-API-SPEC.md`** - DKB API endpoints, pagination, auth details
- **`docs/samples/`** - Sample API responses (accounts, transactions)
- **`banking.config.example.json`** - User config template

## Development Workflow

### When Starting Work
1. Read `docs/PROJECT-STATE.md` to understand current phase and blockers
2. Check git log for recent commits
3. Review roadmap for next tasks

### When Completing Work
1. **Always sync progress** - Update `docs/PROJECT-STATE.md` with:
   - Completed items (checkmarks)
   - New blockers if any
   - Files created/modified
   - Next actions for following session
2. **Commit with clear message** - Include phase/sprint info
3. **Push to origin/rebuild** - Keep remote in sync

## Configuration

### DKB Credentials Setup

Create `banking.config.json` (do NOT commit):
```json
{
  "dkb": {
    "cookie": "_SI_VID_1=...; wtstp_eid=...; ...",
    "xsrfToken": "df9888bb-ec06-..."
  }
}
```

Extract from browser DevTools → Network tab on DKB webapp. Session expires periodically - user will need to refresh.

## Data & Security

- **Local Only:** All data persists to `/data/db.json` (gitignored)
- **No Cloud:** Zero external data transmission except to DKB API
- **No Passwords:** Credentials via session cookies, not stored plaintext
- **Deduplication:** SHA256 hashing of transaction key fields

## Additional Notes

- No test framework configured yet
- No CI/CD pipeline configured
- Strictly German banking format (EUR, date formats, categories)
- Built for Next.js 16 + React 19 with TypeScript strict mode
