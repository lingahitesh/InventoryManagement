from fastapi import HTTPException
from backend.database.db import get_db


def create_dispatch(dispatched_through, items):
    conn = get_db()
    cursor = conn.cursor()
    try:
        total_units = sum(i.units_dispatched for i in items)

        dispatch_id_var = cursor.var(int)
        cursor.execute("""
            INSERT INTO dispatches
                (dispatch_id, dispatched_through, total_units)
            VALUES
                (dispatch_seq.NEXTVAL, :1, :2)
            RETURNING dispatch_id INTO :3
        """, [dispatched_through, total_units, dispatch_id_var])
        dispatch_id = dispatch_id_var.getvalue()[0]

        for item in items:
            cursor.execute("""
                INSERT INTO dispatch_items
                    (dispatch_item_id, dispatch_id, order_id, order_item_id, units_dispatched,
                     dispatch_doc_no, delivery_note_date, delivery_date,
                     buyer_order_no, buyer_order_date, other_references)
                VALUES
                    (dispatch_item_seq.NEXTVAL, :1, :2, :3, :4, :5, :6, :7, :8, :9, :10)
            """, [dispatch_id, item.order_id, item.order_item_id, item.units_dispatched,
                  item.dispatch_doc_no, item.delivery_note_date,
                  item.delivery_date, item.buyer_order_no, item.buyer_order_date,
                  item.other_references])

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
        SELECT d.dispatch_id, d.dispatched_through, d.total_units, d.created_at,
               (SELECT LISTAGG(DISTINCT c.fname || ' ' || NVL(c.mname || ' ', '') || c.lname, ', ')
                    WITHIN GROUP (ORDER BY c.fname)
                FROM dispatch_items di
                JOIN orders o ON o.order_id = di.order_id
                JOIN customers c ON c.customer_id = o.customer_id
                WHERE di.dispatch_id = d.dispatch_id) AS customer_names,
               (SELECT LISTAGG(DISTINCT TO_CHAR(di2.order_id), ', ') WITHIN GROUP (ORDER BY di2.order_id)
                FROM dispatch_items di2 WHERE di2.dispatch_id = d.dispatch_id) AS order_ids
        FROM dispatches d
        ORDER BY d.dispatch_id DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["dispatch_id", "dispatched_through", "total_units", "created_at", "customer_names", "order_ids"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["created_at"] and hasattr(d["created_at"], "isoformat"):
            d["created_at"] = d["created_at"].isoformat()
        if d["total_units"] is not None:
            d["total_units"] = int(d["total_units"])
        result.append(d)
    return result


def get_dispatch_items(dispatch_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT di.dispatch_item_id, di.order_id, di.order_item_id, di.units_dispatched,
               o.customer_id,
               c.fname || ' ' || NVL(c.mname || ' ', '') || c.lname AS customer_name,
               inv.sku_type, inv.sku_subtype, inv.sku_dim,
               di.dispatch_doc_no, di.delivery_note_date,
               di.delivery_date, di.buyer_order_no, di.buyer_order_date, di.other_references
        FROM dispatch_items di
        JOIN orders o ON o.order_id = di.order_id
        JOIN customers c ON c.customer_id = o.customer_id
        JOIN order_items oi ON oi.item_id = di.order_item_id
        JOIN inventory inv ON inv.sku_id = oi.sku_id
        WHERE di.dispatch_id = :1
        ORDER BY di.dispatch_item_id
    """, [dispatch_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["dispatch_item_id", "order_id", "order_item_id", "units_dispatched",
            "customer_id", "customer_name", "sku_type", "sku_subtype", "sku_dim",
            "dispatch_doc_no", "delivery_note_date",
            "delivery_date", "buyer_order_no", "buyer_order_date", "other_references"]
    result = []
    for r in rows:
        d = dict(zip(keys, r))
        for k in ("delivery_note_date", "delivery_date", "buyer_order_date"):
            if d[k] and hasattr(d[k], "isoformat"):
                d[k] = d[k].isoformat()
        if d["units_dispatched"] is not None:
            d["units_dispatched"] = int(d["units_dispatched"])
        result.append(d)
    return result


def get_order_items_for_dispatch(order_id):
    """Get order items with remaining dispatchable units."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT oi.item_id, oi.sku_id, i.sku_type, i.sku_subtype, i.sku_dim,
               oi.units AS total_units,
               oi.units - NVL((
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


def delete_dispatch(dispatch_id):
    """Delete a dispatch and its items. No inventory changes to revert (dispatch doesn't deduct inventory)."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM dispatch_items WHERE dispatch_id = :1", [dispatch_id])
        cursor.execute("DELETE FROM dispatches WHERE dispatch_id = :1", [dispatch_id])
        rows = cursor.rowcount
        conn.commit()
        return rows
    except Exception as e:
        conn.rollback()
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
