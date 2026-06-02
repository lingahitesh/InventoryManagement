from database.db import get_db

def create_order(
    customer_id,
    date,
):
    conn = get_db()
    cursor = conn.cursor()
    order_id = cursor.var(int)
    cursor.execute("""
        INSERT INTO orders
        (
            order_id,
            customer_id,
            order_date
        )
        VALUES
        (
            order_seq.NEXTVAL,
            :1,
            :2
        )
        RETURNING order_id INTO :3
    """,
    [
        customer_id,
        date,
        order_id
    ])
    conn.commit()
    value = order_id.getvalue()[0]
    cursor.close()
    conn.close()
    return value

def add_order_item(
    order_id,
    sku_id,
    quantity,
    selling_price
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO order_items
        (
            item_id,
            order_id,
            sku_id,
            quantity,
            selling_price
        )
        VALUES
        (
            order_item_seq.NEXTVAL,
            :1,
            :2,
            :3,
            :4
        )
    """,
    [
        order_id,
        sku_id,
        quantity,
        selling_price
    ])
    conn.commit()
    cursor.close()
    conn.close()