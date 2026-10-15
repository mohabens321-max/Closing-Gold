"""واجهة الإدارة: كل المسارات تحتاج الرمز السري Mohqbens_123."""
import hmac
import re
import uuid

from flask import Blueprint, current_app, jsonify, request

from .config import Config

bp = Blueprint('admin', __name__, url_prefix='/api/admin')
OK = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
HEX = re.compile(r'^#[0-9a-fA-F]{6}$')
BGT = re.compile(r'^(image/(png|jpeg|webp|gif)|video/(mp4|webm))$')
FONTS = ['Cairo', 'Tajawal', 'Almarai', 'Noto Kufi Arabic', 'El Messiri', 'Reem Kufi', 'Amiri',
         'IBM Plex Sans Arabic', 'Poppins', 'Playfair Display']
FXS = ['none', 'flow', 'aurora', 'dots', 'pan', 'custom']
STATUS = ['draft', 'active', 'blocked']


def S():
    return current_app.store


def J(obj, status=200):
    r = jsonify(obj)
    r.status_code = status
    r.headers['Cache-Control'] = 'no-store'
    return r


def body():
    return request.get_json(force=True, silent=True) or {}


def fresh(key):
    return S().getj(key, False)


def slugify(s):
    return re.sub(r'[^a-z0-9-]', '', (s or '').lower())[:40]


@bp.before_request
def auth():
    t = Config.ADMIN_TOKEN
    h = request.headers.get('Authorization', '')
    if not t or not hmac.compare_digest(h.encode(), ('Bearer ' + t).encode()):
        return J({'e': 'auth'}, 401)



def save(h):
    S().putj('house/%s.json' % h['id'], h)
    k = 'idx/%s.json' % h['agency']
    ix = fresh(k) or []
    e = {'id': h['id'], 'name': h['name'], 'status': h['status'], 'slug': h.get('slug', ''),
         'n': len(h['rooms']), 'cover': h['rooms'][0].get('image', '') if h['rooms'] else ''}
    for i, x in enumerate(ix):
        if x['id'] == h['id']:
            ix[i] = e
            break
    else:
        ix.append(e)
    S().putj(k, ix)


def claim(h, s):
    s = slugify(s)
    if not s:
        return None
    k = 'hs/%s/%s' % (h['agency'], s)
    cur = S().get(k, False)
    if cur and cur.decode() != h['id']:
        return None
    if h.get('slug') and h['slug'] != s:
        S().delete('hs/%s/%s' % (h['agency'], h['slug']))
    S().put(k, h['id'].encode())
    h['slug'] = s
    return s


@bp.get('/config')
def config():
    return J({'max_upload_mb': Config.MAX_UPLOAD_MB})


@bp.get('/list')
def listing():
    ags = [fresh(k) for k in S().list('agency/')]
    hs = [fresh(k) for k in S().list('house/')]
    return J({'agencies': [a for a in ags if a],
              'houses': [{'id': h['id'], 'agency': h['agency'], 'name': h['name'], 'status': h['status'],
                          'slug': h.get('slug', ''), 'n': len(h['rooms'])} for h in hs if h]})


@bp.post('/agency')
def add_agency():
    b = body()
    a = {'id': uuid.uuid4().hex[:10], 'name': (b.get('name') or '').strip(), 'slug': slugify(b.get('slug')),
         'status': 'active'}
    if not a['name'] or not a['slug'] or S().get('slug/' + a['slug'], False):
        return J({'e': 'slug'}, 400)
    S().putj('agency/%s.json' % a['id'], a)
    S().put('slug/' + a['slug'], a['id'].encode())
    return J(a)


@bp.post('/house')
def add_house():
    b = body()
    if not OK.match(str(b.get('agency'))) or not fresh('agency/%s.json' % b['agency']):
        return J({'e': 'agency'}, 400)
    h = {'id': uuid.uuid4().hex[:10], 'agency': b['agency'], 'name': b.get('name') or 'بيت',
         'status': 'draft', 'rooms': []}
    claim(h, b.get('slug')) or claim(h, 'h-' + h['id'][:6])
    save(h)
    return J(h)


@bp.get('/house/<hid>')
def get_house(hid):
    h = fresh('house/%s.json' % hid) if OK.match(hid) else None
    return J(h) if h else J({'e': 1}, 404)


@bp.post('/data/<hid>')
def set_data(hid):
    h = fresh('house/%s.json' % hid) if OK.match(hid) else None
    rooms = request.get_json(force=True, silent=True)
    if not h or not isinstance(rooms, list) or not all(isinstance(r, dict) and OK.match(str(r.get('id'))) for r in rooms):
        return J({'e': 'data'}, 400)
    h['rooms'] = rooms
    save(h)
    return J({'ok': 1})


