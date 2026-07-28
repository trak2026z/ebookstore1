import type { PublicBookPrice } from "@ebookstore/contracts";

const PRICE_LOCALE = "pl-PL";

export function formatPrice({ amountMinor, currency }: PublicBookPrice): string {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new RangeError("Price amountMinor must be a non-negative safe integer.");
  }

  const currencyFormatter = new Intl.NumberFormat(PRICE_LOCALE, {
    style: "currency",
    currency,
  });
  const fractionDigits = currencyFormatter.resolvedOptions().maximumFractionDigits ?? 2;
  const scale = 10n ** BigInt(fractionDigits);
  const amount = BigInt(amountMinor);
  const majorUnits = amount / scale;
  const minorUnits = (amount % scale).toString().padStart(fractionDigits, "0");
  const formattedMajorUnits = new Intl.NumberFormat(PRICE_LOCALE, {
    maximumFractionDigits: 0,
  }).format(Number(majorUnits));

  return currencyFormatter
    .formatToParts(0)
    .map((part) => {
      if (part.type === "integer") {
        return formattedMajorUnits;
      }

      if (part.type === "fraction") {
        return minorUnits;
      }

      return part.value;
    })
    .join("");
}
