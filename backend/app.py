from flask import Flask, request, jsonify, render_template
import mysql.connector
from mysql.connector import Error
from datetime import datetime, timedelta

app = Flask(__name__, template_folder='E:/python_file/cityu/5003/project_v0/frontend/templates',
            static_folder='E:/python_file/cityu/5003/project_v0/frontend/static',
            static_url_path='/static')

DB_HOST = "127.0.0.1"
DB_PORT = 3306
DB_USER = 'root'
DB_PASSWORD = '123456'
DB_NAME = 'food_order_db'


# 连接数据库
def get_db_connection():
    try:
        conn = mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            user=DB_USER,
            password=DB_PASSWORD,
            database=DB_NAME,
            charset='utf8mb4'
        )
        return conn
    except Error as e:
        print(f"[ERROR] MySQL connection failed: {e}")
        return None


# 前端页面路由
@app.route('/')
def index():
    """用户点餐首页"""
    return render_template('index.html')


@app.route('/admin')
def admin():
    """管理员界面"""
    return render_template('admin.html')


# 获取菜单
@app.route('/api/menu', methods=['GET'])
def api_menu():
    """
    返回所有菜品信息，增加 stock_status（有货/缺货）。
    客户端可根据 stock_status 显示是否允许加入购物车。
    """
    conn = get_db_connection()
    if not conn:
        return jsonify(code=500, msg="Database connection error", data=[]), 500
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT id, name, category, price, stock_quantity,
                   CASE 
                       WHEN stock_quantity > 0 THEN '有货'
                       ELSE '缺货'
                   END AS stock_status
            FROM menu_items
            ORDER BY category, name
        """)
        rows = cursor.fetchall()
        return jsonify(code=0, msg="success", data=rows)
    except Error as e:
        return jsonify(code=500, msg=str(e), data=[]), 500
    finally:
        cursor.close()
        conn.close()


# 提交订单
@app.route('/api/order', methods=['POST'])
def api_create_order():
    data = request.get_json()
    if not data or not data.get('customer') or not data.get('items'):
        return jsonify(code=400, msg="Invalid request body", data=None), 400

    conn = get_db_connection()
    if not conn:
        return jsonify(code=500, msg="Database connection error", data=None), 500
    cursor = conn.cursor()

    try:
        conn.start_transaction()   # 明确开启事务

        # ---------- 1. 顾客信息 ----------
        cust = data['customer']
        # 简单场景：每次下单都插入新顾客记录（实际可先去重）
        cursor.execute(
            "INSERT INTO customers (name, phone, address) VALUES (%s, %s, %s)",
            (cust['name'], cust['phone'], cust['address'])
        )
        customer_id = cursor.lastrowid

        # ---------- 2. 订单主表 ----------
        total_amount = 0.0
        # 先计算总价（仅为示例，真实场景可在插入明细后汇总）
        for item in data['items']:
            cursor.execute("SELECT price FROM menu_items WHERE id = %s", (item['menu_item_id'],))
            row = cursor.fetchone()
            if not row:
                raise Exception(f"Menu item {item['menu_item_id']} not found")
            total_amount += float(row[0]) * item['quantity']

        cursor.execute(
            "INSERT INTO orders (customer_id, total_amount, status) VALUES (%s, %s, %s)",
            (customer_id, total_amount, 'pending')
        )
        order_id = cursor.lastrowid

        # ---------- 3. 订单明细（触发器会自动检查库存） ----------
        for item in data['items']:
            cursor.execute(
                "INSERT INTO order_details (order_id, menu_item_id, quantity, subtotal) VALUES (%s, %s, %s, %s)",
                (order_id, item['menu_item_id'], item['quantity'],
                 float(row[0]) * item['quantity'])
            )

        conn.commit()
        return jsonify(code=0, msg="Order created successfully", data={"order_id": order_id}), 201
    except Error as e:
        conn.rollback()
        return jsonify(code=500, msg=f"Database error: {e}", data=None), 500
    except Exception as e:
        conn.rollback()
        return jsonify(code=500, msg=str(e), data=None), 500
    finally:
        cursor.close()
        conn.close()


# 获取订单列表
@app.route('/api/orders', methods=['GET'])
def api_orders():
    page = int(request.args.get('page', 1))
    limit = int(request.args.get('limit', 20))
    offset = (page - 1) * limit

    conn = get_db_connection()
    if not conn:
        return jsonify(code=500, msg="Database connection error", data=[]), 500
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT o.id, c.name AS customer_name, o.total_amount, o.status, o.order_time
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            ORDER BY o.order_time DESC
            LIMIT %s OFFSET %s
        """, (limit, offset))
        rows = cursor.fetchall()
        return jsonify(code=0, msg="success", data=rows)
    except Error as e:
        return jsonify(code=500, msg=str(e), data=[]), 500
    finally:
        cursor.close()
        conn.close()


