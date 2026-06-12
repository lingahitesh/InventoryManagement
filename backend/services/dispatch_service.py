from fastapi import HTTPException
from backend.database.db import get_db


def create_dispatch(tracking_id, dispatched_through, dispatch_doc_no,
                    delivery_note_date, buyer_order_no, buyer_order_date,
                    other_references, payment_mode, delivery_date, items):
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Calculate total quantity from dispatched units
        total_qty = sum(i.units_dispatched for i in items)

        dispatch_id_var = cursor.var(int)
        cursor.execute("""
            INSERT INTO dispatches
                (dispatch_id, tracking_id, dispatched_through, dispatch_doc_no,
                 delivery_note_date, buyer_order_no, buyer_order_date,
                 other_references, payment_mode, delivery_date, total_quantity)
            VALUES
                (dispatch_seq.NEXTVAL, :1, :2, :3, :4, :5, :6, :7, :8, :9, :10)
            RETURNING dispatch_id INTO :11
        """, [tracking_id, dispatched_through, dispatch_doc_no,
              delivery_note_date, buyer_order_no, buyer_order_date,
              other_references, payment_mode, delivery_date, total_qty, dispatch_id_var])
        dispatch_id = dispatch_id_var.getvalue()[0]

        for item in items:
            cursor.execute("""
                INSERT INTO dispatch_items
                    (dispatch_item_id, dispatch_id, order_id, order_item_id, units_dispatched)
                VALUES
                    (dispatch_item_seq.NEXTVAL, :1, :2, :3, :4)
            """, [dispatch_id, item.order_id, item.order_item_id, item.units_dispatched])

        conn.commit()
        return dispatch_id

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def get_dispatches():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT d.dispatch_id, d.tracking_id, d.dispatched_through,
               d.dispatch_doc_no, d.delivery_note_date, d.buyer_order_no,
               d.buyer_order_date, d.other_references, d.payment_mode,
               d.delivery_date, d.total_quantity, d.created_at
        FROM dispatches d
        ORDER BY d.dispatch_id DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["dispatch_id", "tracking_id", "dispatched_through", "dispatch_doc_no",
            "delivery_note_date", "buyer_order_no", "buyer_order_date",
            "other_references", "payment_mode", "delivery_date", "total_quantity", "created_at"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        for k in ("delivery_note_date", "buyer_order_date", "delivery_date", "created_at"):
            if d[k] and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        result.append(d)
    return result


def get_dispatch_items(dispatch_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT di.dispatch_item_id, di.order_id, di.order_item_id, di.units_dispatched,
               o.customer_id,
               c.fname || ' ' || NVL(c.mname || ' ', '') || c.lname AS customer_name,
               i.sku_type, i.sku_subtype, i.sku_dim
        FROM dispatch_items di
        JOIN orders o ON o.order_id = di.order_id
        JOIN customers c ON c.customer_id = o.customer_id
        JOIN order_items oi ON oi.item_id = di.order_item_id
        JOIN inventory i ON i.sku_id = oi.sku_id
        WHERE di.dispatch_id = :1
        ORDER BY di.dispatch_item_id
    """, [dispatch_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["dispatch_item_id", "order_id", "order_item_id", "units_dispatched",
            "customer_id", "customer_name", "sku_type", "sku_subtype", "sku_dim"]
    return [dict(zip(keys, r)) for r in rows]


def get_order_items_for_dispatch(order_id):
    """Get order items with remaining dispatchable units."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT oi.item_id, oi.sku_id, i.sku_type, i.sku_subtype, i.sku_dim,
               oi.quantity AS total_units,
               oi.quantity - NVL((
                   SELECT SUM(di.units_dispatched)
                   FROM dispatch_items di
                   WHERE di.order_item_id = oi.item_id
               ), 0) AS remaining_units
        FROM order_items oi
        JOIN inventory i ON i.sku_id = oi.sku_id
        WHERE oi.order_id = :1
        ORDER BY oi.item_id
    """, [order_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["item_id", "sku_id", "sku_type", "sku_subtype", "sku_dim",
            "total_units", "remaining_units"]
    return [dict(zip(keys, r)) for r in rows]
