import oracledb as db

###############################
# CONNECTION
###############################

def get_db():
    return db.connect(
        user="InventoryManagement",
        password="12345678",
        host="localhost",
        port=1521,
        service_name="xepdb1"
    )

###############################
# DATABASE INITIALIZATION
###############################

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    try:

        ###############################
        # INVENTORY
        ###############################

        cursor.execute("""
            CREATE TABLE inventory
            (
                sku_id NUMBER PRIMARY KEY,
                sku_type VARCHAR2(50) NOT NULL,
                sku_subtype VARCHAR2(50),
                sku_dim VARCHAR2(50) NOT NULL,
                sku_quantity NUMBER NOT NULL,
                sku_cost_price NUMBER(9,2) NOT NULL,
                sku_desc VARCHAR2(100),
                sku_units NUMBER(2)
            )
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    try:
        cursor.execute("""
            CREATE SEQUENCE inventory_seq
            START WITH 1
            INCREMENT BY 1 NOCACHE NOCYCLE
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    try:
        ###############################
        # CUSTOMERS
        ###############################
        cursor.execute("""
            CREATE TABLE customers
            (
                customer_id NUMBER PRIMARY KEY,
                fname VARCHAR2(100) NOT NULL,
                mname VARCHAR2(100),
                lname VARCHAR2(100) NOT NULL,
                contact VARCHAR2(13) NOT NULL,
                email VARCHAR2(255),
                address VARCHAR2(200),
                pincode NUMBER(6),
                city VARCHAR2(200),
                state VARCHAR2(200),
                gst VARCHAR2(15)
            )
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    try:
        cursor.execute("""
            CREATE SEQUENCE customer_seq
            START WITH 1
            INCREMENT BY 1 NOCACHE NOCYCLE
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    try:
        ###############################
        # ORDERS
        ###############################
        cursor.execute("""
            CREATE TABLE orders
            (
                order_id NUMBER PRIMARY KEY,
                customer_id NUMBER NOT NULL,
                order_date DATE DEFAULT SYSDATE,
                total_amount NUMBER(12,2),
                CONSTRAINT fk_orders_customer
                FOREIGN KEY(customer_id)
                REFERENCES customers(customer_id)
            )
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    try:
        cursor.execute("""
            CREATE SEQUENCE order_seq
            START WITH 1
            INCREMENT BY 1 NOCACHE NOCYCLE
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    try:
        ###############################
        # ORDER ITEMS
        ###############################
        cursor.execute("""
            CREATE TABLE order_items
            (
                item_id NUMBER PRIMARY KEY,
                order_id NUMBER NOT NULL,
                sku_id NUMBER NOT NULL,
                quantity NUMBER NOT NULL,
                selling_price NUMBER(9,2),
                CONSTRAINT fk_order_items_order
                FOREIGN KEY(order_id)
                REFERENCES orders(order_id),
                CONSTRAINT fk_order_items_inventory
                FOREIGN KEY(sku_id)
                REFERENCES inventory(sku_id)
            )
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    try:
        cursor.execute("""
            CREATE SEQUENCE order_item_seq
            START WITH 1
            INCREMENT BY 1 NOCACHE NOCYCLE
        """)
    except db.DatabaseError as e:
        error, = e.args
        if error.code != 955:
            raise
    conn.commit()
    cursor.close()
    conn.close()