"""الواجهة العامة (للزوار): لا يظهر شيء إلا إذا كان البيت والوكالة «فعّالين»."""
import datetime
import hashlib
import io
import re
import uuid

from flask import Blueprint, abort, current_app, jsonify, request, send_file

bp = Blueprint('public', __name__)
OK = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
DATE_OK = re.compile(r'^\d{4}-\d{2}-\d{2}$')
PHONE_OK = re.compile(r'^\+?[\d\s\-()]{7,20}$')


def S():
    return current_app.store


def J(obj, status=200):
    r = jsonify(obj)
    r.status_code = status
    r.headers['Cache-Control'] = 'no-store'
    return r


def brand(a):
    return {'color': a.get('color', ''), 'font': a.get('font', ''),
            'logo': ('/logo/' + a['id']) if a.get('logo') else '',
            'bg': a.get('bg', ''), 'tx': a.get('tx', ''), 'fx': a.get('fx', ''),
            'bgu': ('/bg/' + a['id']) if a.get('bgType') else '', 'bgt': a.get('bgType', '')}


def live(hid):
    if not OK.match(hid or ''):
        return None
    h = S().getj('house/%s.json' % hid)
    a = h and S().getj('agency/%s.json' % h['agency'])
    return (h, a) if h and a and h['status'] == 'active' and a['status'] == 'active' else None


def agency_by_slug(slug):
    if not OK.match(slug or ''):
        return None
    aid = S().get('slug/' + slug)
    return S().getj('agency/%s.json' % aid.decode()) if aid else None


def payload(h, a):
    return {'id': h['id'], 'name': h['name'], 'agency': a['name'], 'agencyId': a['id'],
            'brand': brand(a), 'plan': h.get('plan'),
            'info': h.get('info') or {}, 'rooms': h['rooms']}


@bp.get('/api/a/<path:rest>')
def api_agency(rest):
    q = rest.split('/')
    a = agency_by_slug(q[0])
    if not a or a['status'] != 'active':
        return J({'blocked': 1}, 403)
    if len(q) > 1 and q[1]:
        hid = S().get('hs/%s/%s' % (a['id'], q[1])) if OK.match(q[1]) else None
        l = live(hid.decode()) if hid else None
        return J(payload(*l)) if l else J({'blocked': 1}, 403)
    ix = [x for x in (S().getj('idx/%s.json' % a['id']) or []) if x['status'] == 'active']
    return J({'id': a['id'], 'name': a['name'], 'brand': brand(a), 'houses': ix})


@bp.get('/api/h/<hid>')
def api_house(hid):
    l = live(hid)
    return J(payload(*l)) if l else J({'blocked': 1}, 403)


def bump(bucket):
    """Counter per day. One file per day: stats/views/<bucket>/<day>."""
    day = datetime.date.today().isoformat()
    k = 'stats/views/%s/%s' % (bucket, day)
    cur = S().get(k)
    try:
        n = int(cur.decode()) if cur else 0
    except (ValueError, UnicodeDecodeError):
        n = 0
    S().put(k, str(n + 1).encode())
    return n + 1


@bp.post('/api/view/h/<hid>')
def view_house(hid):
    """One real tour visit (client de-dupes per session)."""
    if not live(hid):
        return J({'e': 'blocked'}, 403)
    bump('house/' + hid)
    return J({'ok': 1})


@bp.post('/api/view/a/<aid>')
def view_agency(aid):
    a = S().getj('agency/%s.json' % aid) if OK.match(aid or '') else None
    if not a or a.get('status') != 'active':
        return J({'e': 'blocked'}, 403)
    bump('agency/' + aid)
    return J({'ok': 1})


@bp.post('/api/lead/<hid>')
def submit_lead(hid):
    """Visitor asks for a visit / calls back. Capped + rate-limited per IP."""
    l = live(hid)
    if not l:
        return J({'e': 'blocked'}, 403)
    h, a = l
    b = request.get_json(force=True, silent=True) or {}
    # honeypot: bots fill hidden fields, humans don't
    if str(b.get('website') or '').strip():
        return J({'ok': 1, 'id': 'x'})
    name = str(b.get('name') or '').strip()[:60]
    phone = str(b.get('phone') or '').strip()[:30]
    msg = str(b.get('msg') or '').strip()[:600]
    date = str(b.get('date') or '').strip()[:10]
    digits = re.sub(r'\D', '', phone)
    if len(name) < 2 or len(digits) < 7 or len(digits) > 15 or not PHONE_OK.match(phone):
        return J({'e': 'invalid'}, 400)
    if date and not DATE_OK.match(date):
        return J({'e': 'invalid'}, 400)
    # rate limit: 5 per IP per house per day
    ip = hashlib.sha256((request.remote_addr or 'x').encode()).hexdigest()[:12]
    rk = 'rate/lead/%s/%s/%s' % (ip, hid, datetime.date.today().isoformat())
    cur = S().get(rk)
    try:
        rc = int(cur.decode()) if cur else 0
    except (ValueError, UnicodeDecodeError):
        rc = 0
    if rc >= 5:
        return J({'e': 'slow'}, 429)
    S().put(rk, str(rc + 1).encode())
    now = datetime.datetime.now(datetime.timezone.utc)
    lead = {
        'id': uuid.uuid4().hex[:10],
        'house': hid,
        'agency': a['id'],
        'houseName': h['name'],
        'agencyName': a['name'],
        'name': name,
        'phone': phone,
        'phoneDigits': digits,
        'date': date,
        'msg': msg,
        'at': int(now.timestamp()),
        'iso': now.isoformat(),
        'done': 0,
    }
    S().putj('lead/%s.json' % lead['id'], lead)
    return J({'ok': 1, 'id': lead['id']})


def send(data, mime, ranged=False):
    r = send_file(io.BytesIO(data), mimetype=mime, conditional=ranged, max_age=300)
    r.headers['Cache-Control'] = 'private, max-age=300'
    return r


@bp.get('/img/<hid>/<rid>')
def image(hid, rid):
    if not OK.match(rid) or not live(hid):
        abort(403)
    d = S().get('img/%s/%s' % (hid, rid), cache=False)
    return send(d, 'image/jpeg') if d else abort(404)


@bp.get('/logo/<aid>')
def logo(aid):
    a = S().getj('agency/%s.json' % aid) if OK.match(aid) else None
    d = a and a['status'] == 'active' and S().get('logo/' + aid, cache=False)
    return send(d, 'image/png') if d else abort(404)


@bp.get('/bg/<aid>')
def background(aid):
    a = S().getj('agency/%s.json' % aid) if OK.match(aid) else None
    d = a and a['status'] == 'active' and a.get('bgType') and S().get('bg/' + aid, cache=False)
    return send(d, a['bgType'], ranged=True) if d else abort(404)
