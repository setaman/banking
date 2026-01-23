# DKB API Specification

**Bank:** Deutsche Kreditbank (DKB)
**Base URL:** `https://banking.dkb.de/api`

---

## Authentication

**Method:** Session Cookies + CSRF Token (from DKB webapp)

The DKB API requires session credentials obtained by reverse-engineering the main DKB web app via browser DevTools.

**Headers Required:**

1. **Cookie** - Session cookies from DKB webapp
   - Example: `_SI_VID_1.a3b974920e00011b510a49bb=d2c284950b656d2c00ecc5ab; wtstp_eid=2176876632097778123; UC_NT=false; ...`
   - Contains multiple session identifiers

2. **x-xsrf-token** - CSRF token from DKB webapp
   - Example: `df9888bb-ec06-...`
   - Protects against cross-site request forgery

**User Setup:**
1. Open DKB webapp in browser and log in
2. Open DevTools (F12) → Network tab
3. Make any API call (fetch accounts, transactions, etc.)
4. Copy the `Cookie` header value
5. Copy the `x-xsrf-token` header value
6. Paste both into `banking.config.json` (see example below)

**Config Format:**

```json
{
  "dkb": {
    "cookie": "_SI_VID_1.a3b974920e00011b510a49bb=d2c284950b656d2c00ecc5ab; wtstp_eid=2176876632097778123; ...",
    "xsrfToken": "df9888bb-ec06-..."
  }
}
```

**Session Expiry:** These credentials expire when DKB session expires (typically 15-30 minutes of inactivity). User will need to refresh them periodically.

---

## Endpoints

### 1. Accounts List

**Endpoint:** `GET /accounts/accounts?filter[product.type][NEQ]=loan`

**Description:** Fetch all accounts for the user, excluding loans.

**Query Parameters:**
- `filter[product.type][NEQ]=loan` - Exclude loan products

**Response Schema:**

```json
{
  "data": [
    {
      "type": "account",
      "id": "string (UUID)",
      "attributes": {
        "holderName": "string",
        "iban": "string",
        "permissions": ["string"],
        "currencyCode": "string (EUR)",
        "balance": {
          "currencyCode": "string",
          "value": "string (decimal as string)"
        },
        "availableBalance": {
          "currencyCode": "string",
          "value": "string (decimal as string)"
        },
        "nearTimeBalance": {
          "currencyCode": "string",
          "value": "string (decimal as string)"
        },
        "product": {
          "id": "string",
          "type": "string (e.g. checking-account-private, savings-account)",
          "displayName": "string"
        },
        "state": "string (e.g. active)",
        "updatedAt": "string (date YYYY-MM-DD)",
        "openingDate": "string (date YYYY-MM-DD)",
        "overdraftLimit": "string (decimal as string)",
        "interestRate": "string (decimal as string)",
        "unauthorizedOverdraftInterestRate": "string (decimal as string)",
        "lastAccountStatementDate": "string (date)",
        "interests": [
          {
            "type": "string (credit, debit, overdraft)",
            "method": "string",
            "details": [
              {
                "interestRate": "string",
                "condition": {
                  "currency": "string",
                  "minimumAmount": "string"
                }
              }
            ]
          }
        ],
        "referenceAccount": {
          "iban": "string",
          "accountNumber": "string",
          "blz": "string"
        }
      }
    }
  ],
  "included": []
}
```

**Sample Response:** See `samples/dkb-accounts-response.json`

---

### 2. Transactions for Account

**Endpoint:** `GET /accounts/accounts/{accountId}/transactions?expand=Merchant&page[size]=25`

**Description:** Fetch transactions for a specific account with pagination.

**Path Parameters:**
- `accountId` - UUID from account list (e.g., `d5565bbe-5dea-4cc2-b2ac-459ddc675bf0`)

**Query Parameters:**
- `expand=Merchant` - Include merchant information in response
- `page[size]=25` - Items per page (default/recommended: 25)
- `page[after]=<cursor>` - Pagination cursor from previous response (optional, for fetching next page)

