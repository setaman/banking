/**
 * DKB API Client
 *
 * Fetches transactions from DKB API via server-side route.
 *
 * SECURITY: Credentials (cookie, XSRF token) must ONLY be passed as function parameters.
 * Credentials are NEVER stored, logged, or persisted anywhere.
 */

import type { DKBApiResponse } from "@/types";

/**
 * Authentication credentials for DKB API
 */
export interface DKBCredentials {
  cookie: string; // Full cookie header from browser
  xsrfToken: string; // x-xsrf-token header value
}

/**
 * Parameters for fetching DKB transactions
 */
interface FetchTransactionsParams {
  accountId: string;
  fromDate?: string; // Format: YYYY-MM-DD
  toDate?: string; // Format: YYYY-MM-DD
  pageSize?: number;
}

/**
 * API Error for DKB requests
 */
export class DKBApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = "DKBApiError";
  }
}

/**
 * Validates fetch parameters
 */
const validateParams = (params: FetchTransactionsParams): void => {
  if (!params.accountId || params.accountId.trim() === "") {
    throw new DKBApiError("Account ID is required");
  }

  if (params.fromDate && !isValidDateFormat(params.fromDate)) {
    throw new DKBApiError("Invalid fromDate format. Expected: YYYY-MM-DD");
  }

  if (params.toDate && !isValidDateFormat(params.toDate)) {
    throw new DKBApiError("Invalid toDate format. Expected: YYYY-MM-DD");
  }

  if (params.pageSize && (params.pageSize < 1 || params.pageSize > 100)) {
    throw new DKBApiError("Page size must be between 1 and 100");
  }
};

/**
 * Validates date format (YYYY-MM-DD)
 */
const isValidDateFormat = (date: string): boolean => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) return false;

  const parsedDate = new Date(date);
  return !isNaN(parsedDate.getTime());
};

/**
 * Fetches all transactions with automatic pagination (handled server-side)
 *
 * @param credentials - DKB API credentials (cookie + XSRF token, NEVER stored or logged)
 * @param params - Query parameters for filtering transactions
 * @returns Complete response with all transactions from all pages
 *
 * @throws {DKBApiError} If validation fails or API request fails
 *
 * @example
 * ```typescript
 * const credentials = getUserProvidedCredentials(); // From UI paste
 * const response = await fetchAllTransactions(credentials, {
 *   accountId: '1059960000',
 *   fromDate: '2025-01-01',
 *   toDate: '2025-12-31'
 * });
 * // Credentials are now discarded from memory
 * ```
 */
export const fetchAllTransactions = async (
  credentials: DKBCredentials,
  params: FetchTransactionsParams,
): Promise<DKBApiResponse> => {
  // Validate credentials
  if (!credentials.cookie || credentials.cookie.trim() === "") {
    throw new DKBApiError("Cookie is required");
  }
  if (!credentials.xsrfToken || credentials.xsrfToken.trim() === "") {
    throw new DKBApiError("XSRF token is required");
  }

  // Validate parameters
  validateParams(params);

  try {
    // Call server-side API route (handles pagination internally)
    const response = await fetch("/api/dkb/transactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cookie: credentials.cookie,
        xsrfToken: credentials.xsrfToken,
        accountId: params.accountId,
        fromDate: params.fromDate,
        toDate: params.toDate,
        pageSize: params.pageSize,
      }),
    });

    if (!response.ok) {
      // Try to parse error message from response
      const errorData = await response.json().catch(() => ({}));
      throw new DKBApiError(
        errorData.error || `API request failed: ${response.statusText}`,
        response.status,
      );
    }

    const data = await response.json();
    return data as DKBApiResponse;
  } catch (error) {
    if (error instanceof DKBApiError) {
      throw error;
    }

    throw new DKBApiError(
      "Failed to fetch transactions from DKB API",
      undefined,
      error as Error,
    );
  }
};
