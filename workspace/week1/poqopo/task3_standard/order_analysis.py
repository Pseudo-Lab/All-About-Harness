#!/usr/bin/env python3
"""CSV 주문 데이터를 검증하고 매출을 집계한다."""

from __future__ import annotations

import argparse
import csv
from collections import defaultdict
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path


@dataclass
class InvalidRecord:
    line: int
    order_id: str
    field: str
    value: str
    reason: str


def parse_decimal(value: str, field: str, line: int, order_id: str, errors: list[InvalidRecord]) -> Decimal | None:
    try:
        number = Decimal(value)
    except (InvalidOperation, ValueError):
        errors.append(InvalidRecord(line, order_id, field, value, "숫자가 아님"))
        return None
    if number < 0 or (field == "quantity" and number != number.to_integral_value()):
        errors.append(InvalidRecord(line, order_id, field, value, "음수 또는 정수가 아닌 수량"))
        return None
    if field == "quantity" and number <= 0:
        errors.append(InvalidRecord(line, order_id, field, value, "수량은 0보다 커야 함"))
        return None
    return number


def parse_date(value: str, line: int, order_id: str, errors: list[InvalidRecord]) -> date | None:
    try:
        return date.fromisoformat(value)
    except ValueError:
        errors.append(InvalidRecord(line, order_id, "date", value, "YYYY-MM-DD 형식이 아님"))
        return None


def analyze_orders(csv_path: str | Path) -> tuple[dict[str, Decimal], str | None, list[InvalidRecord]]:
    category_sales: defaultdict[str, Decimal] = defaultdict(Decimal)
    customer_sales: defaultdict[str, Decimal] = defaultdict(Decimal)
    errors: list[InvalidRecord] = []
    seen_order_ids: set[str] = set()

    with open(csv_path, newline="", encoding="utf-8-sig") as file:
        reader = csv.DictReader(file)
        required = {"order_id", "customer", "category", "price", "quantity", "status", "date"}
        if not required.issubset(reader.fieldnames or []):
            raise ValueError(f"필수 컬럼이 없습니다: {sorted(required - set(reader.fieldnames or []))}")

        for line, row in enumerate(reader, start=2):
            order_id = (row.get("order_id") or "").strip()
            if order_id in seen_order_ids:
                continue
            seen_order_ids.add(order_id)

            if (row.get("status") or "").strip() == "취소":
                continue

            price = parse_decimal(row.get("price", ""), "price", line, order_id, errors)
            quantity = parse_decimal(row.get("quantity", ""), "quantity", line, order_id, errors)
            order_date = parse_date(row.get("date", ""), line, order_id, errors)
            if price is None or quantity is None or order_date is None:
                continue

            sales = price * quantity
            category = (row.get("category") or "").strip()
            customer = (row.get("customer") or "").strip()
            category_sales[category] += sales
            customer_sales[customer] += sales

    top_customer = max(customer_sales, key=customer_sales.get) if customer_sales else None
    return dict(category_sales), top_customer, errors


def format_won(amount: Decimal) -> str:
    return f"{amount:,.0f}원"


def main() -> None:
    parser = argparse.ArgumentParser(description="주문 CSV 매출 분석")
    parser.add_argument("csv_path", help="분석할 CSV 파일")
    parser.add_argument("--error-log", default="invalid_records.csv", help="오류 기록 CSV 경로")
    args = parser.parse_args()

    category_sales, top_customer, errors = analyze_orders(args.csv_path)
    print("[카테고리별 총매출]")
    for category, amount in sorted(category_sales.items()):
        print(f"{category}: {format_won(amount)}")
    print("[최고 매출 고객]")
    print(f"{top_customer or '없음'}")

    with open(args.error_log, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["line", "order_id", "field", "value", "reason"])
        writer.writerows((e.line, e.order_id, e.field, e.value, e.reason) for e in errors)
    print(f"[오류 기록] {args.error_log}: {len(errors)}건")


if __name__ == "__main__":
    main()