**Pagination:**
- Response includes `meta.page.next` with cursor value
- Use `page[after]=<cursor>` to fetch next page
- Cursor format: `YYYY-MM-DD,YYYY-MM-DD-HH.MM.SS.milliseconds`
- Iterate until `meta.page.next` is absent

**Response Schema:**

```json
{
  "data": [
    {
      "type": "accountTransaction",
      "id": "string (timestamp-based: YYYY-MM-DD-HH.MM.SS.milliseconds)",
      "attributes": {
        "status": "string (booked, pending)",
        "bookingDate": "string (date YYYY-MM-DD)",
        "valueDate": "string (date YYYY-MM-DD)",
        "description": "string",
        "endToEndId": "string (optional)",
        "transactionType": "string (e.g. KARTENZAHLUNG, UEBERWEISUNG)",
        "transactionTypeCode": "string (numeric)",
        "purposeCode": "string (optional)",
        "businessTransactionCode": "string (optional)",
        "amount": {
          "currencyCode": "string (EUR)",
          "value": "string (decimal as string, negative = expense)"
        },
        "creditor": {
          "name": "string",
          "creditorAccount": {
            "accountNr": "string",
            "blz": "string",
            "iban": "string"
          },
          "agent": {
            "bic": "string"
          },
          "intermediaryName": "string (optional)"
        },
        "debtor": {
          "name": "string",
          "debtorAccount": {
            "accountNr": "string",
            "blz": "string",
            "iban": "string"
          },
          "agent": {
            "bic": "string"
          }
        },
        "isRevocable": "boolean",
        "merchant": {
          "name": "string",
          "category": {
            "name": "string (e.g. Sonstige, Groceries)",
            "imageUrl": "string (URL)",
            "subCategories": ["string"]
          },
          "logo": {
            "url": "string (URL)",
            "score": "number"
          }
        }
      }
    }
  ],
  "meta": {
    "page": {
      "next": "string (cursor for next page, absent if last page)"
    }
  },
  "links": {
    "next": "string (full relative path for next page, absent if last page)"
  },
  "included": []
}
```

**Sample Response:** See `samples/dkb-transactions-response.json`

**Pagination Example:**

```
Page 1: GET /accounts/accounts/{id}/transactions?expand=Merchant&page[size]=25
        Returns meta.page.next = "2026-01-02,2026-01-02-00.43.31.907064"

Page 2: GET /accounts/accounts/{id}/transactions?expand=Merchant&page[size]=25&page[after]=2026-01-02,2026-01-02-00.43.31.907064
        Returns next page of transactions

Continue until meta.page.next is absent
```

---

## Data Type Notes

- **Amounts:** Provided as strings (e.g., `"-55.00"`), need to be parsed to `number` for calculations
- **Dates:** ISO format `YYYY-MM-DD` (bookingDate, valueDate, updatedAt, openingDate)
- **IDs:**
  - Account ID: UUID (e.g., `d5565bbe-5dea-4cc2-b2ac-459ddc675bf0`)
  - Transaction ID: Timestamp-based (e.g., `2026-01-23-09.45.00.996574`)
- **Product Types:** `checking-account-private`, `savings-account`, etc.
- **Transaction Status:** `booked`, `pending`

---

## Implementation Notes

1. **Fetching all transactions:** Start without `page[after]`, then loop using the cursor until no `next` is present
2. **Balance snapshot:** Store the current `balance.value` from accounts endpoint with a timestamp on each sync
3. **Deduplication:** Use transaction `id` field (which is timestamp-based) to detect duplicates across syncs
4. **Direction inference:** Check `amount.value` sign:
   - Negative value = debit (expense)
   - Positive value = credit (income)
5. **Counterparty:** For expenses, use `creditor.name`; for income, use `debtor.name`
6. **Date for grouping:** Use `bookingDate` for analytics/aggregations
