# Calculation specification

## Representation

- API monetary values are decimal strings.
- The domain package uses `Decimal` values with precision 40.
- Quantity, unit price, rates, and discounts accept up to four decimal places.
- Calculated money is rounded to the invoice currency scale using half-up rounding.
- USD, EUR, and GBP use two decimals; JPY uses zero; KWD uses three.

## Order of operations

1. `line base = quantity × unit price`
2. Apply line discount.
3. Sum discounted lines.
4. Calculate the invoice discount.
5. Allocate invoice discount proportionally across discounted lines.
6. Calculate tax on the discounted, allocated line amount.
7. Sum line and invoice results.

## Exclusive tax

```text
tax = taxable amount × rate / 100
line total = taxable amount + tax
```

## Inclusive tax

```text
tax = gross amount − gross amount / (1 + rate / 100)
line total = gross amount
```

## Discount allocation

Each line receives its raw proportional share. Shares are rounded down to the currency scale, then remaining minor units are assigned in descending fractional-remainder order. Ties use line order. This guarantees deterministic allocation and exact reconciliation.

## Invariants

- Quantity must be greater than zero.
- Prices cannot be negative.
- Tax rates cannot exceed 100%.
- Discounts cannot exceed their applicable amount.
- Grand total cannot be negative.
- Allocated invoice discounts must equal the invoice discount.
- Tax components must sum to tax total.
- Inclusive tax does not increase the gross total.

## Calculation version

Finalized invoices store `calculationVersion: 1.0.0` and a complete calculation snapshot. Future formula changes must introduce a new version rather than rewriting old snapshots.
