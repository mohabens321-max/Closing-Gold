"""واجهة الإدارة: كل المسارات تحتاج الرمز السري ADMIN_TOKEN."""
import datetime
import hmac
import re
import uuid

from flask import Blueprint, current_app, jsonify, request

from .config import Config, DEFAULT_ADMIN_TOKEN, admin_token, admin_token_env

bp = Blueprint('admin', __name__, url_prefix='/api/admin')
OK = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
HEX = re.compile(r'^#[0-9a-fA-F]{6}$')
BGT = re.compile(r'^(image/(png|jpeg|webp|gif)|video/(mp4|webm))$')
FONTS = ['Cairo', 'Tajawal', 'Almarai', 'Noto Kufi Arabic', 'El Messiri', 'Reem Kufi', 'Amiri',
         'IBM Plex Sans Arabic', 'Poppins', 'Playfair Display']
FXS = ['none', 'flow', 'aurora', 'dots', 'pan', 'custom']
STATUS = ['draft', 'active', 'blocked']
TYPES = ['Appartement', 'Villa', 'Duplex', 'Studio', 'Terrain', 'Local', 'Bureau', 'Ferme', 'Chalet']


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
    # مسار التشخيص العمومي لا يحتاج رمزاً.
    if request.endpoint == 'admin.ping':
        return None
    t = admin_token() or DEFAULT_ADMIN_TOKEN
    h = request.headers.get('Authorization', '').strip()
    if not hmac.compare_digest(h.encode(), ('Bearer ' + t).encode()):
        return J({'e': 'auth'}, 401)


@bp.get('/ping')
def ping():
    """هل عُيِّن رمز مخصص على الخادم؟ (بدون كشف قيمته)."""
    return J({'ok': True, 'configured': bool(admin_token_env())})


def save(h):
    S().putj('house/%s.json' % h['id'], h)
    k = 'idx/%s.json' % h['agency']
    ix = fresh(k) or []
    i = h.get('info') or {}
    e = {'id': h['id'], 'name': h['name'], 'status': h['status'], 'slug': h.get('slug', ''),
         'n': len(h['rooms']), 'cover': h['rooms'][0].get('image', '') if h['rooms'] else '',
         'price': i.get('price', ''), 'type': i.get('type', '')}
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


def views_map():
    """stats/views/<bucket>/<day> -> {bucket: {'total':n,'today':n}}."""
    today = datetime.date.today().isoformat()
    out = {}
    for k in S().list('stats/views/'):
        parts = k.split('/')          # stats/views/<kind>/<id>/<day>
        if len(parts) != 5:
            continue
        bucket = '%s/%s' % (parts[2], parts[3])
        try:
            n = int((S().get(k) or b'0').decode())
        except (ValueError, UnicodeDecodeError):
            n = 0
        e = out.setdefault(bucket, {'total': 0, 'today': 0})
        e['total'] += n
        if parts[4] == today:
            e['today'] += n
    return out


def all_leads():
    rows = [fresh(k) for k in S().list('lead/')]
    rows = [r for r in rows if r]
    rows.sort(key=lambda r: r.get('at', 0), reverse=True)
    return rows


@bp.get('/list')
def listing():
    ags = [fresh(k) for k in S().list('agency/')]
    hs = [fresh(k) for k in S().list('house/')]
    hv = views_map()
    ld = all_leads()
    per_house_leads = {}
    for r in ld:
        per_house_leads[r['house']] = per_house_leads.get(r['house'], 0) + 1
    today = datetime.date.today().isoformat()
    stats = {
        'views': sum(v['total'] for v in hv.values()),
        'today': sum(v['today'] for v in hv.values()),
        'leads': len(ld),
        'leadsNew': sum(1 for r in ld if not r.get('done')),
    }
    rows = []
    for h in hs:
        if not h:
            continue
        v = hv.get('house/' + h['id'], {'total': 0, 'today': 0})
        rows.append({'id': h['id'], 'agency': h['agency'], 'name': h['name'], 'status': h['status'],
                     'slug': h.get('slug', ''), 'n': len(h['rooms']),
                     'cover': (h['rooms'][0].get('image', '') if h['rooms'] else ''),
                     'price': (h.get('info') or {}).get('price', ''),
                     'type': (h.get('info') or {}).get('type', ''),
                     'desc': bool((h.get('info') or {}).get('desc')),
                     'views': v['total'], 'today': v['today'],
                     'leads': per_house_leads.get(h['id'], 0)})
    for a in ags:
        if a:
            a['views'] = hv.get('agency/' + a['id'], {'total': 0, 'today': 0})['total']
    return J({'agencies': [a for a in ags if a], 'houses': rows, 'leads': ld, 'stats': stats})