@bp.put('/img/<hid>/<rid>')
def put_image(hid, rid):
    if not OK.match(hid) or not OK.match(rid) or not fresh('house/%s.json' % hid):
        return J({'e': 1}, 400)
    S().put('img/%s/%s' % (hid, rid), request.get_data(), cache=False)
    return J({'ok': 1})


@bp.post('/status')
def set_status():
    b = body()
    if b.get('status') not in STATUS or not OK.match(str(b.get('id'))):
        return J({'e': 1}, 400)
    if b.get('type') == 'agency':
        a = fresh('agency/%s.json' % b['id'])
        if not a:
            return J({'e': 1}, 404)
        a['status'] = b['status']
        S().putj('agency/%s.json' % a['id'], a)
    else:
        h = fresh('house/%s.json' % b['id'])
        if not h:
            return J({'e': 1}, 404)
        h['status'] = b['status']
        save(h)
    return J({'ok': 1})


@bp.post('/slug')
def set_slug():
    b = body()
    h = fresh('house/%s.json' % b.get('id')) if OK.match(str(b.get('id'))) else None
    if not h or not claim(h, b.get('slug')):
        return J({'e': 'taken'}, 400)
    save(h)
    return J({'ok': 1})


@bp.post('/brand')
def set_brand():
    b = body()
    a = fresh('agency/%s.json' % b.get('id')) if OK.match(str(b.get('id'))) else None
    if not a:
        return J({'e': 1}, 404)
    if HEX.match(str(b.get('color'))): a['color'] = b['color']
    if b.get('font') in FONTS: a['font'] = b['font']
    if b.get('logo'): a['logo'] = 1
    if HEX.match(str(b.get('bg'))): a['bg'] = b['bg']
    if HEX.match(str(b.get('tx'))): a['tx'] = b['tx']
    if b.get('fx') in FXS: a['fx'] = b['fx']
    if BGT.match(str(b.get('bgt'))): a['bgType'] = b['bgt']
    S().putj('agency/%s.json' % a['id'], a)
    return J({'ok': 1})


@bp.post('/logo/<aid>')
def set_logo(aid):
    a = fresh('agency/%s.json' % aid) if OK.match(aid) else None
    if not a:
        return J({'e': 1}, 404)
    S().put('logo/' + aid, request.get_data(), cache=False)
    a['logo'] = 1
    S().putj('agency/%s.json' % aid, a)
    return J({'ok': 1})


@bp.post('/bg/<aid>')
def set_bg(aid):
    a = fresh('agency/%s.json' % aid) if OK.match(aid) else None
    if not a or not BGT.match(request.mimetype or ''):
        return J({'e': 'type'}, 400)
    S().put('bg/' + aid, request.get_data(), cache=False)
    a['bgType'] = request.mimetype
    S().putj('agency/%s.json' % aid, a)
    return J({'ok': 1})


@bp.post('/plan/<hid>')
def set_plan(hid):
    h = fresh('house/%s.json' % hid) if OK.match(hid) else None
    b = body()
    p = b.get('plan') or {}
    if not h or not isinstance(p.get('r'), dict) or not isinstance(p.get('d'), list):
        return J({'e': 'plan'}, 400)
    ok = lambda a: isinstance(a, list) and len(a) == 3 and all(isinstance(n, (int, float)) and .5 <= n <= 300 for n in a)
    h['plan'] = {'r': p['r'], 'd': p['d']}
    for r in h['rooms']:
        if ok((b.get('dims') or {}).get(r['id'])):
            r['dims'] = b['dims'][r['id']]
    save(h)
    return J({'ok': 1})


@bp.post('/del/<hid>')
def delete_house(hid):
    h = fresh('house/%s.json' % hid) if OK.match(hid) else None
    if h:
        S().delete('house/%s.json' % h['id'])
        if h.get('slug'):
            S().delete('hs/%s/%s' % (h['agency'], h['slug']))
        for r in h['rooms']:
            if OK.match(str(r.get('id'))):
                S().delete('img/%s/%s' % (h['id'], r['id']))
        k = 'idx/%s.json' % h['agency']
        S().putj(k, [x for x in (fresh(k) or []) if x['id'] != h['id']])
    return J({'ok': 1})


@bp.post('/delagency/<aid>')
def delete_agency(aid):
    a = fresh('agency/%s.json' % aid) if OK.match(aid) else None
    if not a:
        return J({'ok': 1})
    if fresh('idx/%s.json' % aid):
        return J({'e': 'houses'}, 400)
    for k in ('agency/%s.json' % aid, 'slug/' + a['slug'], 'idx/%s.json' % aid, 'logo/' + aid, 'bg/' + aid):
        S().delete(k)
    return J({'ok': 1})
