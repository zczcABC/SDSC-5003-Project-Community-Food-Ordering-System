USE food_order_db;

DELIMITER $$

-- BEFORE INSERT：检查库存是否足够
CREATE TRIGGER trg_before_order_detail_insert
BEFORE INSERT ON order_details
FOR EACH ROW
BEGIN
    DECLARE current_stock INT;
    SELECT stock_quantity INTO current_stock
      FROM menu_items
     WHERE id = NEW.menu_item_id;
    IF current_stock < NEW.quantity THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Insufficient stock for this menu item';
    END IF;
END$$

-- AFTER INSERT：扣减对应库存
CREATE TRIGGER trg_after_order_detail_insert
AFTER INSERT ON order_details
FOR EACH ROW
BEGIN
    UPDATE menu_items
       SET stock_quantity = stock_quantity - NEW.quantity
     WHERE id = NEW.menu_item_id;
END$$

DELIMITER ;