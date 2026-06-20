"""
Reads product types and subtypes from PRODUCT_MASTER table in Oracle.
Subtype display = "CODE - SUBTYPE" when code exists, else just "SUBTYPE".
"""
from backend.database.db import get_db


def get_product_types():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT PRODUCT_TYPE, MAX(HAS_DIMENSIONS) AS HAS_DIMENSIONS
        FROM PRODUCT_MASTER
        GROUP BY PRODUCT_TYPE
        ORDER BY PRODUCT_TYPE
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [{"type": r[0].strip(), "has_dimensions": int(r[1]) == 1} for r in rows]


def get_product_subtypes(product_type=None):
    conn = get_db()
    cursor = conn.cursor()
    if product_type:
        cursor.execute("""
            SELECT PRODUCT_CODE, PRODUCT_SUBTYPE
            FROM PRODUCT_MASTER
            WHERE PRODUCT_TYPE = :1
            ORDER BY PRODUCT_SUBTYPE
        """, [product_type])
    else:
        cursor.execute("SELECT PRODUCT_CODE, PRODUCT_SUBTYPE FROM PRODUCT_MASTER ORDER BY PRODUCT_SUBTYPE")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    result = []
    for code, subtype in rows:
        code = (code or "").strip()
        subtype = (subtype or "").strip()
        display = f"{code} - {subtype}" if code else subtype
        result.append({"product_code": code, "display_subtype": display, "raw_subtype": subtype})
    return result
