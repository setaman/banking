/**
 * Shared de-DE / EUR number formatting helpers.
 *
 * Intl instances are created once at module level and reused, which is
 * considerably cheaper than constructing a new `Intl.NumberFormat` per call.
 */

const LOCALE = "de-DE";

const currencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const signedCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  signDisplay: "always",
});

const wholeCurrencyFormatter = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formats a number as EUR with exactly two fraction digits (e.g. `1.234,50 €`).
 *
 * @param n - Amount in euros.
 * @returns The de-DE formatted currency string.
 */
export function formatCurrency(n: number): string {
  return currencyFormatter.format(n);
}

/**
 * Formats a number as EUR with an explicit sign for every value, including
 * positive ones and zero (e.g. `+1.234,50 €`).
 *
 * @param n - Amount in euros.
 * @returns The de-DE formatted, signed currency string.
 */
export function formatCurrencySigned(n: number): string {
  return signedCurrencyFormatter.format(n);
}

/**
 * Formats a number as EUR without fraction digits (e.g. `1.235 €`).
 *
 * @param n - Amount in euros.
 * @returns The de-DE formatted whole-euro currency string.
 */
export function formatCurrencyWhole(n: number): string {
  return wholeCurrencyFormatter.format(n);
}

/**
 * Compact euro label for chart axes: `€1.2k` for magnitudes of 1000 or more,
 * otherwise a rounded whole value such as `€950`.
 *
 * @param n - Amount in euros.
 * @returns The compact label.
 */
export function formatCurrencyCompact(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `€${(n / 1000).toFixed(1)}k`;
  }
  return `€${n.toFixed(0)}`;
}

/**
 * Formats a percentage with one decimal place (e.g. `12.3%`).
 *
 * @param n - Percentage value (already multiplied by 100).
 * @param opts - Set `sign` to prefix positive values with `+`.
 * @returns The formatted percentage string.
 */
export function formatPercent(n: number, opts?: { sign?: boolean }): string {
  const sign = opts?.sign && n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}
