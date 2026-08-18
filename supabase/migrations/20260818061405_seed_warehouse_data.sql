/*
# Seed Warehouse Data

1. Overview
Populates the warehouse with realistic sample data:
- 12 products across categories (Electronics, Tools, Packaging, Safety, Office)
- 10 orders at various lifecycle stages with order items
- A few open exceptions (damaged, short stock, missing)
- Allocation log entries for already-allocated orders
- Activity log timeline entries

2. Notes
- Uses fixed UUIDs via gen_random_uuid() but deterministic SKUs/order numbers.
- Stock levels intentionally include low-stock and out-of-stock items to exercise alerts.
- Some orders are partially allocated to demonstrate the allocation decision engine.
*/

-- Products
INSERT INTO products (sku, name, category, on_hand, allocated, reorder_point, reorder_qty, location, unit_cost, status) VALUES
('SKU-1001', 'Wireless Barcode Scanner', 'Electronics', 24, 8, 10, 30, 'A-01-04', 189.00, 'in_stock'),
('SKU-1002', 'Industrial Label Printer', 'Electronics', 6, 4, 8, 20, 'A-01-07', 349.00, 'low_stock'),
('SKU-1003', 'Picking Headset Pro', 'Electronics', 0, 0, 5, 15, 'A-01-12', 79.00, 'out_of_stock'),
('SKU-2001', 'Forklift Battery 24V', 'Tools', 12, 2, 4, 8, 'B-02-01', 410.00, 'in_stock'),
('SKU-2002', 'Pallet Jack Wheel Kit', 'Tools', 3, 0, 6, 12, 'B-02-05', 52.00, 'low_stock'),
('SKU-2003', 'Heavy-Duty Tape Dispenser', 'Tools', 40, 5, 10, 25, 'B-02-09', 28.00, 'in_stock'),
('SKU-3001', 'Corrugated Box Medium', 'Packaging', 500, 120, 100, 500, 'C-03-01', 1.20, 'in_stock'),
('SKU-3002', 'Bubble Wrap Roll 500ft', 'Packaging', 18, 6, 20, 40, 'C-03-04', 34.00, 'low_stock'),
('SKU-3003', 'Stretch Pallet Wrap', 'Packaging', 0, 0, 15, 60, 'C-03-08', 22.00, 'out_of_stock'),
('SKU-4001', 'Safety Gloves XL (Box of 12)', 'Safety', 64, 10, 12, 48, 'D-04-02', 45.00, 'in_stock'),
('SKU-4002', 'High-Vis Vest', 'Safety', 9, 3, 10, 30, 'D-04-06', 18.00, 'low_stock'),
('SKU-5001', 'Thermal Label Rolls (Pack of 6)', 'Office', 30, 8, 8, 24, 'E-05-01', 36.00, 'in_stock')
ON CONFLICT (sku) DO NOTHING;

-- Orders
INSERT INTO orders (order_number, customer_name, priority, status, requested_ship_date, total_value, notes) VALUES
('ORD-5001', 'Northgate Retail Co', 'critical', 'pending_allocation', '2026-08-19', 1890.00, 'VIP customer — ship same day'),
('ORD-5002', 'Apex Logistics', 'high', 'pending_allocation', '2026-08-20', 698.00, NULL),
('ORD-5003', 'Metro Distribution', 'standard', 'allocated', '2026-08-22', 1396.00, NULL),
('ORD-5004', 'QuickShip Inc', 'high', 'picking', '2026-08-19', 522.00, 'Rush fulfillment'),
('ORD-5005', 'Harbor Supply', 'standard', 'picking', '2026-08-21', 210.00, NULL),
('ORD-5006', 'BluePeak Wholesale', 'low', 'packing', '2026-08-23', 84.00, NULL),
('ORD-5007', 'Summit Outfitters', 'high', 'packing', '2026-08-20', 414.00, NULL),
('ORD-5008', 'Crestline Stores', 'standard', 'quality_check', '2026-08-21', 324.00, NULL),
('ORD-5009', 'Pioneer Goods', 'critical', 'dispatched', '2026-08-18', 2780.00, 'Dispatched this morning'),
('ORD-5010', 'Lakeside Commerce', 'low', 'on_hold', '2026-08-24', 156.00, 'Awaiting stock replenishment')
ON CONFLICT (order_number) DO NOTHING;

