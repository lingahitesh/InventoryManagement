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
                int(row["HSN_CODE"]),
                int(row["HAS_DIMENSIONS"])
            )
            for row in reader
        ]
    for row in data:
        try:
            cursor.execute("""
                INSERT INTO PRODUCT_MASTER
                (
                    PRODUCT_TYPE,
                    PRODUCT_CODE,
                    PRODUCT_SUBTYPE,
                    HSN_CODE,
                    HAS_DIMENSIONS
                )
                VALUES (:1,:2,:3,:4,:5)
            """, row)
        except Exception as e:
            print("FAILED:", row)
            print(e)
            raise

    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
   loader()