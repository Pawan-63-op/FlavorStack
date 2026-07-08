export interface Money {
  amount: number | null | undefined;
  currency: string | null | undefined;
}

const DEFAULT_CURRENCY = "USD";
const FALLBACK_DISPLAY = "—";

export function formatMoney(
  money: Money | null | undefined,
  locale = "en-US",
): string {
  if (!money || money.amount === null || money.amount === undefined) {
    return FALLBACK_DISPLAY;
  }

  const currency = money.currency || DEFAULT_CURRENCY;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(money.amount);
  } catch {
    return `${currency} ${money.amount.toFixed(2)}`;
  }
}
