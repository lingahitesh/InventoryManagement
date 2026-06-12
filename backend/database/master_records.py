from db import get_db
import csv

def loader():
    conn = get_db()
    cursor = conn.cursor()
    with open("migrations/products.csv", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        data = [
            (
                row["PRODUCT_TYPE"],
                row["PRODUCT_CODE"] or None,
                row["PRODUCT_SUBTYPE"],
                row["HSN_CODE"]
            )
            for row in reader
        ]
    cursor.executemany("""
        INSERT INTO PRODUCT_MASTER
        (
            PRODUCT_TYPE,
            PRODUCT_CODE,
            PRODUCT_SUBTYPE,
            HSN_CODE
        )
        VALUES
        (
            :1,
            :2,
            :3,
            :4
        )
    """, data)

    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
   loader()