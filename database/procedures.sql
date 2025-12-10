USE food_order_db;

DELIMITER $$

CREATE PROCEDURE sp_sales_summary (
    IN p_start DATE,
    IN p_end DATE
)
BEGIN
    -- 结果集1：按类别汇总
    SELECT m.category, SUM(od.subtotal) AS total_revenue
      FROM order_details od
      JOIN menu_items m ON od.menu_item_id = m.id
      JOIN orders o ON od.order_id = o.id
     WHERE o.order_time >= p_start
       AND o.order_time < DATE_ADD(p_end, INTERVAL 1 DAY)
       AND o.status != 'cancelled'
     GROUP BY m.category
     ORDER BY total_revenue DESC;

    -- 结果集2：按月份汇总
    SELECT DATE_FORMAT(o.order_time, '%Y-%m') AS month, SUM(o.total_amount) AS total_revenue
      FROM orders o
     WHERE o.order_time >= p_start
       AND o.order_time < DATE_ADD(p_end, INTERVAL 1 DAY)
       AND o.status != 'cancelled'
     GROUP BY month
     ORDER BY month;
END$$

DELIMITER ;