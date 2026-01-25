import { z } from "zod";
import type { BankCredentials } from "../../types";

/**
 * DKB API Client
 *
 * Provides functions to interact with DKB Banking API endpoints.
 * Requires session cookies and CSRF token from DKB webapp.
 *
 * Base URL: https://banking.dkb.de/api
 */

const DKB_BASE_URL = "https://banking.dkb.de/api";

// --- Response Schemas (DKB API format) ---

const DkbAmountSchema = z.object({
  currencyCode: z.string(),
  value: z.string(), // Decimal as string (e.g., "-55.00")
});

const DkbProductSchema = z.object({
  id: z.string(),
  type: z.string(),
  displayName: z.string(),
});

const DkbInterestConditionSchema = z.object({
  interestRate: z.string(),
  condition: z
    .object({
      currency: z.string(),
      minimumAmount: z.string(),
    })
    .optional(),
});

const DkbInterestSchema = z.object({
  type: z.string(),
  method: z.string(),
  details: z.array(DkbInterestConditionSchema),
});

const DkbReferenceAccountSchema = z.object({
  iban: z.string().optional(),
  accountNumber: z.string().optional(),
  blz: z.string().optional(),
});

const DkbAccountAttributesSchema = z.object({
  holderName: z.string(),
  iban: z.string(),
  permissions: z.array(z.string()),
  currencyCode: z.string(),
  balance: DkbAmountSchema,
  availableBalance: DkbAmountSchema.optional(),
  nearTimeBalance: DkbAmountSchema.optional(),
  product: DkbProductSchema,
  state: z.string(),
  updatedAt: z.string(),
  openingDate: z.string().optional(),
  overdraftLimit: z.string().optional(),
  interestRate: z.string().optional(),
  unauthorizedOverdraftInterestRate: z.string().optional(),
  lastAccountStatementDate: z.string().optional(),
  interests: z.array(DkbInterestSchema).optional(),
  referenceAccount: DkbReferenceAccountSchema.optional(),
});

const DkbAccountSchema = z.object({
  type: z.literal("account"),
  id: z.string(),
  attributes: DkbAccountAttributesSchema,
});

const DkbAccountsResponseSchema = z.object({
  data: z.array(DkbAccountSchema),
  included: z.array(z.unknown()).optional(),
});

const DkbAccountOrAgentSchema = z.object({
  accountNr: z.string().optional(),
  blz: z.string().optional(),
  iban: z.string().optional(),
});

const DkbCreditorSchema = z.object({
  name: z.string().optional(),
  creditorAccount: DkbAccountOrAgentSchema.optional(),
  agent: z
    .object({
      bic: z.string().optional(),
    })
    .optional(),
  intermediaryName: z.string().optional(),
});

const DkbDebtorSchema = z.object({
  name: z.string().optional(),
  debtorAccount: DkbAccountOrAgentSchema.optional(),
  agent: z
    .object({
      bic: z.string().optional(),
    })
    .optional(),
});

const DkbMerchantCategorySchema = z.object({
  name: z.string(),
  imageUrl: z.string().optional(),
  subCategories: z.array(z.string()).optional(),
});

const DkbMerchantLogoSchema = z.object({
  url: z.string(),
  score: z.number(),
});

const DkbMerchantSchema = z.object({
  name: z.string().optional(),
  category: DkbMerchantCategorySchema.optional(),
  logo: DkbMerchantLogoSchema.optional(),
});

const DkbTransactionAttributesSchema = z.object({
  status: z.string(),
  bookingDate: z.string(),
  valueDate: z.string(),
  description: z.string().optional(),
  endToEndId: z.string().optional(),
  transactionType: z.string().optional(),
  transactionTypeCode: z.string().optional(),
  purposeCode: z.string().optional(),
  businessTransactionCode: z.string().optional(),
  amount: DkbAmountSchema,
  creditor: DkbCreditorSchema.optional(),
  debtor: DkbDebtorSchema.optional(),
  isRevocable: z.boolean().optional(),
  merchant: DkbMerchantSchema.optional(),
});

const DkbTransactionSchema = z.object({
  type: z.literal("accountTransaction"),
  id: z.string(),
  attributes: DkbTransactionAttributesSchema,
});

const DkbPageMetaSchema = z.object({
  next: z.string().optional(),
});

const DkbLinksSchema = z.object({
  next: z.string().optional(),
});

const DkbTransactionsResponseSchema = z.object({
  data: z.array(DkbTransactionSchema),
  meta: z
    .object({
      page: DkbPageMetaSchema.optional(),
    })
    .optional(),
  links: DkbLinksSchema.optional(),
  included: z.array(z.unknown()).optional(),
});

// --- Exported Types ---

