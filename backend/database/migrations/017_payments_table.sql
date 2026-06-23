-- Migration 017: Create payments table
-- Tracks payments received from customers.
-- Each order creates debit (amt_due = order amount).
-- Each payment record logs amt_paid (credit).

CREATE TABLE payments (
    payment_id    NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id   NUMBER NOT NULL,
    order_id      NUMBER,              -- optional: link to specific order
    amt_paid      NUMBER(12,2) NOT NULL,
    payment_date  DATE DEFAULT SYSDATE NOT NULL,
    notes         VARCHAR2(500),
    CONSTRAINT fk_payment_customer FOREIGN KEY (customer_id) REFERENCES customers(customer_id),
    CONSTRAINT fk_payment_order    FOREIGN KEY (order_id)    REFERENCES orders(order_id)
);
