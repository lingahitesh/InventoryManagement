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
    return rows


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