# 更新订单状态
@app.route('/api/order/<int:order_id>/status', methods=['PUT'])
def api_update_order_status(order_id):
    data = request.get_json()
    new_status = data.get('status')
    if new_status not in ('pending', 'confirmed', 'delivered', 'cancelled'):
        return jsonify(code=400, msg="Invalid status value", data=None), 400

    conn = get_db_connection()
    if not conn:
        return jsonify(code=500, msg="Database connection error", data=None), 500
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE orders SET status = %s WHERE id = %s",
            (new_status, order_id)
        )
        conn.commit()
        if cursor.rowcount == 0:
            return jsonify(code=404, msg="Order not found", data=None), 404
        return jsonify(code=0, msg="Status updated", data=None)
    except Error as e:
        conn.rollback()
        return jsonify(code=500, msg=str(e), data=None), 500
    finally:
        cursor.close()
        conn.close()


# 销售汇总
@app.route('/api/sales_data', methods=['GET'])
def api_sales_data():
    conn = get_db_connection()
    if not conn:
        return jsonify(code=500, msg="Database connection error", data=None), 500
    cursor = conn.cursor(dictionary=True)
    try:
        # 最近 30 天（包含今天）
        start_date = (datetime.today() - timedelta(days=30)).strftime('%Y-%m-%d')

        # 每日销售额
        cursor.execute("""
            SELECT DATE(order_time) AS date, SUM(total_amount) AS total
            FROM orders
            WHERE order_time >= %s AND status != 'cancelled'
            GROUP BY DATE(order_time)
            ORDER BY date
        """, (start_date,))
        daily = cursor.fetchall()
        for item in daily:
            item['date'] = item['date'].strftime('%Y-%m-%d')

        # 按类别汇总
        cursor.execute("""
            SELECT m.category, SUM(od.subtotal) AS total
            FROM order_details od
            JOIN menu_items m ON od.menu_item_id = m.id
            JOIN orders o ON od.order_id = o.id
            WHERE o.order_time >= %s AND o.status != 'cancelled'
            GROUP BY m.category
        """, (start_date,))
        category = cursor.fetchall()

        return jsonify(code=0, msg="success", data={"daily": daily, "category": category})
    except Error as e:
        return jsonify(code=500, msg=str(e), data=None), 500
    finally:
        cursor.close()
        conn.close()


# 热销 Top N 商品
@app.route('/api/popular_items', methods=['GET'])
def api_popular_items():
    top_n = int(request.args.get('top', 10))
    conn = get_db_connection()
    if not conn:
        return jsonify(code=500, msg="Database connection error", data=[]), 500
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("""
            SELECT m.name, SUM(od.quantity) AS total_sold, SUM(od.subtotal) AS revenue
            FROM order_details od
            JOIN menu_items m ON od.menu_item_id = m.id
            JOIN orders o ON od.order_id = o.id
            WHERE o.status != 'cancelled'
            GROUP BY od.menu_item_id, m.name
            ORDER BY total_sold DESC
            LIMIT %s
        """, (top_n,))
        rows = cursor.fetchall()
        return jsonify(code=0, msg="success", data=rows)
    except Error as e:
        return jsonify(code=500, msg=str(e), data=[]), 500
    finally:
        cursor.close()
        conn.close()


# 获取订单详情
@app.route('/api/order/<int:order_id>/details', methods=['GET'])
def api_order_details(order_id):
    conn = get_db_connection()
    if not conn:
        return jsonify(code=500, msg="Database connection error", data=None), 500
    cursor = conn.cursor(dictionary=True)

    try:
        # 查询订单主信息 + 顾客信息
        cursor.execute("""
            SELECT o.id, c.name AS customer_name, c.phone, c.address,
                   o.total_amount, o.status, o.order_time
            FROM orders o
            JOIN customers c ON o.customer_id = c.id
            WHERE o.id = %s
        """, (order_id,))
        order = cursor.fetchone()

        if not order:
            return jsonify(code=404, msg="Order not found", data=None), 404

        # 查询订单明细 + 菜品信息
        cursor.execute("""
            SELECT m.name, od.quantity, m.price, od.subtotal
            FROM order_details od
            JOIN menu_items m ON od.menu_item_id = m.id
            WHERE od.order_id = %s
            ORDER BY od.id
        """, (order_id,))
        items = cursor.fetchall()

        return jsonify(code=0, msg="success", data={"order": order, "items": items})
    except Error as e:
        return jsonify(code=500, msg=str(e), data=None), 500
    finally:
        cursor.close()
        conn.close()


# main
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
