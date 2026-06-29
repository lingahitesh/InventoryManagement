from backend.database.db import get_db
import oracledb as db

KEYS = ["sku_id", "sku_type", "sku_subtype", "sku_dim",
        "sku_quantity", "sku_cost_price", "sku_desc", "sku_units",
        "tracking_id", "entry_date", "location"]


def row_to_dict(row):
    d = dict(zip(KEYS, row))
    if d["entry_date"] and hasattr(d["entry_date"], "isoformat"):
        d["entry_date"] = d["entry_date"].isoformat(timespec="seconds")
    return d


###############################
# INSERT
###############################

def add_inventory(sku_type, sku_subtype, sku_dim, sku_quantity,
                  sku_cost_price, sku_desc, sku_units,
                  tracking_id=None, entry_date=None, location="M-Gram"):
    from datetime import datetime
    resolved_dt = entry_date if entry_date else datetime.now()
    conn = get_db()
    cursor = conn.cursor()
    sku_id_var = cursor.var(int)
    cursor.execute("""
        INSERT INTO inventory
            (sku_id, sku_type, sku_subtype, sku_dim, sku_quantity,
             sku_cost_price, sku_desc, sku_units, tracking_id, entry_date, location)
        VALUES (inventory_seq.NEXTVAL, :1, :2, :3, :4, :5, :6, :7, :8, :9, :10)
        RETURNING sku_id INTO :11
    """, [sku_type, sku_subtype, sku_dim, sku_quantity,
          sku_cost_price, sku_desc, sku_units, tracking_id, resolved_dt, location, sku_id_var])
    conn.commit()
    new_id = sku_id_var.getvalue()[0]
    cursor.close()
    conn.close()
    return new_id


###############################
# UPDATE
###############################

def update_inventory(sku_id, sku_type, sku_subtype, sku_dim, sku_quantity,
                     sku_cost_price, sku_desc, sku_units,
                     tracking_id=None, entry_date=None, location="M-Gram"):
    conn = get_db()
    cursor = conn.cursor()
    if entry_date is not None:
        cursor.execute("""
            UPDATE inventory
            SET sku_type=:1, sku_subtype=:2, sku_dim=:3, sku_quantity=:4,
                sku_cost_price=:5, sku_desc=:6, sku_units=:7, tracking_id=:8, entry_date=:9, location=:10
            WHERE sku_id=:11
        """, [sku_type, sku_subtype, sku_dim, sku_quantity,
              sku_cost_price, sku_desc, sku_units, tracking_id, entry_date, location, sku_id])
    else:
        cursor.execute("""
            UPDATE inventory
            SET sku_type=:1, sku_subtype=:2, sku_dim=:3, sku_quantity=:4,
                sku_cost_price=:5, sku_desc=:6, sku_units=:7, tracking_id=:8, location=:9
            WHERE sku_id=:10
        """, [sku_type, sku_subtype, sku_dim, sku_quantity,
              sku_cost_price, sku_desc, sku_units, tracking_id, location, sku_id])
    rows = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows


###############################
# DELETE
###############################