-- Order items (link to products by sku via subquery)
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 10, 0, 0, 0, 'pending' FROM orders o, products p WHERE o.order_number='ORD-5001' AND p.sku='SKU-1001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 2, 0, 0, 0, 'pending' FROM orders o, products p WHERE o.order_number='ORD-5001' AND p.sku='SKU-1002';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 5, 0, 0, 0, 'pending' FROM orders o, products p WHERE o.order_number='ORD-5002' AND p.sku='SKU-2001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 3, 0, 0, 0, 'pending' FROM orders o, products p WHERE o.order_number='ORD-5002' AND p.sku='SKU-4001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 4, 4, 0, 0, 'allocated' FROM orders o, products p WHERE o.order_number='ORD-5003' AND p.sku='SKU-1001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 2, 2, 0, 0, 'allocated' FROM orders o, products p WHERE o.order_number='ORD-5003' AND p.sku='SKU-5001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 3, 3, 3, 0, 'picked' FROM orders o, products p WHERE o.order_number='ORD-5004' AND p.sku='SKU-4001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 6, 6, 6, 0, 'picked' FROM orders o, products p WHERE o.order_number='ORD-5004' AND p.sku='SKU-3001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 2, 2, 2, 2, 'packed' FROM orders o, products p WHERE o.order_number='ORD-5006' AND p.sku='SKU-3001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 1, 1, 1, 1, 'packed' FROM orders o, products p WHERE o.order_number='ORD-5007' AND p.sku='SKU-1002';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 9, 9, 9, 9, 'packed' FROM orders o, products p WHERE o.order_number='ORD-5008' AND p.sku='SKU-4001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 5, 5, 5, 5, 'packed' FROM orders o, products p WHERE o.order_number='ORD-5009' AND p.sku='SKU-1001';
INSERT INTO order_items (order_id, product_id, quantity, allocated_qty, picked_qty, packed_qty, status)
SELECT o.id, p.id, 3, 0, 0, 0, 'pending' FROM orders o, products p WHERE o.order_number='ORD-5010' AND p.sku='SKU-1003';

-- Exceptions
INSERT INTO exceptions (order_id, product_id, type, severity, status, description, resolution)
SELECT o.id, p.id, 'damaged', 'warning', 'open', '2 units of Wireless Barcode Scanner damaged during picking on ORD-5004', NULL
FROM orders o, products p WHERE o.order_number='ORD-5004' AND p.sku='SKU-1001';
INSERT INTO exceptions (order_id, product_id, type, severity, status, description, resolution)
SELECT NULL, p.id, 'short_stock', 'critical', 'open', 'Picking Headset Pro completely out of stock — 3 units needed for ORD-5010', NULL
FROM products p WHERE p.sku='SKU-1003';
INSERT INTO exceptions (order_id, product_id, type, severity, status, description, resolution)
SELECT o.id, p.id, 'missing', 'critical', 'escalated', '1 pallet of Bubble Wrap Roll missing from location C-03-04', NULL
FROM orders o, products p WHERE o.order_number='ORD-5007' AND p.sku='SKU-3002';

-- Allocation log (for already-allocated orders)
INSERT INTO allocation_log (order_id, product_id, requested_qty, allocated_qty, action, reason)
SELECT o.id, p.id, 4, 4, 'full', 'Sufficient available stock' FROM orders o, products p WHERE o.order_number='ORD-5003' AND p.sku='SKU-1001';
INSERT INTO allocation_log (order_id, product_id, requested_qty, allocated_qty, action, reason)
SELECT o.id, p.id, 2, 2, 'full', 'Sufficient available stock' FROM orders o, products p WHERE o.order_number='ORD-5003' AND p.sku='SKU-5001';
INSERT INTO allocation_log (order_id, product_id, requested_qty, allocated_qty, action, reason)
SELECT o.id, p.id, 3, 3, 'full', 'Sufficient available stock' FROM orders o, products p WHERE o.order_number='ORD-5004' AND p.sku='SKU-4001';
INSERT INTO allocation_log (order_id, product_id, requested_qty, allocated_qty, action, reason)
SELECT o.id, p.id, 6, 6, 'full', 'Sufficient available stock' FROM orders o, products p WHERE o.order_number='ORD-5004' AND p.sku='SKU-3001';

-- Activity log
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'Order created', 'Order received from customer' FROM orders WHERE order_number='ORD-5001';
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'Priority set', 'Priority set to CRITICAL — VIP customer' FROM orders WHERE order_number='ORD-5001';
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'Order created', 'Order received from customer' FROM orders WHERE order_number='ORD-5003';
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'Stock allocated', '4 units of SKU-1001 allocated' FROM orders WHERE order_number='ORD-5003';
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'Picking started', 'Order moved to picking stage' FROM orders WHERE order_number='ORD-5004';
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'Exception raised', '2 damaged units reported during picking' FROM orders WHERE order_number='ORD-5004';
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'Dispatched', 'Order dispatched — carrier pickup confirmed' FROM orders WHERE order_number='ORD-5009';
INSERT INTO activity_log (order_id, event, detail)
SELECT id, 'On hold', 'Order placed on hold — awaiting stock replenishment' FROM orders WHERE order_number='ORD-5010';
