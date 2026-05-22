export type Currency = "XOF" | "USD" | "EUR" | "GBP";

export const SUPPORTED_CURRENCIES: Currency[] = ["XOF", "USD", "EUR", "GBP"];

export const EXCHANGE_RATES: Record<Currency, number> = {
  XOF: 1,
  USD: 600,
  EUR: 655.957,
  GBP: 760,
};

/**
 * Converts a monetary value from a source currency to a target currency.
 * Baseline currency is XOF (FCFA).
 */
export function convertCurrency(
  value: number,
  source: string = "XOF",
  target: string = "XOF"
): number {
  const cleanSource = (source || "XOF").toUpperCase() as Currency;
  const cleanTarget = (target || "XOF").toUpperCase() as Currency;

  if (cleanSource === cleanTarget) return value;

  const sourceRate = EXCHANGE_RATES[cleanSource] || 1;
  const targetRate = EXCHANGE_RATES[cleanTarget] || 1;

  // Convert to XOF first (value * sourceRate XOF per source unit)
  const valueInXOF = value * sourceRate;

  // Convert from XOF to target (valueInXOF / targetRate XOF per target unit)
  return valueInXOF / targetRate;
}
