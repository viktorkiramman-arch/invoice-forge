import { formatMoney } from "../lib/format";

export function Money({ value, currency }: { value: string | number; currency: string }) {
  return <>{formatMoney(value, currency)}</>;
}
