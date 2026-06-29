from fastapi import HTTPException
from backend.database.db import get_db
from datetime import datetime


COMPANY_SHIPPING_ADDRESSES = [
    "CHAMPA POLYPLAST PRIVATE LIMITED, 109, CHANDIGARI, KADAMBAGACHI, BARASAT, North 24Parganas, West Bengal - 700128",
    "CHAMPA POLYPLAST PRIVATE LIMITED, GODOWN NO 26, GROUND FLOOR, 5A LALA BABU LANE, COSSIPORE, KOLKATA - 700002",
    "CHAMPA POLYPLAST PRIVATE LIMITED, GODOWN NO 25, GROUND FLOOR, 5A LALA BABU LANE, COSSIPORE, KOLKATA - 700002",
    "CHAMPA POLYPLAST PRIVATE LIMITED, GODOWN NO 3A, GROUND FLOOR 1/4C, KHAGENDRA CHATTERJEE ROAD, COSSIPORE, KOLKATA - 700002",
]

DEFAULT_BILLING = "3/B, PORTUGUESE CHURCH STREET 2ND FLOOR, KOLKATA 700001"


def get_purchase_orders(status=None):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT po.po_id, po.supplier_name, po.supplier_contact, po.supplier_gst,
               po.supplier_email, po.billing_address, po.shipping_address,
               po.tracking_id, po.order_date, po.status, po.notes,
               (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.po_id AND (i.item_status = 'confirm' OR i.item_status IS NULL)) AS confirm_count,
               (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.po_id AND i.item_status = 'arrived') AS arrived_count,
               (SELECT COUNT(*) FROM purchase_order_items i WHERE i.po_id = po.po_id) AS total_items,
               (SELECT MIN(i.arrived_at) FROM purchase_order_items i WHERE i.po_id = po.po_id AND i.arrived_at IS NOT NULL) AS first_arrived_at
        FROM purchase_orders po
        WHERE 1=1
    """
    params = []
    if status:
        query += f" AND po.status = :{len(params)+1}"
        params.append(status)
    query += " ORDER BY po.po_id DESC"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["po_id","supplier_name","supplier_contact","supplier_gst","supplier_email",
            "billing_address","shipping_address","tracking_id","order_date","status","notes",
            "confirm_count","arrived_count","total_items","first_arrived_at"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["order_date"] and hasattr(d["order_date"], "isoformat"):
            d["order_date"] = d["order_date"].isoformat()
        if d["first_arrived_at"] and hasattr(d["first_arrived_at"], "isoformat"):
            d["first_arrived_at"] = d["first_arrived_at"].isoformat()
        if d["po_id"] is not None: d["po_id"] = int(d["po_id"])
        d["confirm_count"] = int(d["confirm_count"] or 0)
        d["arrived_count"] = int(d["arrived_count"] or 0)
        d["total_items"] = int(d["total_items"] or 0)
        # Derived flags
        d["all_confirm"] = d["confirm_count"] == d["total_items"] and d["total_items"] > 0
        d["has_arrived"] = d["arrived_count"] > 0
        result.append(d)
    return result


def get_purchase_order_items(po_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT poi_id, po_id, sku_type, sku_subtype, sku_dim,
               sku_quantity, sku_units, sku_cost_price, sku_desc, arrived, inventory_sku_id,
               item_status, arrived_at
        FROM purchase_order_items WHERE po_id = :1 ORDER BY poi_id
    """, [po_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["poi_id","po_id","sku_type","sku_subtype","sku_dim","sku_quantity",
            "sku_units","sku_cost_price","sku_desc","arrived","inventory_sku_id",
            "item_status","arrived_at"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        for k in ("poi_id","po_id","sku_units"):
            if d[k] is not None: d[k] = int(d[k])
        for k in ("sku_quantity","sku_cost_price"):
            if d[k] is not None: d[k] = float(d[k])
        d["arrived"] = bool(d["arrived"])
        if d["inventory_sku_id"] is not None: d["inventory_sku_id"] = int(d["inventory_sku_id"])
        # item_status: confirm -> not_arrived -> arrived
        if not d["item_status"]:
            d["item_status"] = "arrived" if d["arrived"] else "not_arrived"
        if d["arrived_at"] and hasattr(d["arrived_at"], "isoformat"):
            d["arrived_at"] = d["arrived_at"].isoformat()
        result.append(d)
    return result


def create_purchase_order(supplier_name, supplier_contact, supplier_gst, supplier_email,
                          billing_address, shipping_address, tracking_id, order_date, notes, items):
    conn = get_db()
    cursor = conn.cursor()
    try:
        po_id_var = cursor.var(int)
        resolved_dt = order_date if order_date else datetime.now()
        cursor.execute("""
            INSERT INTO purchase_orders
                (supplier_name, supplier_contact, supplier_gst, supplier_email,
                 billing_address, shipping_address, tracking_id, order_date, status, notes)
            VALUES (:1,:2,:3,:4,:5,:6,:7,:8,'pending',:9)
            RETURNING po_id INTO :10
        """, [supplier_name, supplier_contact, supplier_gst, supplier_email,
              billing_address, shipping_address, tracking_id, resolved_dt, notes, po_id_var])
        po_id = po_id_var.getvalue()[0]

        for item in items:
            cursor.execute("""
                INSERT INTO purchase_order_items
                    (po_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_units,
                     sku_cost_price, sku_desc, arrived)
                VALUES (:1,:2,:3,:4,:5,:6,:7,:8,0)
            """, [po_id, item["sku_type"], item["sku_subtype"], item.get("sku_dim","-"),
                  item["sku_quantity"], item.get("sku_units", 1),
                  item.get("sku_cost_price"), item.get("sku_desc")])
        conn.commit()
        return po_id
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def delete_purchase_order(po_id):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM purchase_order_items WHERE po_id = :1", [po_id])
        cursor.execute("DELETE FROM purchase_orders WHERE po_id = :1", [po_id])
        rows = cursor.rowcount
        conn.commit()
        return rows
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def advance_item_status(poi_id, new_status: str):
    """
    Advance a purchase order item through states: confirm -> not_arrived -> arrived.
    When moving to 'arrived', adds to inventory.
    When reverting from 'arrived' to 'not_arrived', removes from inventory.
    """
    valid = ("confirm", "not_arrived", "arrived")
    if new_status not in valid:
        raise HTTPException(status_code=400, detail=f"Invalid status: {new_status}")

    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT poi_id, po_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_units,
                   sku_cost_price, sku_desc, arrived, inventory_sku_id, item_status
            FROM purchase_order_items WHERE poi_id = :1
        """, [poi_id])
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

        keys = ["poi_id","po_id","sku_type","sku_subtype","sku_dim","sku_quantity",
                "sku_units","sku_cost_price","sku_desc","arrived","inventory_sku_id","item_status"]
        item = dict(zip(keys, row))
        old_status = item["item_status"] or ("arrived" if item["arrived"] else "not_arrived")

        if new_status == "arrived" and old_status != "arrived":
            # Determine location from PO shipping address
            cursor.execute("SELECT shipping_address FROM purchase_orders WHERE po_id = :1", [item["po_id"]])
            po_row = cursor.fetchone()
            ship_addr = (po_row[0] or "").upper() if po_row else ""
            if "KADAMBAGACHI" in ship_addr or "109" in ship_addr:
                location = "M-Gram"
            elif "GODOWN NO 26" in ship_addr:
                location = "Print"
            elif "GODOWN NO 25" in ship_addr:
                location = "Cutting"
            elif "GODOWN NO 3A" in ship_addr or "KHAGENDRA" in ship_addr:
                location = "Film"
            else:
                location = "M-Gram"

            # Add to inventory
            sku_id_var = cursor.var(int)
            cursor.execute("""
                INSERT INTO inventory
                    (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity,
                     sku_cost_price, sku_desc, sku_units, entry_date, location)
                VALUES (inventory_seq.NEXTVAL, :1, :2, :3, :4, :5, :6, :7, SYSTIMESTAMP, :8)
                RETURNING sku_id INTO :9
            """, [item["sku_type"], item["sku_subtype"], item["sku_dim"] or "-",
                  item["sku_quantity"], item["sku_cost_price"], item["sku_desc"],
                  item["sku_units"], location, sku_id_var])
            new_sku_id = sku_id_var.getvalue()[0]
            cursor.execute("""
                UPDATE purchase_order_items SET arrived=1, inventory_sku_id=:1,
                    item_status='arrived', arrived_at=SYSTIMESTAMP WHERE poi_id=:2
            """, [new_sku_id, poi_id])
        elif new_status == "not_arrived" and old_status == "arrived" and item["inventory_sku_id"]:
            # Revert from arrived -> not_arrived (remove from inventory)
            sku_id = item["inventory_sku_id"]
            cursor.execute("SELECT sku_units FROM inventory WHERE sku_id = :1", [sku_id])
            inv_row = cursor.fetchone()
            if not inv_row:
                cursor.execute("""
                    UPDATE purchase_order_items SET arrived=0, inventory_sku_id=NULL,
                        item_status='not_arrived', arrived_at=NULL WHERE poi_id=:1
                """, [poi_id])
            else:
                current_units = int(inv_row[0] or 0)
                if current_units - int(item["sku_units"] or 0) < 0:
                    raise HTTPException(status_code=400, detail="Cannot revert: inventory would go negative")
                elif current_units - int(item["sku_units"] or 0) == 0:
                    cursor.execute("DELETE FROM inventory WHERE sku_id = :1", [sku_id])
                else:
                    cursor.execute("""
                        UPDATE inventory SET sku_units = sku_units - :1 WHERE sku_id = :2
                    """, [int(item["sku_units"] or 0), sku_id])
                cursor.execute("""
                    UPDATE purchase_order_items SET arrived=0, inventory_sku_id=NULL,
                        item_status='not_arrived', arrived_at=NULL WHERE poi_id=:1
                """, [poi_id])
        elif new_status == "not_arrived" and old_status == "confirm":
            # confirm -> not_arrived (no inventory change)
            cursor.execute("""
                UPDATE purchase_order_items SET item_status='not_arrived' WHERE poi_id=:1
            """, [poi_id])
        elif new_status == "confirm" and old_status == "not_arrived":
            # Revert: not_arrived -> confirm (only allowed with password, handled at API level)
            cursor.execute("""
                UPDATE purchase_order_items SET item_status='confirm' WHERE poi_id=:1
            """, [poi_id])
        elif new_status == "confirm" and old_status == "arrived":
            raise HTTPException(status_code=400, detail="Cannot revert to confirm from arrived state")
        else:
            # Same state or confirm->arrived directly (skip not_arrived)
            if new_status == "arrived" and old_status == "confirm":
                raise HTTPException(status_code=400, detail="Must confirm first (go to not_arrived then arrived)")

        # Update PO status
        po_id = item["po_id"]
        cursor.execute("SELECT COUNT(*), SUM(arrived) FROM purchase_order_items WHERE po_id=:1", [po_id])
        total, arrived_count = cursor.fetchone()
        total = int(total or 0)
        arrived_count = int(arrived_count or 0)
        if arrived_count == 0:
            new_po_status = "pending"
        elif arrived_count >= total:
            new_po_status = "completed"
        else:
            new_po_status = "partial"
        cursor.execute("UPDATE purchase_orders SET status=:1 WHERE po_id=:2", [new_po_status, po_id])

        conn.commit()
        return {"status": new_po_status}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def mark_item_arrived(poi_id, arrived: bool):
    """
    Legacy wrapper: mark arrived=True -> advance to 'arrived', arrived=False -> revert to 'not_arrived'.
    """
    new_status = "arrived" if arrived else "not_arrived"
    return advance_item_status(poi_id, new_status)


def update_po_item(poi_id, data: dict):
    """Update a purchase order item's fields (only allowed in confirm/not_arrived state)."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT item_status, arrived FROM purchase_order_items WHERE poi_id = :1", [poi_id])
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")
        status = row[0] or ("arrived" if row[1] else "not_arrived")
        if status == "arrived":
            raise HTTPException(status_code=400, detail="Cannot edit an arrived item")

        sets = []
        params = []
        for field in ("sku_type", "sku_subtype", "sku_dim", "sku_quantity", "sku_units", "sku_cost_price", "sku_desc"):
            if field in data:
                sets.append(f"{field} = :{len(params)+1}")
                params.append(data[field])
        if not sets:
            return {"message": "Nothing to update"}
        params.append(poi_id)
        cursor.execute(f"UPDATE purchase_order_items SET {', '.join(sets)} WHERE poi_id = :{len(params)}", params)
        conn.commit()
        return {"message": "Updated"}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


def get_billing_addresses():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT addr_id, address FROM po_billing_addresses ORDER BY addr_id")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"addr_id": int(r[0]), "address": r[1]} for r in rows]


def save_billing_address(address):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO po_billing_addresses (address) VALUES (:1)", [address])
    conn.commit()
    cursor.close()
    conn.close()


def update_purchase_order(po_id, supplier_name, supplier_contact, supplier_gst, supplier_email,
                          billing_address, shipping_address, tracking_id, order_date, notes, items):
    """Update an existing PO's header and replace all items (only if no items are arrived)."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        # Check no items are arrived
        cursor.execute("""
            SELECT COUNT(*) FROM purchase_order_items
            WHERE po_id = :1 AND (item_status = 'arrived' OR arrived = 1)
        """, [po_id])
        arrived_count = int(cursor.fetchone()[0] or 0)
        if arrived_count > 0:
            raise HTTPException(status_code=400, detail="Cannot edit PO with arrived items")

        resolved_dt = order_date if order_date else datetime.now()
        cursor.execute("""
            UPDATE purchase_orders SET
                supplier_name=:1, supplier_contact=:2, supplier_gst=:3, supplier_email=:4,
                billing_address=:5, shipping_address=:6, tracking_id=:7, order_date=:8, notes=:9
            WHERE po_id=:10
        """, [supplier_name, supplier_contact, supplier_gst, supplier_email,
              billing_address, shipping_address, tracking_id, resolved_dt, notes, po_id])

        # Delete old items and insert new ones
        cursor.execute("DELETE FROM purchase_order_items WHERE po_id = :1", [po_id])
        for item in items:
            cursor.execute("""
                INSERT INTO purchase_order_items
                    (po_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_units,
                     sku_cost_price, sku_desc, arrived, item_status)
                VALUES (:1,:2,:3,:4,:5,:6,:7,:8,0,'confirm')
            """, [po_id, item["sku_type"], item.get("sku_subtype"), item.get("sku_dim", "-"),
                  item["sku_quantity"], item.get("sku_units", 1),
                  item.get("sku_cost_price"), item.get("sku_desc")])
        conn.commit()
        return {"message": "Purchase order updated", "po_id": po_id}
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
