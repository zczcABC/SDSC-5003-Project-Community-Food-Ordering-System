# Community Food Ordering System
A full-stack online ordering system with real-time inventory tracking.

## Quick Start
### Prerequisites
- Python 3.8+
- MySQL 8.0
- pip

### Setup
1. Create Database (using SQLyog or MySQL client):
mysql -u root -p < database/schema.sql
mysql -u root -p < database/triggers.sql
mysql -u root -p < database/procedures.sql
mysql -u root -p < database/insert_menu.sql

2. Configure Database in backend/app.py:
DB_HOST = "127.0.0.1"
DB_USER = 'root'
DB_PASSWORD = 'your_password'  # Change this
DB_NAME = 'food_order_db'

3. Change the file path

4. Install & Run:
pip install Flask mysql-connector-python
python run.py

### Access
- Customer: http://localhost:5000/
- Admin: http://localhost:5000/admin
