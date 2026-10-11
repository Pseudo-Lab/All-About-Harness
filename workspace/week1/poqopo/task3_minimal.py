import csv
import sys
from collections import defaultdict
from datetime import date
from decimal import Decimal, InvalidOperation


def analyze_orders(filename):
    category_sales = defaultdict(Decimal)
    customer_sales = defaultdict(Decimal)
    errors = []
    seen_order_ids = set()

    with open(filename, encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)

        for line_no, row in enumerate(reader, start=2):
            order_id = row["order_id"]

            if order_id in seen_order_ids:
                continue
            seen_order_ids.add(order_id)

            try:
                price = Decimal(row["price"])
                if price < 0:
                    raise ValueError
            except (InvalidOperation, ValueError):
                errors.append((line_no, order_id, "잘못된 금액"))
                continue

            try:
                quantity = int(row["quantity"])
                if quantity < 0:
                    raise ValueError
            except ValueError:
                errors.append((line_no, order_id, "잘못된 수량"))
                continue

            try:
                date.fromisoformat(row["date"])
            except ValueError:
                errors.append((line_no, order_id, "잘못된 날짜"))
                continue

            if row["status"] == "취소":
                continue

            sales = price * quantity
            category_sales[row["category"]] += sales
            customer_sales[row["customer"]] += sales

    top_customer = max(
        customer_sales.items(),
        key=lambda item: item[1],
        default=(None, Decimal("0"))
    )

    return category_sales, top_customer, errors


if __name__ == "__main__":
    categories, top_customer, errors = analyze_orders(sys.argv[1])

    print("[카테고리별 총매출]")
    for category, total in categories.items():
        print(f"{category}: {total:,.0f}원")

    print("\n[최고 매출 고객]")
    print(f"{top_customer[0]}: {top_customer[1]:,.0f}원")

    print("\n[오류 기록]")
    for line_no, order_id, reason in errors:
        print(f"{line_no}행 {order_id}: {reason}")
