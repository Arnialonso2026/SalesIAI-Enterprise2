from decimal import Decimal

import pytest

from app.services.sales import calculate_totals, money


def test_calculate_totals_applies_discount_before_tax() -> None:
    subtotal, tax, total = calculate_totals(Decimal("100.00"), Decimal("10.00"), Decimal("0.18"))
    assert subtotal == Decimal("100.00")
    assert tax == Decimal("16.20")
    assert total == Decimal("106.20")


def test_calculate_totals_rejects_discount_above_subtotal() -> None:
    with pytest.raises(ValueError, match="descuento"):
        calculate_totals(Decimal("20.00"), Decimal("21.00"), Decimal("0.18"))


def test_money_uses_two_decimal_places() -> None:
    assert money(Decimal("1.005")) == Decimal("1.01")
