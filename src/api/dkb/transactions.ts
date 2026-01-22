/**
 * Server-side API route for DKB transactions
 * 
 * This route handles communication with the DKB banking API, including:
 * - Setting Cookie headers (not possible from browser)
 * - Automatic pagination (fetches all pages)
 * - Error handling
 * 
 * SECURITY: Credentials are passed per-request and never stored.
 */

import type { Request, Response } from 'express';

interface TransactionRequestBody {
  cookie: string;
  xsrfToken: string;
  accountId: string;
  fromDate?: string;
  toDate?: string;
  pageSize?: number;
}

interface DKBApiResponse {
  data: any[];
  included: any[];
  meta?: {
    totalPages?: number;
    currentPage?: number;
  };
}

const DKB_BASE_URL = 'https://banking.dkb.de/api';
const DEFAULT_PAGE_SIZE = 50;

/**
 * Build query parameters for DKB API
 */
function buildQueryParams(
  fromDate?: string,
  toDate?: string,
  pageSize?: number
): URLSearchParams {
  const params = new URLSearchParams();
  
  if (fromDate) {
    params.set('filter[bookingDate][GE]', fromDate);
  }
  
  if (toDate) {
    params.set('filter[bookingDate][LE]', toDate);
  }
  
  params.set('expand', 'Merchant');
  params.set('pagesize', String(pageSize || DEFAULT_PAGE_SIZE));
  
  return params;
}

/**
 * Fetch a single page from DKB API
 */
async function fetchPage(
  url: string,
  cookie: string,
  xsrfToken: string
): Promise<DKBApiResponse> {
  const headers = {
    'Cookie': cookie,
    'x-xsrf-token': xsrfToken,
    // Mirror browser request headers to satisfy DKB content negotiation
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en-DE;q=0.7,en;q=0.6',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
    'Referer': 'https://banking.dkb.de/',
    'Origin': 'https://banking.dkb.de',
  } as Record<string,string>;

  console.log('[DKB API] Outgoing request headers:', headers);

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `DKB API error: ${response.status} ${response.statusText}${text ? ` - ${text}` : ''}`
    );
  }

  return response.json();
}

/**
 * POST /api/dkb/transactions
 * 
 * Fetches all transactions from DKB with automatic pagination
 */
export const POST = async (req: Request, res: Response) => {
  const body = req.body as TransactionRequestBody;
  const { cookie, xsrfToken, accountId, fromDate, toDate, pageSize } = body;

  // Validation
  if (!cookie || !xsrfToken || !accountId) {
    return res.status(400).json({
      error: 'Missing required fields: cookie, xsrfToken, accountId'
    });
  }

  try {
    // Build initial URL
    const queryParams = buildQueryParams(fromDate, toDate, pageSize);
    const baseUrl = `${DKB_BASE_URL}/accounts/accounts/${accountId}/transactions`;
    const initialUrl = `${baseUrl}?${queryParams.toString()}`;

    console.log(`[DKB API] Fetching transactions from ${accountId}...`);

    // Fetch first page
    const firstPage = await fetchPage(initialUrl, cookie, xsrfToken);

    // Check pagination
    const totalPages = firstPage.meta?.totalPages || 1;
    const currentPage = firstPage.meta?.currentPage || 1;

    console.log(`[DKB API] First page fetched. Total pages: ${totalPages}`);

    // If only one page, return immediately
    if (totalPages <= 1 || currentPage >= totalPages) {
      return res.json(firstPage);
    }

    // Fetch remaining pages in parallel
    console.log(`[DKB API] Fetching ${totalPages - 1} additional pages in parallel...`);
    
    const pagePromises: Promise<DKBApiResponse>[] = [];
    
    for (let page = currentPage + 1; page <= totalPages; page++) {
      const pageParams = new URLSearchParams(queryParams);
      pageParams.set('page', String(page));
      const pageUrl = `${baseUrl}?${pageParams.toString()}`;
      pagePromises.push(fetchPage(pageUrl, cookie, xsrfToken));
    }

    const remainingPages = await Promise.all(pagePromises);

    // Combine all transactions
    const allTransactions = [
      ...firstPage.data,
      ...remainingPages.flatMap((page) => page.data),
    ];

    console.log(`[DKB API] Successfully fetched ${allTransactions.length} transactions from ${totalPages} pages`);

    // Return combined response
    return res.json({
      data: allTransactions,
      included: firstPage.included,
      meta: {
        ...firstPage.meta,
        totalPages: 1,
        currentPage: 1,
        totalRecords: allTransactions.length,
      },
    });

  } catch (error) {
    console.error('[DKB API] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    
    // Return appropriate status code based on error
    if (message.includes('401')) {
      return res.status(401).json({ error: 'Authentication failed. Please check your credentials.' });
    } else if (message.includes('403')) {
      return res.status(403).json({ error: 'Access forbidden. Session may have expired.' });
    } else if (message.includes('404')) {
      return res.status(404).json({ error: 'Account not found.' });
    } else if (message.includes('406')) {
      return res.status(406).json({ error: 'Request not acceptable. Please check your credentials format.' });
    }
    
    return res.status(500).json({ error: message });
  }
};
