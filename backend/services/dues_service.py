"""
Payment Dues Service — SRTF (Shortest Remaining Time First) approach.

For each customer:
1. Get all dispatched orders with their total amount (incl GST) and due dates
2. Get all payments made by the customer
3. Allocate payments to orders using SRTF:
   - Sort outstanding orders by due date (earliest first)
   - If due dates are same, pay off the largest principal first (minimizes compound interest)
4. Calculate interest at 9% p.a. compounded daily for overdue amounts
"""
from datetime import datetime, date
from backend.database.db import get_db
from fastapi import HTTPException

ANNUAL_RATE = 0.09  # 9% p.a.


def _daily_rate():
    return ANNUAL_RATE / 365


def _compound_interest(principal, days_overdue):
    """Calculate compound interest for given principal and overdue days."""
    if days_overdue <= 0 or principal <= 0:
        return 0.0
    daily_r = _daily_rate()
    amount = principal * ((1 + daily_r) ** days_overdue)
    return round(amount - principal, 2)


def get_customer_dues_summary():
    """Get all customers who have an outstanding amount due."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Get all customers with orders that have payment terms
        cursor.execute("""
            SELECT c.customer_id,
                   c.fname || ' ' || NVL(c.mname || ' ', '') || c.lname AS customer_name
            FROM customers c
            WHERE EXISTS (
                SELECT 1 FROM orders o
                WHERE o.customer_id = c.customer_id
                  AND o.terms_of_payment IS NOT NULL
            )
            ORDER BY c.fname, c.lname
        """)
        customers = [{"customer_id": int(r[0]), "customer_name": r[1]} for r in cursor.fetchall()]

        result = []
        today = date.today()

        for cust in customers:
            cid = cust["customer_id"]
            orders_due = _get_order_dues(cursor, cid, today)
            total_payments = _get_total_payments(cursor, cid)

            # Allocate payments using SRTF
            allocated = _allocate_payments_srtf(orders_due, total_payments, today)

            # Sum remaining dues + interest
            total_remaining = sum(o["remaining"] for o in allocated)
            total_interest = sum(o["interest"] for o in allocated)

            if total_remaining > 0.01:  # Only show if there's something due
                result.append({
                    "customer_id": cid,
                    "customer_name": cust["customer_name"],
                    "total_due": round(total_remaining, 2),
                    "total_interest": round(total_interest, 2),
                    "total_with_interest": round(total_remaining + total_interest, 2),
                })

        return result
    finally:
        cursor.close()
        conn.close()


def get_customer_dues_detail(customer_id):
    """Get detailed order-level breakdown for a specific customer."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        today = date.today()
        orders_due = _get_order_dues(cursor, customer_id, today)
        total_payments = _get_total_payments(cursor, customer_id)

        allocated = _allocate_payments_srtf(orders_due, total_payments, today)

        # Only return orders with remaining balance
        details = []
        for o in allocated:
            if o["remaining"] > 0.01:
                details.append({
                    "order_id": o["order_id"],
                    "order_amount": o["order_amount"],
                    "due_date": o["due_date"].isoformat() if o["due_date"] else None,
                    "days_overdue": o["days_overdue"],
                    "remaining": round(o["remaining"], 2),
                    "interest": round(o["interest"], 2),
                    "total_with_interest": round(o["remaining"] + o["interest"], 2),
                    "is_overdue": o["days_overdue"] > 0,
                    "items": o.get("items", []),
                })
        return details
    finally:
        cursor.close()
        conn.close()


def get_order_items_breakdown(order_id):
    """Get item-level breakdown for a specific order."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT oi.item_id, i.sku_type, i.sku_subtype, i.sku_dim,
                   oi.units, oi.sku_quantity, oi.selling_price,
                   (oi.units * NVL(oi.sku_quantity, 1) * oi.selling_price) AS line_total
            FROM order_items oi
            JOIN inventory i ON i.sku_id = oi.sku_id
            WHERE oi.order_id = :1
        """, [order_id])
        rows = cursor.fetchall()
        items = []
        for r in rows:
            items.append({
                "item_id": int(r[0]),
                "sku_type": r[1],
                "sku_subtype": r[2],
                "sku_dim": r[3],
                "units": int(r[4]) if r[4] else 0,
                "qty_kg": float(r[5]) if r[5] else 0,
                "price": float(r[6]) if r[6] else 0,
                "line_total": round(float(r[7]), 2) if r[7] else 0,
            })
        return items
    finally:
        cursor.close()
        conn.close()


def _get_order_dues(cursor, customer_id, today):
    """
    Get all dispatched orders for a customer with their total amount and due date.
    Due date = order_date + payment_mode (days stored on orders table).
    """
    cursor.execute("""
        SELECT o.order_id,
               (o.total_amount + NVL(o.delivery_charge, 0)) * 1.18 AS order_total,
               o.order_date,
               o.terms_of_payment AS payment_terms_days
        FROM orders o
        WHERE o.customer_id = :1
          AND o.terms_of_payment IS NOT NULL
        ORDER BY o.order_date + o.terms_of_payment
    """, [customer_id])
    rows = cursor.fetchall()

    orders = []
    for r in rows:
        order_id = int(r[0])
        order_total = float(r[1]) if r[1] else 0
        order_date = r[2]  # datetime object
        payment_days = int(r[3]) if r[3] else 0

        if order_date and payment_days:
            from datetime import timedelta
            due_dt = order_date + timedelta(days=payment_days)
            if isinstance(due_dt, datetime):
                due_dt = due_dt.date()
            days_overdue = (today - due_dt).days
        else:
            due_dt = None
            days_overdue = 0

        orders.append({
            "order_id": order_id,
            "order_amount": round(order_total, 2),
            "due_date": due_dt,
            "days_overdue": max(0, days_overdue),
        })

    return orders


def _get_total_payments(cursor, customer_id):
    """Get total payments made by a customer."""
    cursor.execute("SELECT NVL(SUM(amt_paid), 0) FROM payments WHERE customer_id = :1", [customer_id])
    return float(cursor.fetchone()[0])


def _allocate_payments_srtf(orders, total_payment, today):
    """
    Allocate payment to orders using SRTF:
    - Sort by due_date ascending (earliest first)
    - If due dates are same, sort by largest principal first (minimizes compound interest)
    - Deduct payment fully from each order before moving to next
    """
    # Sort: primary by due_date (earliest first), secondary by order_amount desc (largest first for same due date)
    sorted_orders = sorted(orders, key=lambda o: (o["due_date"] or date.max, -o["order_amount"]))

    remaining_payment = total_payment
    result = []

    for o in sorted_orders:
        principal = o["order_amount"]
        if remaining_payment >= principal:
            remaining_payment -= principal
            remaining = 0.0
        else:
            remaining = principal - remaining_payment
            remaining_payment = 0.0

        interest = _compound_interest(remaining, o["days_overdue"])

        result.append({
            **o,
            "remaining": remaining,
            "interest": interest,
        })

    return result
