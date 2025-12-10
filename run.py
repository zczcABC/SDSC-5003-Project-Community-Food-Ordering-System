import sys
from backend.app import app

backend_dir = 'E:/python_file/cityu/5003/project_v0/backend'
sys.path.insert(0, str(backend_dir))


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
