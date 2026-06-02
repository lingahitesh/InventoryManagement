from database.db import get_db

###############################
#INSERTING RECORDS
###############################

def add_inventory(
    sku_type,
    sku_subtype,
    sku_dim,
    sku_quantity,
    sku_cost_price,
    sku_desc,
    sku_units
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO inventory
        (
            sku_id,
            sku_type,
            sku_subtype,
            sku_dim,
            sku_quantity,
            sku_cost_price,
            sku_desc,
            sku_units
        )
        VALUES
        (
            inventory_seq.NEXTVAL,
            :1,
            :2,
            :3,
            :4,
            :5,
            :6,
            :7
        )
    """,
    [
        sku_type,
        sku_subtype,
        sku_dim,
        sku_quantity,
        sku_cost_price,
        sku_desc,
        sku_units
    ])
    conn.commit()
    cursor.close()
    conn.close()

###############################
#FETCHING ALL RECORDS
###############################

def get_inventory():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT *
        FROM inventory
        ORDER BY sku_id
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows

###############################
#SEARCHING RECORDS
###############################

def search_inventory(
    sku_type=None,
    sku_subtype=None,
    sku_dim=None
):
    conn = get_db()
    cursor = conn.cursor()
    query = """
        SELECT *
        FROM inventory
        WHERE 1=1
    """
    params = []
    if sku_type:
        query += " AND sku_type = :1"
        params.append(sku_type)
    if sku_subtype:
        query += f" AND sku_subtype = :{len(params)+1}"
        params.append(sku_subtype)
    if sku_dim:
        query += f" AND sku_dim = :{len(params)+1}"
        params.append(sku_dim)
    cursor.execute(query, params)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows