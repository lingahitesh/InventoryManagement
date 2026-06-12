import sys
from pathlib import Path
import os
#sys.path.append(str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import oracledb as db
from db import get_db

def init_setup():
    conn = get_db()
    cursor = conn.cursor()
    try:
        sql_file = os.path.join(os.path.dirname(__file__), "007_products_table.sql")
        with open(sql_file, "r", encoding="utf-8") as f:
            sql = f.read()
        statements = [stmt.strip() for stmt in sql.split(";") if stmt.strip()]
        for statement in statements:
            cursor.execute(statement)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    conn.commit()
    cursor.close()
    conn.close()

if __name__ == "__main__":
    init_setup()