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
        "trending_products": [],
        "price_chart": [],
        "stock_pie": [],
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

        # 7. Combined chart: revenue + expense (30 days) and profit/loss (60 days)
        try:
            cursor.execute("""
                SELECT d.day_date,
                       NVL(SUM((NVL(o.total_amount,0)+NVL(o.delivery_charge,0))*1.18),0) AS revenue,
                       NVL(SUM(exp.day_expense),0) AS expense,
                       NVL(SUM(pft.day_profit),0)  AS profit
                FROM (
                    SELECT TRUNC(SYSDATE) - LEVEL + 1 AS day_date
                    FROM dual CONNECT BY LEVEL <= 60
                ) d
                LEFT JOIN orders o ON TRUNC(o.order_date) = d.day_date
                LEFT JOIN (
                    SELECT oi.order_id,
                           SUM(oi.units * oi.sku_quantity * i.sku_cost_price) AS day_expense
                    FROM order_items oi JOIN inventory i ON i.sku_id = oi.sku_id
                    GROUP BY oi.order_id
                ) exp ON exp.order_id = o.order_id
                LEFT JOIN (
                    SELECT oi.order_id,
                           SUM((oi.selling_price - i.sku_cost_price) * oi.units * oi.sku_quantity) AS day_profit
                    FROM order_items oi JOIN inventory i ON i.sku_id = oi.sku_id
                    GROUP BY oi.order_id
                ) pft ON pft.order_id = o.order_id
                GROUP BY d.day_date
                ORDER BY d.day_date ASC
            """)
            rows = cursor.fetchall()
            chart = []
            for row in rows:
                day_date = row[0]
                date_str = day_date.strftime("%Y-%m-%d") if hasattr(day_date, "strftime") else str(day_date)
                chart.append({
                    "date": date_str,
                    "revenue": round(float(row[1]), 2) if row[1] else 0,
                    "expense": round(float(row[2]), 2) if row[2] else 0,
                    "profit":  round(float(row[3]), 2) if row[3] else 0,
                })
            data["revenue_chart"] = chart
        except Exception:
            today = datetime.now().date()
            data["revenue_chart"] = [
                {"date": (today - timedelta(days=59 - i)).strftime("%Y-%m-%d"), "revenue": 0, "expense": 0, "profit": 0}
                for i in range(60)
            ]

        # 8. Trending products: top 5 by qty sold in last 30 days
        #    Compare with 30-60 days ago to determine up/down trend
        try:
            cursor.execute("""
                SELECT p.sku_type, p.sku_subtype,
                       p.sold_30,
                       NVL(prev.sold_prev, 0) AS sold_prev,
                       NVL(stock.stock_qty, 0) AS stock_qty
                FROM (
                    SELECT sku_type, sku_subtype, SUM(units * sku_quantity) AS sold_30
                    FROM (
                        SELECT i.sku_type, i.sku_subtype, oi.units, oi.sku_quantity
                        FROM order_items oi
                        JOIN inventory i ON i.sku_id = oi.sku_id
                        JOIN orders o ON o.order_id = oi.order_id
                        WHERE o.order_date >= SYSDATE - 30
                    )
                    GROUP BY sku_type, sku_subtype
                    ORDER BY sold_30 DESC
                    FETCH FIRST 5 ROWS ONLY
                ) p
                LEFT JOIN (
                    SELECT i.sku_type, i.sku_subtype,
                           SUM(oi.units * oi.sku_quantity) AS sold_prev
                    FROM order_items oi
                    JOIN inventory i ON i.sku_id = oi.sku_id
                    JOIN orders o ON o.order_id = oi.order_id
                    WHERE o.order_date >= SYSDATE - 60 AND o.order_date < SYSDATE - 30
                    GROUP BY i.sku_type, i.sku_subtype
                ) prev ON prev.sku_type = p.sku_type AND prev.sku_subtype = p.sku_subtype
                LEFT JOIN (
                    SELECT sku_type, sku_subtype,
                           SUM(sku_quantity * sku_units) AS stock_qty
                    FROM inventory
                    GROUP BY sku_type, sku_subtype
                ) stock ON stock.sku_type = p.sku_type AND stock.sku_subtype = p.sku_subtype
            """)
            rows = cursor.fetchall()
            trending = []
            for row in rows:
                sold_30   = float(row[2] or 0)
                sold_prev = float(row[3] or 0)
                trending.append({
                    "name":      f"{row[0]} {row[1]}",
                    "sold":      round(sold_30, 3),
                    "stock":     round(float(row[4] or 0), 3),
                    "trend":     "up" if sold_30 >= sold_prev else "down",
                })
            data["trending_products"] = trending
        except Exception:
            data["trending_products"] = []

        # 9. Avg SP vs Avg CP per product type (horizontal bar chart)
        #    For each type: avg of last SP per (type+subtype) where both CP and SP exist
        #    Last SP = most recent selling_price from order_items for that type+subtype
        try:
            cursor.execute("""
                SELECT t.sku_type,
                       AVG(t.avg_cp) AS avg_cp,
                       AVG(t.last_sp) AS avg_sp
                FROM (
                    SELECT i.sku_type, i.sku_subtype,
                           AVG(i.sku_cost_price) AS avg_cp,
                           COALESCE(
                                (
                                    SELECT oi2.selling_price
                                    FROM order_items oi2
                                    JOIN inventory i2 ON i2.sku_id = oi2.sku_id
                                    JOIN orders o2 ON o2.order_id = oi2.order_id
                                    WHERE i2.sku_type = i.sku_type
                                      AND i2.sku_subtype = i.sku_subtype
                                    ORDER BY o2.order_date DESC
                                    FETCH FIRST 1 ROW ONLY
                                ),
                                AVG(i.sku_cost_price)
                           ) AS last_sp
                    FROM inventory i
                    GROUP BY i.sku_type, i.sku_subtype
                ) t
                WHERE t.avg_cp IS NOT NULL
                GROUP BY t.sku_type
                ORDER BY avg_sp DESC
            """)
            rows = cursor.fetchall()
            price_chart = []
            for row in rows:
                price_chart.append({
                    "type":   row[0],
                    "avg_cp": round(float(row[1]), 2) if row[1] else 0,
                    "avg_sp": round(float(row[2]), 2) if row[2] else 0,
                })
            data["price_chart"] = price_chart
        except Exception:
            data["price_chart"] = []

        # 10. Stock distribution pie chart — total qty (quantity × units) per type
        try:
            cursor.execute("""
                SELECT sku_type, SUM(sku_quantity * sku_units) AS total_qty
                FROM inventory
                WHERE sku_quantity > 0
                GROUP BY sku_type
                ORDER BY total_qty DESC
            """)
            rows = cursor.fetchall()
            stock_pie = []
            for row in rows:
                stock_pie.append({
                    "type":  row[0],
                    "value": round(float(row[1]), 3) if row[1] else 0,
                })
            data["stock_pie"] = stock_pie
        except Exception:
            data["stock_pie"] = []

    except Exception:
        pass
    finally:
        cursor.close()
        conn.close()

    return data
