import os
import oracledb as db
from dotenv import load_dotenv
from pathlib import Path

# Load .env from backend directory
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

###############################
# CONNECTION
###############################

def get_db():
    return db.connect(
        user=os.getenv("DB_USER", "InventoryManagement"),
        password=os.getenv("DB_PASSWORD", "12345678"),
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "1521")),
        service_name=os.getenv("DB_SERVICE", "xepdb1")
    )


###############################
# DATABASE INITIALIZATION
###############################

def init_db():
    """Verify DB connectivity. Tables are managed via migrations."""
    conn = get_db()
    conn.close()
