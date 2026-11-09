"""واجهة الوكالة نفسها: كل وكالة تشوف غير بياناتها (ديارها، مشاهداتها، طلباتها).

المصادقة بالرمز السري الخاص بالوكالة (token) في ترويسة Authorization.
الرمز يُولّد من الإدارة، ويُرسل للوكالة عبر رابط /agency/<slug>?t=...
"""
import hmac
import re
import uuid

from flask import Blueprint, current_app, jsonify, request

from .admin_api import (TYPES, all_leads, views_map, save, claim, HEX, FONTS,
                        FXS, BGT, STATUS)

bp = Blueprint('agency', __name__, url_prefix='/api/agency')
OK = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


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


def agency_of():
    """الوكالة صاحب الرمز، أو None."""
    tok = (request.headers.get('Authorization', '') or '').strip()
    if tok.startswith('Bearer '):
        tok = tok[7:].strip()
    if not tok:
        return None
    for k in S().list('agency/'):
        a = fresh(k)
        if a and a.get('token') and hmac.compare_digest(str(a['token']), tok):
            return a
    return None


@bp.before_request
def auth():
    if request.endpoint == 'agency.ping':
        return None
    if not agency_of():
        return J({'e': 'auth'}, 401)


@bp.get('/ping')
def ping():
    return J({'ok': True})


@bp.get('/config')
def config():
    from .config import Config
    return J({'max_upload_mb': Config.MAX_UPLOAD_MB})


def my_houses(aid):
    rows = []
    hv = views_map()
    ld = [r for r in all_leads() if r.get('agency') == aid]
    per = {}
    for r in ld:
        per[r['house']] = per.get(r['house'], 0) + 1
    for k in S().list('house/'):
        h = fresh(k)
        if not h or h.get('agency') != aid:
            continue
        v = hv.get('house/' + h['id'], {'total': 0, 'today': 0})
        rows.append({'id': h['id'], 'name': h['name'], 'status': h['status'],
                     'slug': h.get('slug', ''), 'n': len(h['rooms']),
                     'cover': (h['rooms'][0].get('image', '') if h['rooms'] else ''),
                     'price': (h.get('info') or {}).get('price', ''),
                     'type': (h.get('info') or {}).get('type', ''),
                     'desc': bool((h.get('info') or {}).get('desc')),
                     'views': v['total'], 'today': v['today'],
                     'leads': per.get(h['id'], 0)})
    return rows, ld, hv


@bp.post('/house')
def add_house():
    a = agency_of()
    b = body()
    from .admin_api import claim, save
    h = {'id': uuid.uuid4().hex[:10], 'agency': a['id'],
         'name': (b.get('name') or 'Maison').strip()[:80] or 'Maison',
         'status': 'draft', 'rooms': []}
    claim(h, b.get('slug')) or claim(h, 'h-' + h['id'][:6])
    save(h)
    return J(h)


@bp.post('/data/<hid>')
def set_data(hid):
    h = own_house(hid)
    if not h:
        return J({'e': 1}, 404)
    rooms = request.get_json(force=True, silent=True)
    if not isinstance(rooms, list) or not all(isinstance(r, dict) and OK.match(str(r.get('id'))) for r in rooms):
        return J({'e': 'data'}, 400)
    h['rooms'] = rooms
    from .admin_api import save
    save(h)
    return J({'ok': 1})


@bp.put('/img/<hid>/<rid>')
def put_image(hid, rid):
    h = own_house(hid)
    if not h or not OK.match(rid):
        return J({'e': 1}, 400)
    S().put('img/%s/%s' % (hid, rid), request.get_data(), cache=False)
    return J({'ok': 1})


@bp.post('/slug')
def set_slug():
    h = own_house(str(body().get('id')))
    if not h:
        return J({'e': 1}, 404)
    from .admin_api import claim, save
    if not claim(h, body().get('slug')):
        return J({'e': 'taken'}, 400)
    save(h)
    return J({'ok': 1})


@bp.post('/plan/<hid>')
def set_plan(hid):
    h = own_house(hid)
    if not h:
        return J({'e': 1}, 404)
    b = body()
    p = b.get('plan') or {}
    if not isinstance(p.get('r'), dict) or not isinstance(p.get('d'), list):
        return J({'e': 'plan'}, 400)
    ok = lambda a: isinstance(a, list) and len(a) == 3 and all(isinstance(n, (int, float)) and .5 <= n <= 300 for n in a)
    h['plan'] = {'r': p['r'], 'd': p['d']}
    for r in h['rooms']:
        if ok((b.get('dims') or {}).get(r['id'])):
            r['dims'] = b['dims'][r['id']]
    from .admin_api import save
    save(h)
    return J({'ok': 1})


