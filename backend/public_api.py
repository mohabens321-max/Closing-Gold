"""الواجهة العامة (للزوار): لا يظهر شيء إلا إذا كان البيت والوكالة «فعّالين»."""
import io
import re

from flask import Blueprint, abort, current_app, jsonify, send_file

bp = Blueprint('public', __name__)
OK = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


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
    return {'name': h['name'], 'agency': a['name'], 'brand': brand(a), 'plan': h.get('plan'), 'rooms': h['rooms']}


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
    return J({'name': a['name'], 'brand': brand(a), 'houses': ix})


@bp.get('/api/h/<hid>')
def api_house(hid):
    l = live(hid)
    return J(payload(*l)) if l else J({'blocked': 1}, 403)


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
