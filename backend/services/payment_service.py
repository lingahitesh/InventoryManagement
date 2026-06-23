from fastapi import HTTPException
from backend.database.db import get_db


def get_payments(customer_id=None, date_from=None, date_to=None, amt_min=None, amt_max=None):
    """Returns payments with customer name, amt_paid, payment_date, and running amt_due per customer."""
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT p.payment_id,
               p.customer_id,
               c.fname || ' ' || NVL(c.mname || ' ', '') || c.lname AS customer_name,
               p.order_id,
               p.amt_paid,
               p.payment_date,
               p.notes
        FROM payments p
        JOIN customers c ON c.customer_id = p.customer_id
        WHERE 1=1
    """
    params = []
    if customer_id:
        query += f" AND p.customer_id = :{len(params)+1}"
        params.append(customer_id)
    if date_from:
        query += f" AND p.payment_date >= :{len(params)+1}"
        params.append(date_from)
    if date_to:
        query += f" AND p.payment_date < :{len(params)+1}"
        from datetime import datetime, timedelta
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            params.append(dt)
        except:
            params.append(date_to)
    if amt_min is not None:
        query += f" AND p.amt_paid >= :{len(params)+1}"
        params.append(amt_min)
    if amt_max is not None:
        query += f" AND p.amt_paid <= :{len(params)+1}"
        params.append(amt_max)
    query += " ORDER BY p.payment_date DESC, p.payment_id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["payment_id", "customer_id", "customer_name", "order_id",
            "amt_paid", "payment_date", "notes"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["payment_id"] is not None: d["payment_id"] = int(d["payment_id"])
        if d["customer_id"] is not None: d["customer_id"] = int(d["customer_id"])
        if d["order_id"] is not None: d["order_id"] = int(d["order_id"])
        if d["amt_paid"] is not None: d["amt_paid"] = float(d["amt_paid"])
        if d["payment_date"] and hasattr(d["payment_date"], "isoformat"):
            d["payment_date"] = d["payment_date"].isoformat()[:10]
        result.append(d)
    return result


def get_customer_balance(customer_id):
    """
    Returns total_billed (sum of order totals with GST) and total_paid (sum of all payments).
    amt_due = total_billed - total_paid
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT NVL(SUM((o.total_amount + NVL(o.delivery_charge, 0)) * 1.18), 0)
        FROM orders o WHERE o.customer_id = :1
    """, [customer_id])
    total_billed = float(cursor.fetchone()[0] or 0)
    cursor.execute("""
        SELECT NVL(SUM(p.amt_paid), 0) FROM payments p WHERE p.customer_id = :1
    """, [customer_id])
    total_paid = float(cursor.fetchone()[0] or 0)
    cursor.close()
    conn.close()
    return {
        "customer_id": customer_id,
        "total_billed": round(total_billed, 2),
        "total_paid": round(total_paid, 2),
        "amt_due": round(total_billed - total_paid, 2)
    }


def add_payment(customer_id, amt_paid, payment_date, order_id=None, notes=None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO payments (customer_id, order_id, amt_paid, payment_date, notes)
        VALUES (:1, :2, :3, :4, :5)
    """, [customer_id, order_id, amt_paid, payment_date, notes])
    conn.commit()
    cursor.close()
    conn.close()


def update_payment(payment_id, amt_paid, payment_date, order_id=None, notes=None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE payments
        SET amt_paid = :1, payment_date = :2, order_id = :3, notes = :4
        WHERE payment_id = :5
    """, [amt_paid, payment_date, order_id, notes, payment_id])
    rows = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows


def delete_payment(payment_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM payments WHERE payment_id = :1", [payment_id])
    rows = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows
