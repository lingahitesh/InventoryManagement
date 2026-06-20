from fastapi import HTTPException
from backend.database.db import get_db
from backend.services.inventory_service import deduct_sku_quantity


def allocate_and_place_order(customer_id, order_date, shipping_address,
                              total_units, total_qty, total_amount, delivery_charge, lines):
    conn = get_db()
    cursor = conn.cursor()
    try:
        order_id_var = cursor.var(int)
        cursor.execute("""
            INSERT INTO orders
                (order_id, customer_id, order_date, shipping_address,
                 total_units, total_qty, total_amount, delivery_charge)
            VALUES
                (order_seq.NEXTVAL, :1, :2, :3, :4, :5, :6, :7)
            RETURNING order_id INTO :8
        """, [customer_id, order_date, shipping_address,
              total_units, total_qty, total_amount, delivery_charge, order_id_var])
        order_id = order_id_var.getvalue()[0]

        # Process each cart line independently
        for line in lines:
            units_needed = int(line.units)
            selling_price = float(line.selling_price)

            # Query matching SKUs within the same transaction to see uncommitted deductions
            dim_val = line.sku_dim
            if dim_val and dim_val != '-':
                import re
                num_m = re.match(r'(\d+)', dim_val)
                if num_m:
                    dv = int(num_m.group(1))
                    cursor.execute("""
                        SELECT sku_id, sku_type, sku_subtype, sku_dim,
                               sku_quantity, sku_cost_price, sku_desc, sku_units,
                               tracking_id, entry_date
                        FROM inventory
                        WHERE sku_type=:1 AND sku_subtype=:2 AND sku_units > 0
                          AND TO_NUMBER(REGEXP_SUBSTR(sku_dim, '^\d+')) BETWEEN :3 AND :4
                        ORDER BY sku_id ASC
                    """, [line.sku_type, line.sku_subtype, dv, dv + 15])
                else:
                    cursor.execute("""
                        SELECT sku_id, sku_type, sku_subtype, sku_dim,
                               sku_quantity, sku_cost_price, sku_desc, sku_units,
                               tracking_id, entry_date
                        FROM inventory
                        WHERE sku_type=:1 AND sku_subtype=:2 AND sku_dim=:3 AND sku_units > 0
                        ORDER BY sku_id ASC
                    """, [line.sku_type, line.sku_subtype, dim_val])
            else:
                cursor.execute("""
                    SELECT sku_id, sku_type, sku_subtype, sku_dim,
                           sku_quantity, sku_cost_price, sku_desc, sku_units,
                           tracking_id, entry_date
                    FROM inventory
                    WHERE sku_type=:1 AND sku_subtype=:2 AND sku_dim=:3 AND sku_units > 0
                    ORDER BY sku_id ASC
                """, [line.sku_type, line.sku_subtype, dim_val])
            skus_rows = cursor.fetchall()
            sku_keys = ["sku_id", "sku_type", "sku_subtype", "sku_dim",
                        "sku_quantity", "sku_cost_price", "sku_desc", "sku_units",
                        "tracking_id", "entry_date"]
            skus = [dict(zip(sku_keys, r)) for r in skus_rows]

            units_remaining = units_needed
            for sku in skus:
                if units_remaining <= 0:
                    break
                sku_total_units = int(sku["sku_units"])
                if sku_total_units <= 0:
                    continue
                units_take = min(sku_total_units, units_remaining)
                sku_qty = float(sku["sku_quantity"])

                deduct_sku_quantity(conn, cursor, sku["sku_id"], units_take)

                cursor.execute("""
                    INSERT INTO order_items
                        (item_id, order_id, sku_id, units, sku_quantity, selling_price)
                    VALUES
                        (order_item_seq.NEXTVAL, :1, :2, :3, :4, :5)
                """, [order_id, sku["sku_id"], units_take, sku_qty, selling_price])

                units_remaining -= units_take

        conn.commit()
        return order_id

    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def get_orders():
    """Returns all orders joined with customer name, shipping address, and dispatch status."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.order_id,
               o.customer_id,
               c.fname || ' ' || NVL(c.mname || ' ', '') || c.lname AS customer_name,
               o.shipping_address,
               o.order_date,
               o.total_units,
               o.total_qty,
               o.total_amount,
               o.delivery_charge,
               NVL((SELECT SUM(di.units_dispatched)
                    FROM dispatch_items di
                    JOIN order_items oi ON oi.item_id = di.order_item_id
                    WHERE oi.order_id = o.order_id), 0) AS dispatched_units
        FROM   orders o
        JOIN   customers c ON c.customer_id = o.customer_id
        ORDER  BY o.order_id DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["order_id", "customer_id", "customer_name", "shipping_address",
            "order_date", "total_units", "total_qty", "total_amount",
            "delivery_charge", "dispatched_units"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["order_date"] and hasattr(d["order_date"], "isoformat"):
            d["order_date"] = d["order_date"].isoformat()
        for k in ("total_units", "total_qty", "total_amount", "delivery_charge"):
            if d[k] is not None:
                d[k] = float(d[k]) if k != "total_units" else int(d[k])
        dispatched = int(d.pop("dispatched_units") or 0)
        total = int(d.get("total_units") or 0)
        if dispatched == 0:
            d["dispatch_status"] = "pending"
        elif dispatched >= total:
            d["dispatch_status"] = "completed"
        else:
            d["dispatch_status"] = "partial"
        result.append(d)
    return result


def get_order_items(order_id):
    """
    Returns all items for a given order.
    units        = number of units ordered
    sku_quantity = total kg of that batch
    subtotal     = units × sku_quantity × selling_price
    """
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT oi.item_id,
               oi.sku_id,
               i.sku_type,
               i.sku_subtype,
               i.sku_dim,
               oi.units          AS units_ordered,
               oi.sku_quantity   AS batch_qty_kg,
               oi.selling_price,
               oi.units * oi.sku_quantity * oi.selling_price AS subtotal,
               NVL((SELECT SUM(di.units_dispatched) FROM dispatch_items di WHERE di.order_item_id = oi.item_id), 0) AS units_dispatched
        FROM   order_items oi
        JOIN   inventory i ON i.sku_id = oi.sku_id
        WHERE  oi.order_id = :1
        ORDER  BY oi.item_id
    """, [order_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["item_id", "sku_id", "sku_type", "sku_subtype", "sku_dim",
            "units_ordered", "batch_qty_kg", "selling_price", "subtotal", "units_dispatched"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        for k in ("batch_qty_kg", "selling_price", "subtotal"):
            if d[k] is not None:
                d[k] = float(d[k])
        if d["units_ordered"] is not None:
            d["units_ordered"] = int(d["units_ordered"])
        d["units_dispatched"] = int(d["units_dispatched"] or 0)
        d["units_remaining"] = d["units_ordered"] - d["units_dispatched"]
        result.append(d)
    return result


def get_order_full(order_id):
    """Returns full order data including customer_id, shipping_address, and items."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.order_id, o.customer_id, o.shipping_address, o.order_date,
               o.total_units, o.total_qty, o.total_amount, o.delivery_charge
        FROM   orders o WHERE o.order_id = :1
    """, [order_id])
    row = cursor.fetchone()
    if not row:
        cursor.close(); conn.close()
        return None
    order = dict(zip(["order_id","customer_id","shipping_address","order_date",
                      "total_units","total_qty","total_amount","delivery_charge"], row))
    if order["order_date"] and hasattr(order["order_date"], "isoformat"):
        order["order_date"] = order["order_date"].isoformat()
    if order["total_units"] is not None:
        order["total_units"] = int(order["total_units"])
    for k in ("total_qty", "total_amount", "delivery_charge"):
        if order[k] is not None:
            order[k] = float(order[k])
    # Get items
    cursor.execute("""
        SELECT oi.sku_id, i.sku_type, i.sku_subtype, i.sku_dim,
               oi.units, oi.sku_quantity, oi.selling_price
        FROM   order_items oi
        JOIN   inventory i ON i.sku_id = oi.sku_id
        WHERE  oi.order_id = :1
    """, [order_id])
    items = []
    for r in cursor.fetchall():
        items.append({
            "sku_id": r[0], "sku_type": r[1], "sku_subtype": r[2], "sku_dim": r[3],
            "units": int(r[4]), "sku_quantity": float(r[5]), "selling_price": float(r[6])
        })
    order["items"] = items
    cursor.close()
    conn.close()
    return order


def delete_order(order_id):
    """
    Deletes an order and reverses inventory deductions:
    - For each order_item, add back the units to the corresponding SKU
    - Then delete order_items and the order itself
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Get items to reverse (need sku_quantity to restore kg)
        cursor.execute("""
            SELECT sku_id, units, sku_quantity FROM order_items WHERE order_id = :1
        """, [order_id])
        items = cursor.fetchall()

        # Reverse: add units back and restore sku_quantity if it was zeroed
        for sku_id, units, sku_qty in items:
            cursor.execute("""
                UPDATE inventory
                SET sku_units = sku_units + :1,
                    sku_quantity = CASE WHEN sku_quantity = 0 THEN :2 ELSE sku_quantity END
                WHERE sku_id = :3
            """, [int(units), float(sku_qty), sku_id])

        # Delete order items
        cursor.execute("DELETE FROM order_items WHERE order_id = :1", [order_id])

        # Delete order
        cursor.execute("DELETE FROM orders WHERE order_id = :1", [order_id])
        rows = cursor.rowcount

        conn.commit()
        return rows

    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
