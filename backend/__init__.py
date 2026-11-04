"""MB 360° — تطبيق Flask: واجهة الزوار + لوحة التحكم + الواجهة البرمجية."""
import html
import io
import os

from flask import Flask, current_app, jsonify, request, send_from_directory

from .config import Config
from .storage import make_store

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONT = os.path.join(ROOT, 'frontend')

VIEWER_HTML = io.open(os.path.join(FRONT, 'viewer', 'index.html'), encoding='utf-8').read()
HEAD_END = VIEWER_HTML.index('</head>')


def _esc(value):
    return html.escape(value or '', quote=True)


def create_app():
    app = Flask(__name__, static_folder=FRONT, static_url_path='/static')
    app.config['MAX_CONTENT_LENGTH'] = Config.MAX_UPLOAD_MB * 1024 * 1024
    app.store = make_store(Config)

    from .admin_api import bp as admin_bp
    from .public_api import bp as public_bp
    app.register_blueprint(public_bp)
    app.register_blueprint(admin_bp)

    def store():
        return current_app.store

    def page(folder):
        return send_from_directory(os.path.join(FRONT, folder), 'index.html', max_age=0)

    def render_viewer(title=None, site=None, desc=None, image=None, status=200):
        """Serve the viewer, with Open Graph tags so the link previews nicely on
        Facebook / WhatsApp / LinkedIn. A blocked house gets a 404 with no tags,
        so the preview dies with the listing."""
        tags = ''
        if title:
            base = request.url_root.rstrip('/')
            if image and image.startswith('/'):
                image = base + image
            tags = (
                '<meta property="og:type" content="website">'
                '<meta property="og:site_name" content="%s">'
                '<meta property="og:title" content="%s">'
                '<meta property="og:description" content="%s">'
                '<meta property="og:url" content="%s">'
                '<meta property="og:locale" content="fr_FR">'
                '<meta name="twitter:card" content="summary_large_image">'
                '<meta name="twitter:title" content="%s">'
                '<meta name="twitter:description" content="%s">'
            ) % (_esc(site or title), _esc(title), _esc(desc), _esc(base + request.path),
                 _esc(title), _esc(desc))
            if image:
                tags += ('<meta property="og:image" content="%s">'
                         '<meta property="og:image:alt" content="%s">'
                         '<meta name="twitter:image" content="%s">') % (_esc(image), _esc(title), _esc(image))
        body = VIEWER_HTML[:HEAD_END] + tags + VIEWER_HTML[HEAD_END:]
        r = app.response_class(body, status=status, mimetype='text/html')
        r.headers['Cache-Control'] = 'no-cache, max-age=0, must-revalidate'
        return r

    def house_meta(h, a):
        rooms = h.get('rooms') or []
        info = h.get('info') or {}
        image = '/img/%s/%s' % (h['id'], rooms[0]['id']) if rooms else None
        # Le texte de la fiche sert d'aperçu sur Facebook / WhatsApp : c'est la
        # première chose que lit le client avant de cliquer.
        desc = ' '.join(str(info.get('desc') or '').split())
        if not desc:
            desc = 'Visite virtuelle 360° · %d pièce%s · %s' % (len(rooms), 's' if len(rooms) > 1 else '', a['name'])
        elif len(desc) > 180:
            desc = desc[:177].rstrip() + '…'
        if info.get('price'):
            desc = '%s — %s' % (info['price'], desc)
        return dict(
            title='%s — %s' % (h['name'], a['name']),
            site=a['name'],
            desc=desc,
            image=image,
        )

    @app.get('/')
    def home():
        return ('<meta charset=utf-8><body style="background:#0b0b0d;color:#c9a96a;font:700 28px sans-serif;'
                'text-align:center;padding-top:30vh">MB 360°</body>')

    @app.get('/admin')
    def admin():
        return page('admin')

    @app.get('/a/<path:rest>')
    def viewer_agency(rest):
        from .public_api import OK, agency_by_slug, live
        q = rest.split('/')
        a = agency_by_slug(q[0])
        if not a or a.get('status') != 'active':
            return render_viewer(status=404)
        if len(q) > 1 and q[1]:
            hid = store().get('hs/%s/%s' % (a['id'], q[1])) if OK.match(q[1]) else None
            found = live(hid.decode()) if hid else None
            return render_viewer(**house_meta(*found)) if found else render_viewer(status=404)
        houses = [x for x in (store().getj('idx/%s.json' % a['id']) or []) if x.get('status') == 'active']
        return render_viewer(
            title='%s — Visites 360°' % a['name'],
            site=a['name'],
            desc='Découvrez les biens de %s en visite virtuelle 360°.' % a['name'],
            image=houses[0].get('cover') if houses and houses[0].get('cover') else None,
        )

    @app.get('/h/<hid>')
    def viewer_house(hid):
        from .public_api import live
        found = live(hid)
        return render_viewer(**house_meta(*found)) if found else render_viewer(status=404)

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
