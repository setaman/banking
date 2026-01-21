/**
 * DKB API Client
 * 
 * Fetches transactions from DKB API with pagination support.
 * 
 * SECURITY: Bearer token must ONLY be passed as function parameter.
 * Token is NEVER stored, logged, or persisted anywhere.
 */

import type { DKBApiResponse } from '@/types';

/**
 * DKB API endpoint configuration
 */
const DKB_BASE_URL = 'https://banking.dkb.de/api';
const DEFAULT_PAGE_SIZE = 50;

/**
 * Parameters for fetching DKB transactions
 */
interface FetchTransactionsParams {
  accountId: string;
  fromDate?: string; // Format: YYYY-MM-DD
  toDate?: string;   // Format: YYYY-MM-DD
  pageSize?: number;
}

/**
 * API Error for DKB requests
 */
export class DKBApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DKBApiError';
  }
}

/**
 * Validates fetch parameters
 */
const validateParams = (params: FetchTransactionsParams): void => {
  if (!params.accountId || params.accountId.trim() === '') {
    throw new DKBApiError('Account ID is required');
  }

  if (params.fromDate && !isValidDateFormat(params.fromDate)) {
    throw new DKBApiError('Invalid fromDate format. Expected: YYYY-MM-DD');
  }

  if (params.toDate && !isValidDateFormat(params.toDate)) {
    throw new DKBApiError('Invalid toDate format. Expected: YYYY-MM-DD');
  }

  if (params.pageSize && (params.pageSize < 1 || params.pageSize > 100)) {
    throw new DKBApiError('Page size must be between 1 and 100');
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
 * Builds query parameters for API request
 */
const buildQueryParams = (params: FetchTransactionsParams): URLSearchParams => {
  const queryParams = new URLSearchParams();

  if (params.fromDate) {
    queryParams.set('filter[bookingDate][GE]', params.fromDate);
  }

  if (params.toDate) {
    queryParams.set('filter[bookingDate][LE]', params.toDate);
  }

  queryParams.set('expand', 'Merchant');
  queryParams.set('pagesize', String(params.pageSize || DEFAULT_PAGE_SIZE));

  return queryParams;
};

/**
 * Fetches a single page of transactions
 */
const fetchSinglePage = async (
  url: string,
  bearerToken: string
): Promise<DKBApiResponse> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new DKBApiError(
        `DKB API request failed: ${response.statusText}`,
        response.status
      );
    }

    const data = await response.json();
    return data as DKBApiResponse;
  } catch (error) {
    if (error instanceof DKBApiError) {
      throw error;
    }

    throw new DKBApiError(
      'Failed to fetch transactions from DKB API',
      undefined,
      error as Error
    );
  }
};

/**
 * Fetches all transactions with automatic pagination
 * 
 * @param bearerToken - DKB API bearer token (NEVER stored or logged)
 * @param params - Query parameters for filtering transactions
 * @returns Complete response with all transactions from all pages
 * 
 * @throws {DKBApiError} If validation fails or API request fails
 * 
 * @example
 * ```typescript
 * const token = getUserProvidedToken(); // From UI paste
 * const response = await fetchAllTransactions(token, {
 *   accountId: '1059960000',
 *   fromDate: '2025-01-01',
 *   toDate: '2025-12-31'
 * });
 * // Token is now discarded from memory
 * ```
 */
export const fetchAllTransactions = async (
  bearerToken: string,
  params: FetchTransactionsParams
): Promise<DKBApiResponse> => {
  // Validate bearer token
  if (!bearerToken || bearerToken.trim() === '') {
    throw new DKBApiError('Bearer token is required');
  }

  // Validate parameters
  validateParams(params);

  // Build initial URL
  const baseUrl = `${DKB_BASE_URL}/accounts/accounts/${params.accountId}/transactions`;
  const queryParams = buildQueryParams(params);
  const initialUrl = `${baseUrl}?${queryParams.toString()}`;

  // Fetch first page
  const firstPage = await fetchSinglePage(initialUrl, bearerToken);

  // If no pagination metadata or only one page, return immediately
  const totalPages = firstPage.meta?.totalPages || 1;
  const currentPage = firstPage.meta?.currentPage || 1;

  if (totalPages <= 1 || currentPage >= totalPages) {
    return firstPage;
  }

  // Fetch remaining pages in parallel
  const remainingPagePromises: Promise<DKBApiResponse>[] = [];

  for (let page = currentPage + 1; page <= totalPages; page++) {
    const pageQueryParams = new URLSearchParams(queryParams);
    pageQueryParams.set('page', String(page));
    const pageUrl = `${baseUrl}?${pageQueryParams.toString()}`;
    
    remainingPagePromises.push(fetchSinglePage(pageUrl, bearerToken));
  }

  const remainingPages = await Promise.all(remainingPagePromises);

  // Combine all transactions
  const allTransactions = [
    ...firstPage.data,
    ...remainingPages.flatMap(page => page.data),
  ];

  // Return combined response
  return {
    data: allTransactions,
    included: firstPage.included,
    meta: firstPage.meta,
  };
};
