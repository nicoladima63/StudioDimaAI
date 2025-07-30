import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from waitress import serve
from wsgi import app

if __name__ == "__main__":
    print("Server avviato su http://0.0.0.0:5000")
    serve(app, host='0.0.0.0', port=5000)