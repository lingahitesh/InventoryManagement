from database.db import get_db

def add_customer(
    fname,
    mname,
    lname,
    contact,
    email,
    address,
    pincode,
    state,
    city,
    gst
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO customers
        (
            customer_id,
            fname,
            mname,
            lname,
            contact,
            email,
            address,
            pincode,
            state,
            city,
            gst
        )
        VALUES
        (
            customer_seq.NEXTVAL,
            :1,
            :2,
            :3,
            :4,
            :5,
            :6,
            :7,
            :8,
            :9,
            :10
        )
    """,
    [
        fname,
        mname,
        lname,
        contact,
        email,
        address,
        pincode,
        state,
        city,
        gst
    ])
    conn.commit()
    cursor.close()
    conn.close()

def get_customers():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT *
        FROM customers
        ORDER BY customer_id
    """)
    rows = cursor.fetchall()
    cursor.close()
    conn.close()
    return rows