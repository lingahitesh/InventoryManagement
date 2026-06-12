from fastapi import HTTPException
from backend.database.db import get_db
from backend.services.inventory_service import get_matching_skus, deduct_sku_quantity


def allocate_and_place_order(customer_id, order_date, shipping_address,
                              total_units, total_qty, total_amount, lines):
    conn = get_db()
    cursor = conn.cursor()
    try:
        order_id_var = cursor.var(int)
        cursor.execute("""
            INSERT INTO orders
                (order_id, customer_id, order_date, shipping_address,
                 total_units, total_qty, total_amount)
            VALUES
                (order_seq.NEXTVAL, :1, :2, :3, :4, :5, :6)
            RETURNING order_id INTO :7
        """, [customer_id, order_date, shipping_address,
              total_units, total_qty, total_amount, order_id_var])
        order_id = order_id_var.getvalue()[0]

        # Merge lines with same type+subtype+dim
        merged: dict[tuple, dict] = {}
        for line in lines:
            key = (line.sku_type, line.sku_subtype, line.sku_dim)
            if key in merged:
                merged[key]["units"]        += int(line.quantity)
                merged[key]["selling_price"] = float(line.selling_price)
            else:
                merged[key] = {
                    "sku_type":      line.sku_type,
                    "sku_subtype":   line.sku_subtype,
                    "sku_dim":       line.sku_dim,
                    "units":         int(line.quantity),
                    "selling_price": float(line.selling_price)
                }

        for key, line in merged.items():
            units_needed = line["units"]
            skus = get_matching_skus(line["sku_type"], line["sku_subtype"], line["sku_dim"])

            total_units_avail = sum(int(s["sku_units"]) for s in skus)
            if total_units_avail < units_needed:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"Insufficient units for {line['sku_type']} / "
                        f"{line['sku_subtype']} / {line['sku_dim']}: "
                        f"need {units_needed}, available {total_units_avail}"
                    )
                )

            units_remaining = units_needed
            for sku in skus:
                if units_remaining <= 0:
                    break
                sku_total_units = int(sku["sku_units"])
                if sku_total_units <= 0:
                    continue
                units_take   = min(sku_total_units, units_remaining)
                sku_qty      = float(sku["sku_quantity"])   # kg of this whole batch

                deduct_sku_quantity(conn, cursor, sku["sku_id"], units_take)

                # Store: quantity = units ordered, sku_quantity = kg of this batch
                cursor.execute("""
                    INSERT INTO order_items
                        (item_id, order_id, sku_id, quantity, sku_quantity, selling_price)
                    VALUES
                        (order_item_seq.NEXTVAL, :1, :2, :3, :4, :5)
                """, [order_id, sku["sku_id"], units_take, sku_qty, line["selling_price"]])

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
    """Returns all orders joined with customer name and shipping address."""
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
               o.total_amount
        FROM   orders o
        JOIN   customers c ON c.customer_id = o.customer_id
        ORDER  BY o.order_id DESC
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["order_id", "customer_id", "customer_name", "shipping_address",
            "order_date", "total_units", "total_qty", "total_amount"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["order_date"] and hasattr(d["order_date"], "isoformat"):
            d["order_date"] = d["order_date"].isoformat()
        for k in ("total_units", "total_qty", "total_amount"):
            if d[k] is not None:
                d[k] = float(d[k]) if k != "total_units" else int(d[k])
        result.append(d)
    return result


def update_order(order_id, shipping_address=None, order_date=None):
    conn = get_db()
    cursor = conn.cursor()
    sets, params = [], []
    if shipping_address is not None:
        sets.append(f"shipping_address = :{len(params)+1}")
        params.append(shipping_address)
    if order_date is not None:
        sets.append(f"order_date = :{len(params)+1}")
        params.append(order_date)
    if not sets:
        cursor.close(); conn.close()
        return 0
    params.append(order_id)
    cursor.execute(
        f"UPDATE orders SET {', '.join(sets)} WHERE order_id = :{len(params)}",
        params
    )
    rows = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows


def get_order_items(order_id):
    """
    Returns all items for a given order.
    quantity     = number of units ordered
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
               oi.quantity       AS units_ordered,
               oi.sku_quantity   AS batch_qty_kg,
               oi.selling_price,
               oi.quantity * oi.sku_quantity * oi.selling_price AS subtotal
        FROM   order_items oi
        JOIN   inventory i ON i.sku_id = oi.sku_id
        WHERE  oi.order_id = :1
        ORDER  BY oi.item_id
    """, [order_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["item_id", "sku_id", "sku_type", "sku_subtype", "sku_dim",
            "units_ordered", "batch_qty_kg", "selling_price", "subtotal"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        for k in ("batch_qty_kg", "selling_price", "subtotal"):
            if d[k] is not None:
                d[k] = float(d[k])
        if d["units_ordered"] is not None:
            d["units_ordered"] = int(d["units_ordered"])
        result.append(d)
    return result


def get_order_full(order_id):
    """Returns full order data including customer_id, shipping_address, and items."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT o.order_id, o.customer_id, o.shipping_address, o.order_date,
               o.total_units, o.total_qty, o.total_amount
        FROM   orders o WHERE o.order_id = :1
    """, [order_id])
    row = cursor.fetchone()
    if not row:
        cursor.close(); conn.close()
        return None
    order = dict(zip(["order_id","customer_id","shipping_address","order_date",
                      "total_units","total_qty","total_amount"], row))
    if order["order_date"] and hasattr(order["order_date"], "isoformat"):
        order["order_date"] = order["order_date"].isoformat()

    # Get items
    cursor.execute("""
        SELECT oi.sku_id, i.sku_type, i.sku_subtype, i.sku_dim,
               oi.quantity, oi.sku_quantity, oi.selling_price
        FROM   order_items oi
        JOIN   inventory i ON i.sku_id = oi.sku_id
        WHERE  oi.order_id = :1
    """, [order_id])
    items = []
    for r in cursor.fetchall():
        items.append({
            "sku_id": r[0], "sku_type": r[1], "sku_subtype": r[2], "sku_dim": r[3],
            "quantity": int(r[4]), "sku_quantity": float(r[5]), "selling_price": float(r[6])
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
        # Get items to reverse
        cursor.execute("""
            SELECT sku_id, quantity FROM order_items WHERE order_id = :1
        """, [order_id])
        items = cursor.fetchall()

        # Reverse: add units back to inventory
        for sku_id, units in items:
            cursor.execute("""
                UPDATE inventory
                SET sku_units = sku_units + :1
                WHERE sku_id = :2
            """, [int(units), sku_id])

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
