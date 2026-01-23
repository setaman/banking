# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BanKing — a personal banking app rebuilt with Next.js 16 (App Router) for importing and analyzing financial transactions from German bank CSV exports. Fresh rebuild from Next.js 14 to leverage React 19 and Next.js 16 features.

**Current Status:** Foundation phase with UI components and theme system. Banking features (CSV import, database, statistics) to be implemented.

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

### Planned Architecture (from Next.js 14 version)

The following will be re-implemented with Next.js 16 best practices:

#### Data Flow
CSV upload → PapaParse → Bank-specific Zod schema validation → SHA256 deduplication → Database storage → Server actions → Dashboard with charts

#### Key Layers to Implement
- **Server Actions:** Data mutations and queries (bank operations, user management, CSV processing)
- **Database:** Local persistence with file-based or in-memory storage
- **Institution Maps:** Bank-specific CSV parsers (DKB, Deutsche Bank)
- **Statistics:** Balance, income, expense calculations and aggregations
- **Dashboard:** Transaction visualization with charts

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

### Planned Dependencies
- PapaParse (CSV parsing)
- Zod (schema validation)
- date-fns (date manipulation)
- Database library (TBD, previously LowDB)
- Charting library (TBD, previously ECharts)
- currency.js (EUR formatting)

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

## Future Implementation Notes

### Banking Features (Next.js 14 → 16 Migration)

When implementing banking functionality, adapt the old architecture:

1. **CSV Import:**
   - Use PapaParse for parsing
   - Bank-specific Zod schemas in `src/lib/institutionsMaps/`
   - German date formats (DD.MM.YY for DKB, DD.MM.YYYY for Deutsche Bank)
   - German number format (comma = decimal, period = thousands)

2. **Database:**
   - Consider modern alternatives to LowDB
   - Support both file-based and in-memory modes
   - Use server actions for all CRUD operations

3. **Routing (Planned):**
   ```
   src/app/
   ├── (dashboard)/          # Route group for authenticated pages
   │   ├── page.tsx          # Bank accounts list
   │   └── [id]/page.tsx     # Account dashboard
   └── (public)/             # Route group for public pages
       └── upload/page.tsx   # CSV upload (client component)
   ```

4. **Server Actions:**
   - Create `*.actions.ts` files for data operations
   - Use `"use server"` directive
   - Implement proper error handling and validation

5. **Statistics & Visualization:**
   - Re-evaluate charting library (ECharts or alternatives)
   - Use server components for data aggregation
   - Leverage React 19 features for streaming

### Environment Variables (To Be Added)
- `IS_IN_CLOUD`: Toggle between file-based and in-memory database
- Development/production specific configs

## Additional Notes

- No test framework configured yet
- No CI/CD pipeline configured
- This is a personal finance app for German banking formats (EUR currency)
- Security considerations for CSV parsing and data storage to be addressed during implementation