export type DkbAccount = z.infer<typeof DkbAccountSchema>;
export type DkbTransaction = z.infer<typeof DkbTransactionSchema>;
export type DkbAccountsResponse = z.infer<typeof DkbAccountsResponseSchema>;
export type DkbTransactionsResponse = z.infer<
  typeof DkbTransactionsResponseSchema
>;

// --- Error Classes ---

export class DkbApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly response?: unknown,
  ) {
    super(message);
    this.name = "DkbApiError";
  }
}

export class DkbAuthError extends DkbApiError {
  constructor(message: string = "Authentication failed - invalid credentials") {
    super(message, 401);
    this.name = "DkbAuthError";
  }
}

export class DkbNetworkError extends DkbApiError {
  constructor(message: string, public readonly originalError?: unknown) {
    super(message);
    this.name = "DkbNetworkError";
  }
}

// --- Helper Functions ---

function buildHeaders(credentials: BankCredentials): HeadersInit {
  return {
    Cookie: credentials.cookie,
    "x-xsrf-token": credentials.xsrfToken,
    Accept: "application/json, text/plain, */*",
  };
}

async function fetchWithErrorHandling(
  url: string,
  credentials: BankCredentials,
): Promise<unknown> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: buildHeaders(credentials),
    });
  } catch (error) {
    throw new DkbNetworkError(
      `Network request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      error,
    );
  }

  // Handle HTTP errors
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new DkbAuthError(
        `Authentication failed (HTTP ${response.status}) - please refresh your DKB session credentials`,
      );
    }

    let errorBody: unknown;
    try {
      errorBody = await response.json();
    } catch {
      errorBody = await response.text();
    }

    throw new DkbApiError(
      `DKB API request failed: HTTP ${response.status} ${response.statusText}`,
      response.status,
      errorBody,
    );
  }

  // Parse JSON response
  try {
    return await response.json();
  } catch (error) {
    throw new DkbApiError(
      `Failed to parse JSON response: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// --- Public API Functions ---

/**
 * Fetch all DKB accounts (excluding loans)
 *
 * @param credentials - DKB session credentials (cookie + CSRF token)
 * @returns Array of DKB account objects
 * @throws {DkbAuthError} If authentication fails
 * @throws {DkbNetworkError} If network request fails
 * @throws {DkbApiError} For other API errors
 */
export async function fetchDkbAccounts(
  credentials: BankCredentials,
): Promise<DkbAccount[]> {
  const url = `${DKB_BASE_URL}/accounts/accounts?filter[product.type][NEQ]=loan`;

  const data = await fetchWithErrorHandling(url, credentials);

  // Validate response structure
  const parsed = DkbAccountsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new DkbApiError(
      `Invalid accounts response format: ${parsed.error.message}`,
    );
  }

  return parsed.data.data;
}

/**
 * Fetch all transactions for a specific DKB account with full pagination
 *
 * Automatically handles pagination by following page.next cursors until
 * all transactions are retrieved.
 *
 * @param accountId - DKB account UUID
 * @param credentials - DKB session credentials (cookie + CSRF token)
 * @returns Array of all transactions for the account
 * @throws {DkbAuthError} If authentication fails
 * @throws {DkbNetworkError} If network request fails
 * @throws {DkbApiError} For other API errors
 */
export async function fetchDkbTransactions(
  accountId: string,
  credentials: BankCredentials,
): Promise<DkbTransaction[]> {
  const allTransactions: DkbTransaction[] = [];
  let nextCursor: string | undefined;
  let pageCount = 0;
  const MAX_PAGES = 1000; // Safety limit to prevent infinite loops

  do {
    pageCount++;

    // Build URL with pagination
    const params = new URLSearchParams({
      expand: "Merchant",
      "page[size]": "25",
    });

    if (nextCursor) {
      params.set("page[after]", nextCursor);
    }

    const url = `${DKB_BASE_URL}/accounts/accounts/${accountId}/transactions?${params.toString()}`;

    // Fetch page
    const data = await fetchWithErrorHandling(url, credentials);

    // Validate response structure
    const parsed = DkbTransactionsResponseSchema.safeParse(data);
    if (!parsed.success) {
      throw new DkbApiError(
        `Invalid transactions response format (page ${pageCount}): ${parsed.error.message}`,
      );
    }

    // Collect transactions from this page
    allTransactions.push(...parsed.data.data);

    // Get next page cursor
    nextCursor = parsed.data.meta?.page?.next;

    // Safety check
    if (pageCount >= MAX_PAGES) {
      throw new DkbApiError(
        `Pagination limit exceeded (${MAX_PAGES} pages) - possible infinite loop`,
      );
    }
  } while (nextCursor);

  return allTransactions;
}
