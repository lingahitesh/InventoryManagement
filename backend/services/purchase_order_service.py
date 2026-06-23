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
               po.tracking_id, po.order_date, po.status, po.notes
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
            "billing_address","shipping_address","tracking_id","order_date","status","notes"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["order_date"] and hasattr(d["order_date"], "isoformat"):
            d["order_date"] = d["order_date"].isoformat()
        if d["po_id"] is not None: d["po_id"] = int(d["po_id"])
        result.append(d)
    return result


def get_purchase_order_items(po_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT poi_id, po_id, sku_type, sku_subtype, sku_dim,
               sku_quantity, sku_units, sku_cost_price, sku_desc, arrived, inventory_sku_id
        FROM purchase_order_items WHERE po_id = :1 ORDER BY poi_id
    """, [po_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["poi_id","po_id","sku_type","sku_subtype","sku_dim","sku_quantity",
            "sku_units","sku_cost_price","sku_desc","arrived","inventory_sku_id"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        for k in ("poi_id","po_id","sku_units"):
            if d[k] is not None: d[k] = int(d[k])
        for k in ("sku_quantity","sku_cost_price"):
            if d[k] is not None: d[k] = float(d[k])
        d["arrived"] = bool(d["arrived"])
        if d["inventory_sku_id"] is not None: d["inventory_sku_id"] = int(d["inventory_sku_id"])
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


def mark_item_arrived(poi_id, arrived: bool):
    """
    Mark a purchase order item as arrived (add to inventory) or un-arrive (remove from inventory).
    Returns error string if revert would make inventory negative.
    """
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT poi_id, po_id, sku_type, sku_subtype, sku_dim, sku_quantity, sku_units,
                   sku_cost_price, sku_desc, arrived, inventory_sku_id
            FROM purchase_order_items WHERE poi_id = :1
        """, [poi_id])
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Item not found")

        keys = ["poi_id","po_id","sku_type","sku_subtype","sku_dim","sku_quantity",
                "sku_units","sku_cost_price","sku_desc","arrived","inventory_sku_id"]
        item = dict(zip(keys, row))

        if arrived and not item["arrived"]:
            # Add to inventory
            sku_id_var = cursor.var(int)
            cursor.execute("""
                INSERT INTO inventory
                    (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity,
                     sku_cost_price, sku_desc, sku_units, entry_date)
                VALUES (inventory_seq.NEXTVAL, :1, :2, :3, :4, :5, :6, :7, SYSTIMESTAMP)
                RETURNING sku_id INTO :8
            """, [item["sku_type"], item["sku_subtype"], item["sku_dim"] or "-",
                  item["sku_quantity"], item["sku_cost_price"], item["sku_desc"],
                  item["sku_units"], sku_id_var])
            new_sku_id = sku_id_var.getvalue()[0]
            cursor.execute("""
                UPDATE purchase_order_items SET arrived=1, inventory_sku_id=:1 WHERE poi_id=:2
            """, [new_sku_id, poi_id])
        elif not arrived and item["arrived"] and item["inventory_sku_id"]:
            # Check if removing won't go negative
            sku_id = item["inventory_sku_id"]
            cursor.execute("SELECT sku_units FROM inventory WHERE sku_id = :1", [sku_id])
            inv_row = cursor.fetchone()
            if not inv_row:
                # Inventory row already deleted, just clear the flag
                cursor.execute("UPDATE purchase_order_items SET arrived=0, inventory_sku_id=NULL WHERE poi_id=:1", [poi_id])
            else:
                current_units = int(inv_row[0] or 0)
                if current_units - item["sku_units"] < 0:
                    raise HTTPException(status_code=400, detail="Cannot revert: inventory would go negative")
                elif current_units - item["sku_units"] == 0:
                    cursor.execute("DELETE FROM inventory WHERE sku_id = :1", [sku_id])
                else:
                    cursor.execute("""
                        UPDATE inventory SET sku_units = sku_units - :1 WHERE sku_id = :2
                    """, [item["sku_units"], sku_id])
                cursor.execute("UPDATE purchase_order_items SET arrived=0, inventory_sku_id=NULL WHERE poi_id=:1", [poi_id])

        # Update PO status
        po_id = item["po_id"]
        cursor.execute("SELECT COUNT(*), SUM(arrived) FROM purchase_order_items WHERE po_id=:1", [po_id])
        total, arrived_count = cursor.fetchone()
        total = int(total or 0)
        arrived_count = int(arrived_count or 0)
        if arrived_count == 0:
            new_status = "pending"
        elif arrived_count >= total:
            new_status = "completed"
        else:
            new_status = "partial"
        cursor.execute("UPDATE purchase_orders SET status=:1 WHERE po_id=:2", [new_status, po_id])

        conn.commit()
        return {"status": new_status}
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
