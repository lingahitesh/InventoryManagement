from backend.database.db import get_db


def add_customer(fname, mname, lname, contact, email, address, pincode, state, city, gst):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO customers
        (customer_id, fname, mname, lname, contact, email, address, pincode, state, city, gst)
        VALUES
        (customer_seq.NEXTVAL, :1, :2, :3, :4, :5, :6, :7, :8, :9, :10)
    """, [fname, mname, lname, contact, email, address, pincode, state, city, gst])
    conn.commit()
    cursor.close()
    conn.close()


def get_customers():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers ORDER BY customer_id")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = [
        "customer_id", "fname", "mname", "lname",
        "contact", "email", "address", "pincode",
        "city", "state", "gst"
    ]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["customer_id"] is not None:
            d["customer_id"] = int(d["customer_id"])
        if d["pincode"] is not None:
            d["pincode"] = int(d["pincode"])
        result.append(d)
    return result


def update_customer(customer_id, fname, mname, lname, contact, email, address, pincode, state, city, gst):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE customers
        SET fname=:1, mname=:2, lname=:3, contact=:4, email=:5,
            address=:6, pincode=:7, state=:8, city=:9, gst=:10
        WHERE customer_id=:11
    """, [fname, mname, lname, contact, email, address, pincode, state, city, gst, customer_id])
    rows_affected = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows_affected


def delete_customer(customer_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM customers WHERE customer_id = :1", [customer_id])
    rows_affected = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows_affected


# ── Shipping Addresses ────────────────────────────────────

def get_shipping_addresses(customer_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT address_id, customer_id, address, pincode, city, state, is_default
        FROM customer_shipping_addresses
        WHERE customer_id = :1
        ORDER BY is_default DESC, address_id
    """, [customer_id])
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    keys = ["address_id", "customer_id", "address", "pincode", "city", "state", "is_default"]
    result = []
    for row in rows:
        d = dict(zip(keys, row))
        if d["customer_id"] is not None: d["customer_id"] = int(d["customer_id"])
        if d["address_id"] is not None: d["address_id"] = int(d["address_id"])
        if d["pincode"] is not None: d["pincode"] = int(d["pincode"])
        d["is_default"] = bool(d["is_default"])
        result.append(d)
    return result


def add_shipping_address(customer_id, address, pincode, city, state, is_default=False):
    conn = get_db()
    cursor = conn.cursor()
    if is_default:
        # Unset any existing default for this customer
        cursor.execute("UPDATE customer_shipping_addresses SET is_default=0 WHERE customer_id=:1", [customer_id])
    cursor.execute("""
        INSERT INTO customer_shipping_addresses (customer_id, address, pincode, city, state, is_default)
        VALUES (:1, :2, :3, :4, :5, :6)
    """, [customer_id, address, pincode, city, state, 1 if is_default else 0])
    conn.commit()
    cursor.close()
    conn.close()


def delete_shipping_address(address_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM customer_shipping_addresses WHERE address_id = :1", [address_id])
    rows = cursor.rowcount
    conn.commit()
    cursor.close()
    conn.close()
    return rows


def set_customer_shipping_addresses(customer_id, addresses):
    """Replace all shipping addresses for a customer."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM customer_shipping_addresses WHERE customer_id = :1", [customer_id])
    for addr in addresses:
        cursor.execute("""
            INSERT INTO customer_shipping_addresses (customer_id, address, pincode, city, state, is_default)
            VALUES (:1, :2, :3, :4, :5, :6)
        """, [customer_id, addr["address"], addr.get("pincode"), addr.get("city"),
              addr.get("state"), 1 if addr.get("is_default") else 0])
    conn.commit()
    cursor.close()
    conn.close()
