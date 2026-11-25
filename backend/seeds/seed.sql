INSERT INTO products (sku, name, price, stock, is_active) VALUES
('SKU-001', 'Beras 5kg', 65000, 50, TRUE),
('SKU-002', 'Minyak Goreng 2L', 32000, 40, TRUE),
('SKU-003', 'Gula Pasir 1kg', 16000, 60, TRUE),
('SKU-004', 'Tepung Terigu 1kg', 12000, 35, TRUE),
('SKU-005', 'Susu UHT 1L', 18000, 25, TRUE),
('SKU-006', 'Kopi Bubuk 200g', 25000, 30, TRUE),
('SKU-007', 'Teh Celup 25s', 15000, 45, TRUE),
('SKU-008', 'Mie Instan Goreng', 3500, 100, TRUE),
('SKU-009', 'Kecap Manis 600ml', 22000, 20, TRUE),
('SKU-010', 'Sarden Kaleng', 14000, 15, TRUE),
('SKU-011', 'Sabun Cuci Piring', 10000, 8, TRUE),
('SKU-012', 'Deterjen 800g', 20000, 5, FALSE);

-- sample order 1
INSERT INTO sales_orders (customer, status, total) VALUES ('Budi Santoso', 'CREATED', 162000);
INSERT INTO sales_order_items (order_id, sku, qty, unit_price) VALUES
(1, 'SKU-001', 2, 65000),
(1, 'SKU-002', 1, 32000);
INSERT INTO stock_movements (product_id, type, qty, note) VALUES
((SELECT id FROM products WHERE sku='SKU-001'), 'out', 2, 'sales order'),
((SELECT id FROM products WHERE sku='SKU-002'), 'out', 1, 'sales order');
UPDATE products SET stock = stock - 2 WHERE sku='SKU-001';
UPDATE products SET stock = stock - 1 WHERE sku='SKU-002';

-- sample order 2
INSERT INTO sales_orders (customer, status, total) VALUES ('Siti Aminah', 'CREATED', 50000);
INSERT INTO sales_order_items (order_id, sku, qty, unit_price) VALUES
(2, 'SKU-006', 2, 25000);
INSERT INTO stock_movements (product_id, type, qty, note) VALUES
((SELECT id FROM products WHERE sku='SKU-006'), 'out', 2, 'sales order');
UPDATE products SET stock = stock - 2 WHERE sku='SKU-006';
