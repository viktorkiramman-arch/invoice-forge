import { getCurrencyScale } from "@invoice-forge/domain";

export function formatMoney(value: string | number, currency: string): string {
  const raw = String(value);
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return `${currency} ${raw}`;

  const scale = getCurrencyScale(currency);
  const [integer = "0", rawFraction = ""] = raw.split(".");
  const fraction = rawFraction.padEnd(scale, "0").slice(0, scale);

  try {
    const number = new Intl.NumberFormat(undefined, {
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(BigInt(integer));
    const currencyParts = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: scale,
      maximumFractionDigits: scale,
    }).formatToParts(0);
    const symbol = currencyParts.find((part) => part.type === "currency")?.value ?? currency;
    const decimal = currencyParts.find((part) => part.type === "decimal")?.value ?? ".";
    const amount = scale ? `${number}${decimal}${fraction}` : number;
    const currencyBeforeAmount =
      currencyParts.findIndex((part) => part.type === "currency") <
      currencyParts.findIndex((part) => part.type === "integer");
    return currencyBeforeAmount ? `${symbol}${amount}` : `${amount}\u00A0${symbol}`;
  } catch {
    return `${currency} ${integer}${scale ? `.${fraction}` : ""}`;
  }
}
