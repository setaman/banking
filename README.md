# BanKing

A personal banking application for importing and analyzing financial transactions from German bank CSV exports.

> **Note:** This is a fresh rebuild from Next.js 14 to Next.js 16. Banking features (CSV import, database, statistics) will be implemented in upcoming iterations.

## Overview

BanKing helps you manage and analyze your personal finances by importing transaction data from German banks. The app currently supports DKB and Deutsche Bank CSV formats, with plans to add more institutions.

## Features

### Current (v0.1.0)
- Modern UI foundation with shadcn/ui components
- Dark/light theme support with system preference detection
- Responsive layout with header and footer
- Type-safe development with TypeScript strict mode

### Planned
- CSV import for DKB and Deutsche Bank transactions
- Transaction deduplication using SHA256 hashing
- Interactive dashboard with financial statistics
- Income/expense analysis and visualization
- Transaction categorization and filtering
- Multiple bank account management

## Tech Stack

- **Framework:** Next.js 16.1.4 (App Router)
- **React:** 19.2.3
- **TypeScript:** 5.x (strict mode)
- **Styling:** Tailwind CSS 4 with custom theme configuration
- **UI Components:** shadcn/ui (Radix UI primitives)
- **Icons:** Lucide React
- **Animations:** Motion (Framer Motion successor)
- **Theme:** next-themes for dark mode support
- **Fonts:** Geist Sans & Geist Mono (optimized via next/font)

## Getting Started

### Prerequisites

- Node.js 20.x or later
- npm, yarn, pnpm, or bun

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd banking
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Project Structure

```
banking/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx          # Root layout with theme provider
│   │   ├── page.tsx            # Home page
│   │   ├── globals.css         # Global styles and theme variables
│   │   └── favicon.ico         # App icon
│   ├── components/
│   │   ├── ui/                 # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   └── table.tsx
│   │   ├── layout/             # Layout components
│   │   │   ├── header.tsx      # App header with navigation
│   │   │   ├── nav.tsx         # Navigation component
│   │   │   └── footer.tsx      # App footer
│   │   ├── theme-provider.tsx  # next-themes wrapper
│   │   └── theme-toggle.tsx    # Dark/light mode toggle
│   └── lib/
│       └── utils.ts            # Utility functions (cn helper)
├── .claude/                    # Claude Code agents configuration
├── next.config.ts              # Next.js configuration
├── tsconfig.json               # TypeScript configuration
├── eslint.config.mjs           # ESLint configuration
├── postcss.config.mjs          # PostCSS configuration
├── .prettierrc                 # Prettier configuration
└── package.json                # Dependencies and scripts
```

## Configuration

### Path Aliases

The project uses TypeScript path aliases for cleaner imports:

```typescript
"@/*" → "./src/*"
```

Example:
```typescript
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

### Theme System

The app uses Tailwind CSS 4's native theme configuration with CSS custom properties. Theme tokens are defined in `src/app/globals.css` and support both light and dark modes.

Key theme features:
- OKLCH color space for perceptually uniform colors
- CSS custom properties for runtime theme switching
- Automatic dark mode with `next-themes`
- Geist font family with variable fonts

### Code Style

- **Prettier:** Double quotes, trailing commas (ES5), 2-space indent
- **ESLint:** Next.js recommended config with TypeScript support
- **TypeScript:** Strict mode enabled with path aliases

## Migration from Next.js 14

This project was rebuilt from scratch on Next.js 16. Key architectural changes:

### What's Different
- **React 19:** New features and performance improvements
- **Tailwind CSS 4:** Native CSS integration via PostCSS
- **Simplified routing:** No route groups yet (flat structure in src/app/)
- **Modern ESLint:** Flat config format (eslint.config.mjs)
- **Server Components by default:** No need for explicit async markers

### What's the Same
- App Router architecture
- TypeScript strict mode
- shadcn/ui component library
- Dark mode with next-themes

### What's Coming
The previous implementation included:
- LowDB for local data persistence
- PapaParse for CSV processing
- Zod for schema validation
- ECharts for data visualization
- date-fns for date manipulation
- Server actions for data mutations

These will be re-implemented with Next.js 16 best practices.

## Environment Variables

Currently, no environment variables are required. Future implementation will include:

- `IS_IN_CLOUD`: Switch database between file-based and in-memory mode

## Contributing

This is a personal project, but suggestions and feedback are welcome through issues.

## License

[License information to be added]

## Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
