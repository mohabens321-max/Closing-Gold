"""MB 360° — تطبيق Flask: واجهة الزوار + لوحة التحكم + الواجهة البرمجية."""
import os

from flask import Flask, jsonify, send_from_directory

from .config import Config
from .storage import make_store

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONT = os.path.join(ROOT, 'frontend')


def create_app():
    app = Flask(__name__, static_folder=FRONT, static_url_path='/static')
    app.config['MAX_CONTENT_LENGTH'] = Config.MAX_UPLOAD_MB * 1024 * 1024
    app.store = make_store(Config)

    from .admin_api import bp as admin_bp
    from .public_api import bp as public_bp
    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp)

    def page(folder):
        return send_from_directory(os.path.join(FRONT, folder), 'index.html', max_age=0)

    @app.get('/')
    def home():
        return ('<meta charset=utf-8><body style="background:#0b0b0d;color:#c9a96a;font:700 28px sans-serif;'
                'text-align:center;padding-top:30vh">MB 360°')

    @app.get('/admin')
    def admin():
        return page('admin')

    @app.get('/h/<path:_>')
    @app.get('/a/<path:_>')
    def viewer(_):
        return page('viewer')

    @app.get('/healthz')
    def health():
        return jsonify(ok=True)

    @app.errorhandler(413)
    def too_big(_):
        return jsonify(e='big'), 413

    @app.after_request
    def headers(r):
        r.headers.setdefault('X-Content-Type-Options', 'nosniff')
        r.headers.setdefault('Referrer-Policy', 'same-origin')
        return r

    return app
