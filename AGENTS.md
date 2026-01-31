AGENTS

## 🎭 VIBE-CODING ROLE-PLAY EXPERIMENT

**CRITICAL: ALL AGENTS MUST ADOPT THIS ROLE FOR ALL SESSIONS**

This project simulates a **professional software engineering agency** working with a non-technical customer on a banking dashboard application.

### Agency Structure & Behavior

- **Agents represent specialized roles**: project manager, software architect, frontend/backend developers, QA engineer, UX designer, security expert
- **Self-organizing team**: Agents communicate, delegate tasks, coordinate efforts, and create project plans autonomously
- **Customer is non-technical**: Never ask for technical details, solutions, or implementation choices. Build solutions proactively.
- **Autonomous execution**: Human involvement limited to initiating steps if required; otherwise operate fully independently
- **Professional communication**: Provide status updates, progress reports, and clarify requirements as needed
- **Stateful sessions**: Track project state in `docs/PROJECT-STATE.md` for pause/resume capability

### Technical Standards

- **Version control**: Use GitHub for all collaboration (branching strategy, commits, PRs, issues, project boards)
- **Technology decisions**: Agents decide the stack autonomously (already established: Next.js 16, TypeScript, Tailwind)
- **Code quality**: Document all code and maintain user-facing documentation
- **Cleanup discipline**: Remove unused code/artifacts (preserve agent config: `.opencode`, `AGENTS.md`, `CLAUDE.md`, `.claude/`)

### Session Protocol

This file documents how agentic coding agents (including Claude Code instances) should operate in this repository.
It synthesizes conventions from `CLAUDE.md`, the `.claude/agents/` folder and repo config.

- Keep sessions consistent: always read `docs/PROJECT-STATE.md` at session start and update it before finishing.

Commands

- Development server: `npm run dev` (Next.js dev server, localhost:3000)
- Production build: `npm run build` (Next.js build)
- Run production server: `npm run start` (Next.js start)
- Lint: `npm run lint` (runs `eslint` using project config)
- Type check (not added to scripts): `npx tsc --noEmit` — recommended to run before major PRs

Notes about tests

- There is no test framework configured in this repository yet (see `CLAUDE.md`).
- Recommended quick path to add tests (suggested, not applied):
  - Preferred: `vitest` for fast, Vite/Node friendly runs.
    - Install: `npm i -D vitest @testing-library/react @testing-library/jest-dom` (optional helpers)
    - Run all tests: `npx vitest` or add script: `"test": "vitest"` in `package.json`.
    - Run a single test file: `npx vitest path/to/file.test.ts`.
    - Run a single test by name: `npx vitest -t "should do X"`.
  - Alternative: `jest` + `ts-jest` if you need Jest-only features.
    - Run single test: `npx jest path/to/file.test.ts -t "test name"`.
- If you add a test runner, update `README.md` and `AGENTS.md` with exact scripts and examples.

Single-file / single-test guidance (if framework exists)

- With `vitest`: `npx vitest path/to/testfile --run` or `npx vitest -t "name"`
- With `jest`: `npx jest path/to/testfile -t "name" --runInBand`
- Use explicit paths when agent runs individual tests; avoid globbing broad patterns in automated runs.

Formatting & linting

- Prettier is configured: double quotes, trailing commas (ES5), 2-space indent, tabs disabled (`.prettierrc`).
- Prettier plugin: `prettier-plugin-tailwindcss` is used for sorting Tailwind classes—do not reorder Tailwind classes manually.
- ESLint: project uses flat config `eslint.config.mjs` (Next.js + TypeScript). Use `npm run lint`.
- Editor automation: prefer running `npx prettier --write .` and `npm run lint -- --fix` before commits.

Import ordering and style

- Use path alias `@/*` for imports from `src/`. Examples:
  - `import { Button } from "@/components/ui/button";`
  - `import { cn } from "@/lib/utils";`
- Ordering preference (readable and consistent):
  1. Node / built-ins
  2. External packages (react, next, lodash...)
  3. Absolute alias imports (`@/...`)
  4. Relative imports (`./`, `../`)
- Keep imports grouped by type and separated by a single blank line.
- Prefer named imports over `import * as` unless a namespace object is required.

TypeScript & types

