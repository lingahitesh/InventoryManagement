"""
Reads product types and subtypes from PRODUCT_MASTER table in Oracle.
Subtype display = "CODE - SUBTYPE" when code exists, else just "SUBTYPE".
"""
from backend.database.db import get_db


def get_product_types():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT PRODUCT_TYPE FROM PRODUCT_MASTER ORDER BY PRODUCT_TYPE")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return [r[0] for r in rows]


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
        display = f"{code} - {subtype}" if code else subtype
        result.append({"product_code": code or "", "display_subtype": display})
    return result
