from backend.database.db import get_db
from datetime import datetime, timedelta


def get_dashboard_data() -> dict:
    """
    Returns aggregated dashboard metrics from the Oracle database.
    All monetary values include 18% GST where applicable.
    """
    conn = get_db()
    cursor = conn.cursor()

    data = {
        "inventory_value": 0,
        "orders_today": 0,
        "dispatches_pending": 0,
        "revenue_this_month": 0,
        "outstanding": 0,
        "active_customers": 0,
        "revenue_chart": [],
    }

    try:
        # 1. inventory_value
        #    For each inventory item: sku_quantity * sku_units * last_selling_price_or_cost_price
        #    "last selling price" = most recent selling_price from order_items for the same
        #    sku_type + sku_subtype group. If none exists, fallback to sku_cost_price.
        try:
            cursor.execute("""
                SELECT NVL(SUM(i.sku_quantity * i.sku_units *
                    NVL(
                        (SELECT oi.selling_price
                         FROM order_items oi
                         JOIN inventory i2 ON i2.sku_id = oi.sku_id
                         JOIN orders o ON o.order_id = oi.order_id
                         WHERE i2.sku_type = i.sku_type
                           AND i2.sku_subtype = i.sku_subtype
                         ORDER BY o.order_date DESC
                         FETCH FIRST 1 ROW ONLY),
                        i.sku_cost_price
                    )
                ), 0)
                FROM inventory i
                WHERE i.sku_units > 0
            """)
            row = cursor.fetchone()
            data["inventory_value"] = round(float(row[0]), 2) if row and row[0] else 0
        except Exception:
            data["inventory_value"] = 0

        # 2. orders_today
        try:
            cursor.execute("""
                SELECT COUNT(*) FROM orders
                WHERE TRUNC(order_date) = TRUNC(SYSDATE)
            """)
            row = cursor.fetchone()
            data["orders_today"] = int(row[0]) if row else 0
        except Exception:
            data["orders_today"] = 0

        # 3. dispatches_pending
        #    Orders where ALL items have is_ready=1, but not fully dispatched yet
        #    (dispatched units < total units)
        try:
            cursor.execute("""
                SELECT COUNT(*)
                FROM orders o
                WHERE NOT EXISTS (
                    SELECT 1 FROM order_items oi
                    WHERE oi.order_id = o.order_id AND NVL(oi.is_ready, 0) = 0
                )
                AND EXISTS (
                    SELECT 1 FROM order_items oi2
                    WHERE oi2.order_id = o.order_id
                )
                AND NVL((SELECT SUM(di.units_dispatched) FROM dispatch_items di WHERE di.order_id = o.order_id), 0) < o.total_units
            """)
            row = cursor.fetchone()
            data["dispatches_pending"] = int(row[0]) if row else 0
        except Exception:
            data["dispatches_pending"] = 0

        # 4. revenue_this_month
        #    Sum of (total_amount + delivery_charge) * 1.18 for orders in the current month
        try:
            cursor.execute("""
                SELECT NVL(SUM((NVL(total_amount, 0) + NVL(delivery_charge, 0)) * 1.18), 0)
                FROM orders
                WHERE TRUNC(order_date, 'MM') = TRUNC(SYSDATE, 'MM')
            """)
            row = cursor.fetchone()
            data["revenue_this_month"] = round(float(row[0]), 2) if row and row[0] else 0
        except Exception:
            data["revenue_this_month"] = 0

        # 5. outstanding
        #    Total billed (all orders) - Total paid (all payments)
        try:
            cursor.execute("""
                SELECT
                    NVL((SELECT SUM((NVL(total_amount, 0) + NVL(delivery_charge, 0)) * 1.18) FROM orders), 0)
                    -
                    NVL((SELECT SUM(amt_paid) FROM payments), 0)
                FROM dual
            """)
            row = cursor.fetchone()
            data["outstanding"] = round(float(row[0]), 2) if row and row[0] else 0
        except Exception:
            data["outstanding"] = 0

        # 6. active_customers
        #    Distinct customers who placed an order in the last 3 months
        try:
            cursor.execute("""
                SELECT COUNT(DISTINCT customer_id)
                FROM orders
                WHERE order_date >= ADD_MONTHS(SYSDATE, -3)
            """)
            row = cursor.fetchone()
            data["active_customers"] = int(row[0]) if row else 0
        except Exception:
            data["active_customers"] = 0

        # 7. revenue_chart
        #    Last 30 days, revenue per day = sum of (total_amount + delivery_charge) * 1.18
        #    Include days with 0 revenue.
        try:
            cursor.execute("""
                SELECT d.day_date,
                       NVL(SUM((NVL(o.total_amount, 0) + NVL(o.delivery_charge, 0)) * 1.18), 0) AS revenue
                FROM (
                    SELECT TRUNC(SYSDATE) - LEVEL + 1 AS day_date
                    FROM dual
                    CONNECT BY LEVEL <= 30
                ) d
                LEFT JOIN orders o ON TRUNC(o.order_date) = d.day_date
                GROUP BY d.day_date
                ORDER BY d.day_date ASC
            """)
            rows = cursor.fetchall()
            chart = []
            for row in rows:
                day_date = row[0]
                revenue = round(float(row[1]), 2) if row[1] else 0
                date_str = day_date.strftime("%Y-%m-%d") if hasattr(day_date, "strftime") else str(day_date)
                chart.append({"date": date_str, "revenue": revenue})
            data["revenue_chart"] = chart
        except Exception:
            # Fallback: generate 30 days with 0
            today = datetime.now().date()
            data["revenue_chart"] = [
                {"date": (today - timedelta(days=29 - i)).strftime("%Y-%m-%d"), "revenue": 0}
                for i in range(30)
            ]

    except Exception:
        pass
    finally:
        cursor.close()
        conn.close()

    return data
