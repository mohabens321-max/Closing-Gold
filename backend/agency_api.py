"""واجهة الوكالة: للقراءة فقط. كل وكالة تشوف غير بياناتها (ديارها، مشاهداتها، طلباتها).

المصادقة بالرمز السري الخاص بالوكالة (token) في ترويسة Authorization.
الرمز يُولّد من الإدارة، ويُرسل للوكالة عبر رابط /agency/<slug>?t=...
الوكالة ما تقدرش تعدّل، تحذف، تستورد، تبدّل الحالة، ولا تبدّل الهوية: كل هذا في يد الإدارة.
"""
import hmac
import re

from flask import Blueprint, current_app, jsonify, request

from .admin_api import all_leads, views_map

bp = Blueprint('agency', __name__, url_prefix='/api/agency')
OK = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


def S():
    return current_app.store


def J(obj, status=200):
    r = jsonify(obj)
    r.status_code = status
    r.headers['Cache-Control'] = 'no-store'
    return r


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
        rows.append({'id': h['id'], 'agency': aid, 'name': h['name'], 'status': h['status'],
                     'slug': h.get('slug', ''), 'n': len(h['rooms']),
                     'cover': (h['rooms'][0].get('image', '') if h['rooms'] else ''),
                     'price': (h.get('info') or {}).get('price', ''),
                     'type': (h.get('info') or {}).get('type', ''),
                     'desc': bool((h.get('info') or {}).get('desc')),
                     'views': v['total'], 'today': v['today'],
                     'leads': per.get(h['id'], 0)})
    return rows, ld, hv


def own_house(hid):
    h = fresh('house/%s.json' % hid) if OK.match(hid or '') else None
    a = agency_of()
    return h if h and h.get('agency') == a['id'] else None


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


@bp.get('/house/<hid>')
def get_house(hid):
    h = own_house(hid)
    return J(h) if h else J({'e': 1}, 404)
