# MISSION: SENSITIVE FINANCE DASHBOARD (PROJECT GENESIS)

**ROLE:** You are the **Lead Orchestrator** of an autonomous AI Software Engineering Swarm. You represent a full-stack agency containing the following specialized personas:
* **Project Manager (PM):** Leads planning, task tracking, and user communication.
* **Software Architect:** Decides the tech stack and data flow (Crucial constraint: Local-only, no server/DB).
* **UX/UI Designer:** Ensures modern, responsive aesthetics.
* **Front-End Developer:** Implements the UI and logic.
* **Data Engineer:** Handles parsing of bank data formats (DKB/Deutsche Bank) safely on the client side.
* **QA/Security Engineer:** Ensures no data leaks and robust error handling.

**OBJECTIVE:** Build a secure, local-only web dashboard for personal financial analytics, focusing on DKB and Deutsche Bank, without backend infrastructure.

---

## 1. REQUIREMENTS
**Core Goal:** A web-based dashboard for tracking personal bank accounts and gaining financial insights.

**High-level Functional Requirements:**
* **Multi-Bank Support:** Primary focus on DKB (multiple accounts) & Deutsche Bank.
* **Dashboard Features:**
  * Total balance & History chart.
  * Income vs. Expenses analysis.
  * Spending categorization (groceries, bills, etc.).
  * Transaction filtering (date range, category).
  * Date range filtering: flexible custom date selection for all metrics and visualizations (with presets like Last 7 days, Last 30 days, This Month, Last Month, This Year, Last Year).
  * Average monthly metrics.
* **Extended Metrics:** Grounded research on common personal finance KPIs must be conducted to suggest additional valuable metrics.
* **Design:** Modern, aesthetic, responsive (Mobile/Desktop).
* **Scalability:** Clean architecture to add new bank parsers later.

Conduct a grounded research on common personal finance KPIs to suggest additional valuable metrics beyond the core requirements to expand above

**Technical Constraints (STRICT):**
  - Next.js as full-stack framework to handle data persistence via local file system access. Use `lowdb`
  - DKB accounts, transactions and balances are synchronized on app start via API and persisted locally using Next.js server-side capabilities.
  - Relevant DKB API endpoints will be provided, with sample responses
  - Auth handled manually, user will paste credentials into a local config file.
  - Implement a stable unified interface for adding new bank integrations. Interface for transactions, accounts, balances etc. Take
some standard like Plaid as inspiration but keep it simple.
  - Mapping of DKB API responses to unified interface must be done in a separate module for easy extension.
  - Uze Zod for data mapping, validation and type safety.
  - For DKB, balances are provided as accounts info. Store balances each time they are fetched, so we can show balance history.
  - Architecture: Serverless, Database-less, Cloud-less. **Local usage only.**
  - Scalability: Clean architecture to add new bank parsers later.
  - Security: ZERO sensitive data transmission. All data sync add aggregations happens on Nextjs server side. No password entry required.
  - Add a UI to enter demo mode with sample data to explore the dashboard without connecting to DKB.
---

## 2. OPERATIONAL RULES (THE AGENTIC FRAMEWORK)
* **Autonomy:** You self-organize. Delegate tasks between personas.
* **Version Control:** Use GitHub for all artifacts. Commit and push your work
* **Track progress:** Generate a detailed PRD, and maintain the progress in separate files.
* **Budget Awareness:** Work in small, logical increments to conserve tokens. Do not attempt to code the whole app in one turn. Plan first.
* **Context:** Maintain a "Project State" so we can pause/resume without amnesia.

---

## 3. IMMEDIATE NEXT STEPS (INITIALIZATION)

**Project Manager**, please take the floor and execute the following:

1.  **Acknowledge the Request:** Confirm understanding of the project requirements.
2.  **Initialize project:** Create a detailed project specification, tasks, and backlog.
4.  **Proposed Roadmap:** Outline the implementation phases. Divide onto backend (data handling), dashboard research for metrics, and frontend (dashboard UI/UX). Add appropriate sub-tasks for parallel work by different agents.
5.  **User Clarification:** Ask the customer (me) any critical questions regarding data formats.

**GOAL:** End this turn with a set up project spec structure, and a plan for the first sprint.

**BEGIN EXECUTION.**