def delete_inventory(sku_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM inventory WHERE sku_id=:1", [sku_id])
    rows = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows


###############################
# FETCH ALL
###############################

def get_inventory():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT sku_id, sku_type, sku_subtype, sku_dim,
               sku_quantity, sku_cost_price, sku_desc, sku_units,
               tracking_id, entry_date, location
        FROM inventory ORDER BY sku_id
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [row_to_dict(r) for r in rows]


###############################
# SEARCH — supports LIKE for type/subtype/dim, exact for tracking_id,
#          range for cost_price and entry_date
###############################

def search_inventory(sku_type=None, sku_subtype=None, sku_dim=None,
                     tracking_id=None,
                     cost_price_min=None, cost_price_max=None,
                     date_from=None, date_to=None):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT sku_id, sku_type, sku_subtype, sku_dim,
               sku_quantity, sku_cost_price, sku_desc, sku_units,
               tracking_id, entry_date, location
        FROM inventory WHERE 1=1
    """
    params = []
    if sku_type:
        query += f" AND UPPER(sku_type) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{sku_type}%")
    if sku_subtype:
        query += f" AND UPPER(sku_subtype) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{sku_subtype}%")
    if sku_dim:
        query += f" AND UPPER(sku_dim) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{sku_dim}%")
    if tracking_id:
        query += f" AND UPPER(tracking_id) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{tracking_id}%")
    if cost_price_min is not None:
        query += f" AND sku_cost_price >= :{len(params)+1}"
        params.append(cost_price_min)
    if cost_price_max is not None:
        query += f" AND sku_cost_price <= :{len(params)+1}"
        params.append(cost_price_max)
    if date_from:
        query += f" AND entry_date >= :{len(params)+1}"
        params.append(date_from)
    if date_to:
        query += f" AND entry_date < :{len(params)+1}"
        # add 1 day so date_to is inclusive
        from datetime import datetime, timedelta
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            params.append(dt)
        except ValueError:
            params.append(date_to)
    query += " ORDER BY sku_id"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [row_to_dict(r) for r in rows]


###############################
# SUMMARY — groups by type+subtype+dim, same filters as search
###############################

def get_inventory_summary(sku_type=None, sku_subtype=None, sku_dim=None,
                           tracking_id=None,
                           cost_price_min=None, cost_price_max=None,
                           date_from=None, date_to=None):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT sku_type, sku_subtype, sku_dim,
               SUM(sku_quantity*sku_units) AS total_quantity,
               COUNT(*) AS batch_count
        FROM inventory WHERE 1=1
    """
    params = []
    if sku_type:
        query += f" AND UPPER(sku_type) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{sku_type}%")
    if sku_subtype:
        query += f" AND UPPER(sku_subtype) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{sku_subtype}%")
    if sku_dim:
        query += f" AND UPPER(sku_dim) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{sku_dim}%")
    if tracking_id:
        query += f" AND UPPER(tracking_id) LIKE UPPER(:{len(params)+1})"
        params.append(f"%{tracking_id}%")
    if cost_price_min is not None:
        query += f" AND sku_cost_price >= :{len(params)+1}"
        params.append(cost_price_min)
    if cost_price_max is not None:
        query += f" AND sku_cost_price <= :{len(params)+1}"
        params.append(cost_price_max)
    if date_from:
        query += f" AND entry_date >= :{len(params)+1}"
        params.append(date_from)
    if date_to:
        query += f" AND entry_date < :{len(params)+1}"
        from datetime import datetime, timedelta
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            params.append(dt)
        except ValueError:
            params.append(date_to)
    query += " GROUP BY sku_type, sku_subtype, sku_dim ORDER BY sku_type, sku_subtype, sku_dim"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["sku_type", "sku_subtype", "sku_dim", "total_quantity", "batch_count"]
    return [dict(zip(keys, r)) for r in rows]


###############################
# AVAILABILITY — exact match, sku_id ASC priority
###############################

def get_matching_skus(sku_type, sku_subtype, sku_dim):
    conn = get_db()
    cursor = conn.cursor()

    # For dimensionless products or exact match fallback
    if sku_dim == '-' or not sku_dim:
        cursor.execute("""
            SELECT sku_id, sku_type, sku_subtype, sku_dim,
                   sku_quantity, sku_cost_price, sku_desc, sku_units,
                   tracking_id, entry_date, location
            FROM inventory
            WHERE sku_type=:1 AND sku_subtype=:2 AND sku_dim=:3 AND sku_units > 0
            ORDER BY sku_id ASC
        """, [sku_type, sku_subtype, sku_dim])
    else:
        # Extract leading numeric part for ±15 range match
        import re
        num_match = re.match(r'(\d+)', sku_dim)
        if num_match:
            dim_val = int(num_match.group(1))
            dim_low = dim_val
            dim_high = dim_val + 15
            # Match where the leading number of sku_dim is within range
            cursor.execute("""
                SELECT sku_id, sku_type, sku_subtype, sku_dim,
                       sku_quantity, sku_cost_price, sku_desc, sku_units,
                       tracking_id, entry_date, location
                FROM inventory
                WHERE sku_type=:1 AND sku_subtype=:2 AND sku_units > 0
                  AND TO_NUMBER(REGEXP_SUBSTR(sku_dim, '^\d+')) BETWEEN :3 AND :4
                ORDER BY sku_id ASC
            """, [sku_type, sku_subtype, dim_low, dim_high])
        else:
            cursor.execute("""
                SELECT sku_id, sku_type, sku_subtype, sku_dim,
                       sku_quantity, sku_cost_price, sku_desc, sku_units,
                       tracking_id, entry_date, location
                FROM inventory
                WHERE sku_type=:1 AND sku_subtype=:2 AND sku_dim=:3 AND sku_units > 0
                ORDER BY sku_id ASC
            """, [sku_type, sku_subtype, sku_dim])

    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [row_to_dict(r) for r in rows]