@bp.post('/agency')
def add_agency():
    b = body()
    a = {'id': uuid.uuid4().hex[:10], 'name': (b.get('name') or '').strip(), 'slug': slugify(b.get('slug')),
         'status': 'active', 'token': uuid.uuid4().hex[:12]}
    if not a['name'] or not a['slug'] or S().get('slug/' + a['slug'], False):
        return J({'e': 'slug'}, 400)
    S().putj('agency/%s.json' % a['id'], a)
    S().put('slug/' + a['slug'], a['id'].encode())
    return J(a)


@bp.get('/leads')
def leads():
    return J({'leads': all_leads()})


@bp.post('/lead/<lid>')
def set_lead(lid):
    l = fresh('lead/%s.json' % lid) if OK.match(lid) else None
    if not l:
        return J({'e': 1}, 404)
    l['done'] = 1 if body().get('done') else 0
    S().putj('lead/%s.json' % lid, l)
    return J({'ok': 1})


@bp.post('/dellead/<lid>')
def delete_lead(lid):
    if OK.match(lid):
        S().delete('lead/%s.json' % lid)
    return J({'ok': 1})


@bp.post('/house')
def add_house():
    b = body()
    if not OK.match(str(b.get('agency'))) or not fresh('agency/%s.json' % b['agency']):
        return J({'e': 'agency'}, 400)
    h = {'id': uuid.uuid4().hex[:10], 'agency': b['agency'], 'name': b.get('name') or 'Maison',
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


@bp.post('/info/<hid>')
def set_info(hid):
    """Fiche descriptive de la maison : texte + quelques informations clés.
    Tout est optionnel ; un champ vide est simplement retiré."""
    h = fresh('house/%s.json' % hid) if OK.match(hid) else None
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
    save(h)
    return J({'ok': 1, 'info': info})


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
        for k in S().list('stats/views/house/%s/' % h['id']):
            S().delete(k)
        for l in all_leads():
            if l.get('house') == h['id']:
                S().delete('lead/%s.json' % l['id'])
        k = 'idx/%s.json' % h['agency']
        S().putj(k, [x for x in (fresh(k) or []) if x['id'] != h['id']])
    return J({'ok': 1})


@bp.post('/agencytoken/<aid>')
def agency_token(aid):
    a = fresh('agency/%s.json' % aid) if OK.match(aid) else None
    if not a:
        return J({'e': 1}, 404)
    if not a.get('token'):
        a['token'] = uuid.uuid4().hex[:12]
    S().putj('agency/%s.json' % a['id'], a)
    return J({'ok': 1, 'token': a['token']})


@bp.post('/agencytoken/rotate/<aid>')
def agency_token_rotate(aid):
    a = fresh('agency/%s.json' % aid) if OK.match(aid) else None
    if not a:
        return J({'e': 1}, 404)
    a['token'] = uuid.uuid4().hex[:12]
    S().putj('agency/%s.json' % a['id'], a)
    return J({'ok': 1, 'token': a['token']})


@bp.post('/delagency/<aid>')
def delete_agency(aid):
    a = fresh('agency/%s.json' % aid) if OK.match(aid) else None
    if not a:
        return J({'ok': 1})
    if fresh('idx/%s.json' % aid):
        return J({'e': 'houses'}, 400)
    for k in ('agency/%s.json' % aid, 'slug/' + a['slug'], 'idx/%s.json' % aid, 'logo/' + aid, 'bg/' + aid):
        S().delete(k)
    for k in S().list('stats/views/agency/%s/' % aid):
        S().delete(k)
    return J({'ok': 1})
