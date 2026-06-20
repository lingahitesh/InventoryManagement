import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import oracledb as db
from db import get_db

IGNORED_ERRORS = {
    955,   # ORA-00955: name already used by existing object
    1430,  # ORA-01430: column being added already exists
    2275,  # ORA-02275: such a referential constraint already exists
}

def init_setup():
    conn = get_db()
    cursor = conn.cursor()
    try:
        sql_file = os.path.join(os.path.dirname(__file__), "000_tester_CUSTOMERS.sql")
        with open(sql_file, "r", encoding="utf-8") as f:
            sql = f.read()
        # Remove comment lines
        clean_lines = []
        for line in sql.splitlines():
            stripped = line.strip()
            if stripped.startswith("--"):
                continue
            clean_lines.append(line)
        sql = "\n".join(clean_lines)
        statements = [stmt.strip() for stmt in sql.split(";") if stmt.strip()]
        for i, statement in enumerate(statements, start=1):
            try:
                print(f"\n[{i}/{len(statements)}]")
                print(statement[:200] + ("..." if len(statement) > 200 else ""))
                cursor.execute(statement)
            except db.DatabaseError as e:
                error, = e.args
                if error.code in IGNORED_ERRORS:
                    print(f"Skipped ORA-{error.code}: "f"{error.message}")
                    continue
                print(f"\nFAILED ON STATEMENT {i}\n")
                print(statement)
                raise
        conn.commit()
        print("\nCompleted successfully.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    init_setup()