###############################
# DEDUCT — only reduce sku_units by units_taken
# sku_quantity is only zeroed when sku_units reaches 0
# Example: 300 kg, 2 units → sell 1 → 300 kg, 1 unit
#          100 kg, 1 unit  → sell 1 → 0 kg,   0 units
###############################

def deduct_sku_quantity(conn, cursor, sku_id, units_taken, kg_to_deduct=None):
    """Decrease sku_units by units_taken. Zero out sku_quantity only when units reach 0."""
    cursor.execute("""
        UPDATE inventory
        SET sku_units    = GREATEST(sku_units - :1, 0),
            sku_quantity = CASE WHEN sku_units - :2 <= 0 THEN 0 ELSE sku_quantity END
        WHERE sku_id = :3
    """, [units_taken, units_taken, sku_id])


###############################
# NEXT SKU ID (preview without consuming)
###############################

def get_next_sku_id():
    """Returns the next sku_id that will be generated (without consuming the sequence)."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT LAST_NUMBER FROM USER_SEQUENCES WHERE SEQUENCE_NAME = 'INVENTORY_SEQ'
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    row = cursor.fetchone()
    cursor.close()
    conn.close()
    return row[0] if row else 1


###############################
# PRICE HISTORY — for the info tooltip in Place Order
###############################

def get_price_history(sku_type, sku_subtype, sku_dim, customer_id=None):
    """
    Returns:
    - min, max, avg selling price over last 3 months for this type/subtype (irrespective of dim)
    - last 3 selling prices for a specific customer (irrespective of dim)
    """
    from datetime import datetime, timedelta
    three_months_ago = datetime.now() - timedelta(days=90)

    conn = get_db()
    cursor = conn.cursor()

    # Global stats: min/max/avg selling_price over last 3 months (no dim filter)
    cursor.execute("""
        SELECT MIN(oi.selling_price), MAX(oi.selling_price), AVG(oi.selling_price)
        FROM order_items oi
        JOIN orders o ON o.order_id = oi.order_id
        JOIN inventory i ON i.sku_id = oi.sku_id
        WHERE i.sku_type = :1 AND i.sku_subtype = :2
          AND o.order_date >= :3
    """, [sku_type, sku_subtype, three_months_ago])
    row = cursor.fetchone()
    stats = {
        "min_price": round(float(row[0]), 2) if row and row[0] else None,
        "max_price": round(float(row[1]), 2) if row and row[1] else None,
        "avg_price": round(float(row[2]), 2) if row and row[2] else None,
    }

    # Last 3 prices for the specific customer (no dim filter)
    customer_prices = []
    if customer_id:
        cursor.execute("""
            SELECT oi.selling_price, i.sku_cost_price, o.order_date
            FROM order_items oi
            JOIN orders o ON o.order_id = oi.order_id
            JOIN inventory i ON i.sku_id = oi.sku_id
            WHERE i.sku_type = :1 AND i.sku_subtype = :2
              AND o.customer_id = :3
            ORDER BY o.order_date DESC
            FETCH FIRST 3 ROWS ONLY
        """, [sku_type, sku_subtype, customer_id])
        for sp, cp, dt in cursor.fetchall():
            customer_prices.append({
                "selling_price": round(float(sp), 2) if sp else None,
                "cost_price": round(float(cp), 2) if cp else None,
                "date": dt.isoformat()[:10] if dt and hasattr(dt, "isoformat") else str(dt)[:10] if dt else None,
            })

    cursor.close()
    conn.close()

    return {"stats": stats, "customer_prices": customer_prices}
