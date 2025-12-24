"""Basic data validation utilities for collected feeds."""
from typing import Iterable, Dict, Any


def require_fields(records: Iterable[Dict[str, Any]], fields) -> None:
    for rec in records:
        missing = [f for f in fields if f not in rec or rec[f] is None]
        if missing:
            raise ValueError(f"record missing fields {missing}: {rec}")


def assert_non_negative(records: Iterable[Dict[str, Any]], field: str) -> None:
    for rec in records:
        if rec.get(field, 0) < 0:
            raise ValueError(f"negative {field}: {rec}")


def validate_prices(records: Iterable[Dict[str, Any]]) -> None:
    require_fields(records, ["price", "timestamp"])
    assert_non_negative(records, "price")


def validate_attestations(records: Iterable[Dict[str, Any]]) -> None:
    require_fields(records, ["requestId", "timestamp", "merkleRoot"])


def validate_redemptions(records: Iterable[Dict[str, Any]]) -> None:
    require_fields(records, ["user", "amount", "redemptionId"])
    assert_non_negative(records, "amount")
