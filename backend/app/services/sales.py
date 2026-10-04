from decimal import Decimal, ROUND_HALF_UP

CENT = Decimal("0.01")


def money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_totals(subtotal: Decimal, discount: Decimal, tax_rate: Decimal) -> tuple[Decimal, Decimal, Decimal]:
    if discount < 0 or discount > subtotal:
        raise ValueError("El descuento debe estar entre cero y el subtotal.")
    taxable = money(subtotal - discount)
    tax = money(taxable * tax_rate)
    return money(subtotal), tax, money(taxable + tax)