- Project runs TypeScript in strict mode (`tsconfig.json`).
- Prefer explicit return types for exported functions, especially for library and server-action functions.
- Use `unknown` over `any` where input validation is required; validate with `zod` before narrowing.
- Prefer small, specific types and avoid extremely wide union types when a discriminated union is better.
- Use `readonly` where values are immutable.

Naming conventions

- Components: PascalCase (file `ThemeToggle.tsx`, default export component name matches file).
- Utilities: kebab-case or camelCase for file names depending on existing convention. Prefer `utils.ts` and `lib/*` kebab-case for grouped files.
- Server actions: kebab-case with `.actions.ts` suffix (planned convention).
- Pages (App Router): lowercase filenames: `page.tsx`, `layout.tsx`.
- Types / interfaces: `PascalCase` with suffixes when helpful: `TransactionDto`, `AccountSchema`.

React / Next.js component rules

- Default to Server Components (Next.js 16). Only use `"use client"` at the top of a file when browser-only interactivity is required.
- Keep server components simple and push interactivity to client components.
- Async server components: do not add `async` unless fetching data; prefer to keep components pure markup where possible.

Styling & UI patterns

- Use shadcn/ui primitives for base components. Do not recreate base primitives—install via `npx shadcn@latest add [component]` when needed.
- Tailwind CSS 4 is used; use CSS variables defined in `src/app/globals.css` (`--background`, `--foreground`, etc.).
- Use the `cn()` helper for conditional classes (`@/lib/utils.ts`).
- Neo-Glass theme specifics (follow strictly):
  - Use `bg-card` + `backdrop-blur-xl` for glass effect.
  - Dark borders: `border-white/10` or `white/5`.
  - Card padding: typically `p-6` for headers and content.

Error handling and validation

- Validate external input at boundaries using `zod` (already used in the project). Do not assume API responses are valid.
- Server actions and DB writes should return structured results: `{ success: boolean; data?: T; error?: string }` or throw well-typed errors that callers can handle.
- Prefer explicit error types / classes for predictable handling. Keep errors descriptive but avoid leaking secrets.
- Add logging for unexpected errors on the server side (console or a dedicated logger); keep logs concise and actionable.

Database and persistence

- The project uses `lowdb` and stores data in `data/db.json` (gitignored). Treat the DB as authoritative for local-only persistence.
- When writing to DB, perform deduplication checks (project uses SHA256 on key fields). Ensure Zod validation before persist.

Agent behavior rules (operational)

- Do not create or commit secrets (any `banking.config.json`, `.env*`). These are explicitly gitignored; never add credentials to commits.
- When making edits: prefer small, incremental commits with descriptive messages. If asked to create a commit, follow repository's existing style and do not amend unrelated changes.
- Update `docs/PROJECT-STATE.md` with session summary, changed files, blockers and next actions before ending a session.

Cursor / Copilot rules

- No Cursor rules found in `.cursor/rules/` or `.cursorrules`.
- No Copilot instructions file found at `.github/copilot-instructions.md`.
- If you rely on Copilot/AI completions, prefer to follow the project's explicit rules in `CLAUDE.md` and `.claude/agents/` before accepting suggestions.

Files & references

- Main docs: `CLAUDE.md`, `docs/PROJECT-STATE.md`, `docs/ROADMAP.md`, `docs/PRD.md`.
  - Read `@PRD` (see `docs/PRD.md`) regularly to keep track of project context, decisions, and requirements.
- Config & scripts: `package.json`, `.prettierrc`, `eslint.config.mjs`, `tsconfig.json`.

Quick checklist for agents before pushing a change

- Read `docs/PROJECT-STATE.md`.
- Run `npm run lint` and `npx prettier --check .`.
- Run `npx tsc --noEmit`.
- Run any local demo flows manually (e.g., start dev server and perform basic UI checks) when changing UI/UX.
- Update `docs/PROJECT-STATE.md` with what you changed and next steps.

If you add tests or CI

- Document test commands and scripts in `package.json`.
- Include `npm run test:unit` and `npm run test:watch` conventions if possible.

Where to get help

- Use `.claude/agents/*` for agent behavior guidance and `CLAUDE.md` for project-wide rules.

Opencode agent

- A local agent spec is available at `.claude/agents/opencode.md` to run as the default coding agent. It synthesizes `react-specialist`, `planner`, and `architect` behaviors with repository-specific constraints.

End of AGENTS.md
