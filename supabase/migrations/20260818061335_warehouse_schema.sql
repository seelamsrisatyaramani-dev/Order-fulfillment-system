/*
# Smart Warehouse Operations — Core Schema

1. Overview
This migration creates the core tables for a smart warehouse operations platform:
products (inventory), orders, order_items, exceptions, and allocation_log.
The app is single-tenant (no sign-in), so all policies allow anon + authenticated CRUD.

2. Tables
- `products`: SKUs in the warehouse with stock levels, reorder thresholds, and location.
  - id (uuid pk), sku (text unique), name (text), category (text),
  - on_hand (int, current physical stock), available (int, on_hand minus allocated),
  - allocated (int, units reserved for orders), reorder_point (int), reorder_qty (int),
  - location (text, e.g. A-12-03), unit_cost (numeric), status (text: in_stock/low_stock/out_of_stock),
  - updated_at (timestamptz).
- `orders`: customer orders moving through the fulfillment lifecycle.
  - id (uuid pk), order_number (text unique), customer_name (text), priority (text: critical/high/standard/low),
  - status (text: created/pending_allocation/allocated/picking/packing/quality_check/dispatched/cancelled/on_hold),
  - requested_ship_date (date), created_at (timestamptz), updated_at (timestamptz),
  - total_value (numeric), notes (text).
- `order_items`: line items per order, linked to products.
  - id (uuid pk), order_id (fk orders), product_id (fk products),
  - quantity (int requested), allocated_qty (int), picked_qty (int), packed_qty (int),
  - status (text: pending/allocated/picked/packed/short/damaged).
- `exceptions`: operational exceptions (damaged, missing, short stock, quality fail).
  - id (uuid pk), order_id (fk orders, nullable), product_id (fk products, nullable),
  - type (text: damaged/missing/short_stock/quality_fail/overstock),
  - severity (text: info/warning/critical), status (text: open/resolved/escalated),
  - description (text), resolution (text), created_at, resolved_at.
- `allocation_log`: audit trail of allocation decisions made by the engine.
  - id (uuid pk), order_id (fk orders), product_id (fk products),
  - requested_qty (int), allocated_qty (int), action (text: full/partial/deferred/steal),
  - reason (text), created_at (timestamptz).
- `activity_log`: timeline events for orders (status transitions, decisions).
  - id (uuid pk), order_id (fk orders), event (text), detail (text), created_at (timestamptz).

3. Security
- RLS enabled on every table.
- Policies allow anon + authenticated full CRUD (single-tenant, intentionally shared data).
*/

-- Products
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text UNIQUE NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'General',
  on_hand integer NOT NULL DEFAULT 0,
  allocated integer NOT NULL DEFAULT 0,
  available integer GENERATED ALWAYS AS (on_hand - allocated) STORED,
  reorder_point integer NOT NULL DEFAULT 10,
  reorder_qty integer NOT NULL DEFAULT 50,
  location text NOT NULL DEFAULT 'A-00-00',
  unit_cost numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'in_stock',
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_products_s" ON products;
CREATE POLICY "anon_crud_products_s" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_products_i" ON products;
CREATE POLICY "anon_crud_products_i" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_products_u" ON products;
CREATE POLICY "anon_crud_products_u" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_products_d" ON products;
CREATE POLICY "anon_crud_products_d" ON products FOR DELETE TO anon, authenticated USING (true);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  priority text NOT NULL DEFAULT 'standard',
  status text NOT NULL DEFAULT 'created',
  requested_ship_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  total_value numeric(12,2) NOT NULL DEFAULT 0,
  notes text
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_orders_s" ON orders;
CREATE POLICY "anon_crud_orders_s" ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_orders_i" ON orders;
CREATE POLICY "anon_crud_orders_i" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_orders_u" ON orders;
CREATE POLICY "anon_crud_orders_u" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_orders_d" ON orders;
CREATE POLICY "anon_crud_orders_d" ON orders FOR DELETE TO anon, authenticated USING (true);

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity integer NOT NULL,
  allocated_qty integer NOT NULL DEFAULT 0,
  picked_qty integer NOT NULL DEFAULT 0,
  packed_qty integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_items_s" ON order_items;
CREATE POLICY "anon_crud_items_s" ON order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_items_i" ON order_items;
CREATE POLICY "anon_crud_items_i" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_items_u" ON order_items;
CREATE POLICY "anon_crud_items_u" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_items_d" ON order_items;
CREATE POLICY "anon_crud_items_d" ON order_items FOR DELETE TO anon, authenticated USING (true);

-- Exceptions
CREATE TABLE IF NOT EXISTS exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  status text NOT NULL DEFAULT 'open',
  description text NOT NULL,
  resolution text,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE exceptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_exc_s" ON exceptions;
CREATE POLICY "anon_crud_exc_s" ON exceptions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_exc_i" ON exceptions;
CREATE POLICY "anon_crud_exc_i" ON exceptions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_exc_u" ON exceptions;
CREATE POLICY "anon_crud_exc_u" ON exceptions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_exc_d" ON exceptions;
CREATE POLICY "anon_crud_exc_d" ON exceptions FOR DELETE TO anon, authenticated USING (true);

-- Allocation log
CREATE TABLE IF NOT EXISTS allocation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  requested_qty integer NOT NULL,
  allocated_qty integer NOT NULL,
  action text NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE allocation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_allog_s" ON allocation_log;
CREATE POLICY "anon_crud_allog_s" ON allocation_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_allog_i" ON allocation_log;
CREATE POLICY "anon_crud_allog_i" ON allocation_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_alog_u" ON allocation_log;
CREATE POLICY "anon_crud_alog_u" ON allocation_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_alog_d" ON allocation_log;
CREATE POLICY "anon_crud_alog_d" ON allocation_log FOR DELETE TO anon, authenticated USING (true);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  detail text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_crud_act_s" ON activity_log;
CREATE POLICY "anon_crud_act_s" ON activity_log FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_crud_act_i" ON activity_log;
CREATE POLICY "anon_crud_act_i" ON activity_log FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_act_u" ON activity_log;
CREATE POLICY "anon_crud_act_u" ON activity_log FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_crud_act_d" ON activity_log;
CREATE POLICY "anon_crud_act_d" ON activity_log FOR DELETE TO anon, authenticated USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_priority ON orders(priority);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_exceptions_status ON exceptions(status);
CREATE INDEX IF NOT EXISTS idx_activity_log_order ON activity_log(order_id);

-- updated_at triggers
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_products_touch ON products;
CREATE TRIGGER trg_products_touch BEFORE UPDATE ON products
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_orders_touch ON orders;
CREATE TRIGGER trg_orders_touch BEFORE UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
