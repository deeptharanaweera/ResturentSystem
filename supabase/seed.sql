-- ========================================
-- Seed Data for Restaurant Management System
-- ========================================

-- Insert Categories
INSERT INTO categories (name, display_order) VALUES
  ('Starters', 1),
  ('Main Course', 2),
  ('Beverages', 3),
  ('Desserts', 4),
  ('Sides', 5);

-- Insert Menu Items
-- Starters
INSERT INTO menu_items (category_id, name, description, price, is_available) VALUES
  ((SELECT id FROM categories WHERE name = 'Starters'), 'Paneer Tikka', 'Marinated cottage cheese cubes grilled to perfection with spices', 249.00, true),
  ((SELECT id FROM categories WHERE name = 'Starters'), 'Chicken Wings', 'Crispy fried wings tossed in spicy buffalo sauce', 299.00, true),
  ((SELECT id FROM categories WHERE name = 'Starters'), 'Spring Rolls', 'Crispy vegetable spring rolls served with sweet chili dip', 199.00, true),
  ((SELECT id FROM categories WHERE name = 'Starters'), 'Soup of the Day', 'Chef''s special cream soup, ask your server for today''s pick', 149.00, true);

-- Main Course
INSERT INTO menu_items (category_id, name, description, price, is_available) VALUES
  ((SELECT id FROM categories WHERE name = 'Main Course'), 'Butter Chicken', 'Tender chicken in rich creamy tomato gravy, a timeless classic', 349.00, true),
  ((SELECT id FROM categories WHERE name = 'Main Course'), 'Grilled Salmon', 'Fresh Atlantic salmon fillet with lemon herb butter sauce', 549.00, true),
  ((SELECT id FROM categories WHERE name = 'Main Course'), 'Veg Biryani', 'Fragrant basmati rice layered with mixed vegetables and aromatic spices', 279.00, true),
  ((SELECT id FROM categories WHERE name = 'Main Course'), 'Lamb Rogan Josh', 'Slow-cooked lamb in a rich Kashmiri-style curry', 449.00, true);

-- Beverages
INSERT INTO menu_items (category_id, name, description, price, is_available) VALUES
  ((SELECT id FROM categories WHERE name = 'Beverages'), 'Mango Lassi', 'Creamy yogurt smoothie blended with fresh alphonso mangoes', 129.00, true),
  ((SELECT id FROM categories WHERE name = 'Beverages'), 'Fresh Lime Soda', 'Refreshing lime soda, sweet or salted', 99.00, true),
  ((SELECT id FROM categories WHERE name = 'Beverages'), 'Cold Coffee', 'Chilled coffee blended with ice cream and chocolate', 149.00, true);

-- Desserts
INSERT INTO menu_items (category_id, name, description, price, is_available) VALUES
  ((SELECT id FROM categories WHERE name = 'Desserts'), 'Gulab Jamun', 'Soft milk-solid dumplings soaked in rose-flavored sugar syrup', 149.00, true),
  ((SELECT id FROM categories WHERE name = 'Desserts'), 'Chocolate Lava Cake', 'Warm chocolate cake with a molten center, served with vanilla ice cream', 249.00, true),
  ((SELECT id FROM categories WHERE name = 'Desserts'), 'Kulfi', 'Traditional Indian ice cream with pistachios and saffron', 129.00, true);

-- Sides
INSERT INTO menu_items (category_id, name, description, price, is_available) VALUES
  ((SELECT id FROM categories WHERE name = 'Sides'), 'Garlic Naan', 'Freshly baked naan bread with garlic butter', 69.00, true),
  ((SELECT id FROM categories WHERE name = 'Sides'), 'Steamed Rice', 'Plain steamed basmati rice', 99.00, true),
  ((SELECT id FROM categories WHERE name = 'Sides'), 'Raita', 'Cool cucumber and mint yogurt', 59.00, true);

-- Insert Tables (1-10)
INSERT INTO restaurant_tables (table_number, is_active) VALUES
  (1, true),
  (2, true),
  (3, true),
  (4, true),
  (5, true),
  (6, true),
  (7, true),
  (8, true),
  (9, true),
  (10, true);
