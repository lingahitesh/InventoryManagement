-- Migration 002: Disable sequence caching to prevent ID gaps on server restart
-- Run once against the database

ALTER SEQUENCE inventory_seq  NOCACHE;
ALTER SEQUENCE customer_seq   NOCACHE;
ALTER SEQUENCE order_seq      NOCACHE;
ALTER SEQUENCE order_item_seq NOCACHE;