@bp.post('/del/<hid>')
def delete_house(hid):
    h = own_house(hid)
    if not h:
        return J({'e': 1}, 404)
    S().delete('house/%s.json' % h['id'])
    if h.get('slug'):
        S().delete('hs/%s/%s' % (h['agency'], h['slug']))
    for r in h['rooms']:
        if OK.match(str(r.get('id'))):
            S().delete('img/%s/%s' % (h['id'], r['id']))
    for k in S().list('stats/views/house/%s/' % h['id']):
        S().delete(k)
    for l in all_leads():
        if l.get('house') == h['id']:
            S().delete('lead/%s.json' % l['id'])
    k = 'idx/%s.json' % h['agency']
    ix = [x for x in (S().getj(k) or []) if x['id'] != h['id']]
    S().putj(k, ix)
    return J({'ok': 1})


@bp.post('/brand')
def set_brand():
    a = agency_of()
    b = body()
    from .admin_api import HEX, FONTS, FXS, BGT
    if HEX.match(str(b.get('color'))): a['color'] = b['color']
    if b.get('font') in FONTS: a['font'] = b['font']
    if HEX.match(str(b.get('bg'))): a['bg'] = b['bg']
    if HEX.match(str(b.get('tx'))): a['tx'] = b['tx']
    if b.get('fx') in FXS: a['fx'] = b['fx']
    if BGT.match(str(b.get('bgt'))): a['bgType'] = b['bgt']
    S().putj('agency/%s.json' % a['id'], a)
    return J({'ok': 1})


@bp.post('/logo/<aid>')
def set_logo(aid):
    a = agency_of()
    if aid != a['id']:
        return J({'e': 1}, 403)
    S().put('logo/' + aid, request.get_data(), cache=False)
    a['logo'] = 1
    S().putj('agency/%s.json' % a['id'], a)
    return J({'ok': 1})


@bp.post('/bg/<aid>')
def set_bg(aid):
    a = agency_of()
    if aid != a['id'] or not BGT.match(request.mimetype or ''):
        return J({'e': 'type'}, 400)
    S().put('bg/' + aid, request.get_data(), cache=False)
    a['bgType'] = request.mimetype
    S().putj('agency/%s.json' % a['id'], a)
    return J({'ok': 1})


@bp.get('/me')
def me():
    a = agency_of()
    houses, ld, hv = my_houses(a['id'])
    av = hv.get('agency/' + a['id'], {'total': 0, 'today': 0})
    stats = {
        'views': sum(h['views'] for h in houses) + av['total'],
        'today': sum(h['today'] for h in houses) + av['today'],
        'leads': len(ld),
        'leadsNew': sum(1 for r in ld if not r.get('done')),
    }
    pub = {k: a.get(k) for k in ('id', 'name', 'slug', 'status', 'color', 'font', 'bg', 'tx', 'fx')}
    return J({'agency': pub, 'houses': houses, 'leads': ld, 'stats': stats})


def own_house(hid):
    h = fresh('house/%s.json' % hid) if OK.match(hid or '') else None
    a = agency_of()
    return h if h and h.get('agency') == a['id'] else None


@bp.post('/status')
def set_status():
    b = body()
    if b.get('status') not in ('draft', 'active', 'blocked'):
        return J({'e': 1}, 400)
    h = own_house(str(b.get('id')))
    if not h:
        return J({'e': 1}, 404)
    h['status'] = b['status']
    # حفظ مع تحديث الفهرس (نفس منطق الإدارة)
    from .admin_api import save
    save(h)
    return J({'ok': 1})


@bp.get('/house/<hid>')
def get_house(hid):
    h = own_house(hid)
    return J(h) if h else J({'e': 1}, 404)


@bp.post('/info/<hid>')
def set_info(hid):
    h = own_house(hid)
    if not h:
        return J({'e': 1}, 404)
    b = body()
    info = {}
    desc = str(b.get('desc') or '').strip()[:4000]
    if desc:
        info['desc'] = desc
    if b.get('type') in TYPES:
        info['type'] = b['type']
    for k, n in (('price', 40), ('surface', 20), ('floor', 20), ('address', 140), ('phone', 40)):
        v = str(b.get(k) or '').strip()[:n]
        if v:
            info[k] = v
    for k in ('beds', 'baths'):
        try:
            v = int(b.get(k) or 0)
            if 0 < v < 100:
                info[k] = v
        except (TypeError, ValueError):
            pass
    h['info'] = info
    from .admin_api import save
    save(h)
    return J({'ok': 1, 'info': info})


@bp.post('/lead/<lid>')
def set_lead(lid):
    l = fresh('lead/%s.json' % lid) if OK.match(lid or '') else None
    if not l or l.get('agency') != agency_of()['id']:
        return J({'e': 1}, 404)
    l['done'] = 1 if body().get('done') else 0
    S().putj('lead/%s.json' % lid, l)
    return J({'ok': 1})


@bp.post('/dellead/<lid>')
def delete_lead(lid):
    l = fresh('lead/%s.json' % lid) if OK.match(lid or '') else None
    if l and l.get('agency') == agency_of()['id']:
        S().delete('lead/%s.json' % lid)
    return J({'ok': 1})


@bp.post('/token/rotate')
def rotate():
    import uuid
    a = agency_of()
    a['token'] = uuid.uuid4().hex[:10]
    S().putj('agency/%s.json' % a['id'], a)
    return J({'ok': 1, 'token': a['token']})
