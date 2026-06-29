-- Migration 022: Users and Privileges system
-- Roles: root (1 only), admin, normal

CREATE TABLE app_users (
    user_id        NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    fname          VARCHAR2(100) NOT NULL,
    mname          VARCHAR2(100),
    lname          VARCHAR2(100) NOT NULL,
    contact        VARCHAR2(20) NOT NULL,
    email          VARCHAR2(200) NOT NULL,
    password_hash  VARCHAR2(256) NOT NULL,
    role           VARCHAR2(20) NOT NULL,  -- root, admin, normal
    created_by     NUMBER,                 -- user_id of creator (NULL for root)
    created_at     TIMESTAMP DEFAULT SYSTIMESTAMP,
    is_active      NUMBER(1) DEFAULT 1,
    reset_code     VARCHAR2(10),
    reset_code_expiry TIMESTAMP,
    CONSTRAINT chk_role CHECK (role IN ('root', 'admin', 'normal')),
    CONSTRAINT fk_created_by FOREIGN KEY (created_by) REFERENCES app_users(user_id)
);

-- Privileges for normal users (root and admin have all privileges)
CREATE TABLE user_privileges (
    priv_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    NUMBER NOT NULL,
    module     VARCHAR2(50) NOT NULL,   -- inventory, customer, sales_order, purchase_order, dispatch, payment
    can_view   NUMBER(1) DEFAULT 0,
    can_create NUMBER(1) DEFAULT 0,
    can_edit   NUMBER(1) DEFAULT 0,
    can_delete NUMBER(1) DEFAULT 0,
    can_generate NUMBER(1) DEFAULT 0,  -- for invoices
    can_status NUMBER(1) DEFAULT 0,    -- for ready/confirm/arrive/dispatch status changes
    CONSTRAINT fk_priv_user FOREIGN KEY (user_id) REFERENCES app_users(user_id) ON DELETE CASCADE
);

-- Insert root user: Hitesh Linga
-- Password: Psah1234 (hashed with sha256)
INSERT INTO app_users (fname, mname, lname, contact, email, password_hash, role, created_by)
VALUES ('Hitesh', NULL, 'Linga', '6290048551', 'happylinga005@gmail.com',
        'bcf42939c3007fabb4b1ff30802e2003fc0ac0b7da36eb1ac0343a3ef0bfad14', 'root', NULL);

COMMIT;
