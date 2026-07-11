/**
 * Barrel of all read-only finance tools available to the AI assistant.
 *
 * Every tool wraps existing server actions / pure stats functions — no new
 * calculations, no direct DB access. Keyed by snake_case name for direct use
 * as the `tools` record passed to `generateText`/`streamText`.
 */
import { comparePeriodsTool } from "./compare-periods";
import { getAccountsTool } from "./get-accounts";
import { getBalancePredictionTool } from "./get-balance-prediction";
import { getBudgetSplitTool } from "./get-budget-split";
import { getCategoryBreakdownTool } from "./get-category-breakdown";
import { getEmergencyFundTool } from "./get-emergency-fund";
import { getExpenseVolatilityTool } from "./get-expense-volatility";
import { getIncomeStabilityTool } from "./get-income-stability";
import { getLargestExpensesTool } from "./get-largest-expenses";
import { getMonthlyCashFlowTool } from "./get-monthly-cash-flow";
import { getRecurringExpensesTool } from "./get-recurring-expenses";
import { getSavingsRateTool } from "./get-savings-rate";
import { getSpendingPatternsTool } from "./get-spending-patterns";
import { getTotalBalanceTool } from "./get-total-balance";
import { searchTransactionsTool } from "./search-transactions";

export const financeTools = {
  get_accounts: getAccountsTool,
  get_total_balance: getTotalBalanceTool,
  get_monthly_cash_flow: getMonthlyCashFlowTool,
  get_category_breakdown: getCategoryBreakdownTool,
  get_budget_split: getBudgetSplitTool,
  get_savings_rate: getSavingsRateTool,
  get_recurring_expenses: getRecurringExpensesTool,
  get_expense_volatility: getExpenseVolatilityTool,
  get_income_stability: getIncomeStabilityTool,
  get_emergency_fund: getEmergencyFundTool,
  get_balance_prediction: getBalancePredictionTool,
  search_transactions: searchTransactionsTool,
  compare_periods: comparePeriodsTool,
  get_largest_expenses: getLargestExpensesTool,
  get_spending_patterns: getSpendingPatternsTool,
} as const;

export type FinanceToolName = keyof typeof financeTools;
