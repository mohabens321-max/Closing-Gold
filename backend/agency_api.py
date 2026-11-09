"""واجهة الوكالة نفسها: كل وكالة تشوف غير بياناتها (ديارها، مشاهداتها، طلباتها).

المصادقة بالرمز السري الخاص بالوكالة (token) في ترويسة Authorization.
الرمز يُولّد من الإدارة، ويُرسل للوكالة عبر رابط /agency/<slug>?t=...
"""
import hmac
import re

from flask import Blueprint, current_app, jsonify, request

from .admin_api import TYPES, all_leads, views_map

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
