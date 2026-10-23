#!/usr/bin/env python3
"""KCAL platform data normalizer.

Reads every raw collector file (oldest first) and rebuilds the CSVs in
~/kcal-reports/platform_data/. Later runs overwrite earlier values for the same
key, so a weekly run (last 14 days) corrects what the platforms revised.

Raw inputs:  ~/Downloads/kcal-platform-raw/<run>/*.json   (extension)
             ~/Downloads/kcalraw__*.json                  (manual runs)
Outputs:     platform_metrics.csv, reviews.csv, cancellations.csv, products.csv,
             campaigns.csv, hourly.csv, field_map.md, run_log.md
Rules: UTF-8, decimal point, empty metric = empty cell (never 0), Europe/Istanbul
local time, no personal data (names, phones, addresses, e-mails).
"""
import csv, glob, json, os, re, sys, statistics, datetime as dt
from collections import defaultdict, Counter

RAW_GLOBS = [os.path.expanduser('~/Downloads/kcal-platform-raw/*/*.json'), os.path.expanduser('~/Downloads/kcalraw__*.json')]
OUT = os.path.expanduser(os.environ.get('KCAL_PLATFORM_OUT', '~/kcal-reports/platform_data'))
TZ = dt.timezone(dt.timedelta(hours=3))
BRANCH = {'basin': 'basin', 'basin_sitesi': 'basin', 'bayrakli': 'bayrakli', 'mansuroglu': 'bayrakli'}

METRIC_COLS = ['orders', 'cancelled_orders', 'refunded_orders', 'gross_revenue', 'discount_amount', 'net_revenue', 'avg_basket',
               'impressions', 'menu_views', 'add_to_cart', 'checkout_orders', 'visitors', 'conversion_rate',
               'new_customer_orders', 'returning_customer_orders',
               'promo_order_ratio', 'uptime_ratio', 'offline_minutes', 'prep_time_sec', 'delivery_time_min', 'late_delivery_ratio',
               'complaint_count', 'complaint_ratio', 'rating_avg', 'rating_count', 'review_count',
               'ads_spend', 'ads_revenue', 'ads_roas',
               'market_avg_rating', 'market_avg_cancel_ratio', 'market_avg_complaint_ratio',
               # extra (TGO "Pazar Raporu" actually shows these):
               'market_avg_revenue', 'market_avg_orders', 'market_avg_visitors', 'market_avg_conversion_rate', 'market_avg_promo_order_ratio']
KEY_COLS = ['period_start', 'period_end', 'granularity', 'platform', 'brand', 'branch']

PHONE = re.compile(r'(\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[\w.]+')


def scrub(s):
    if s is None: return None
    s = str(s).replace('\r', ' ').strip()
    return EMAIL.sub('***', PHONE.sub('***', s)) or None


def num(x):
    if x is None or x == '': return None
    try: return float(x)
    except (TypeError, ValueError): return None


def pct(x):
    v = num(x)
    return None if v is None else round(v / 100, 6)


def ratio(x):  # value may come as 0-1 or 0-100
    v = num(x)
    if v is None: return None
    return round(v / 100, 6) if v > 1.0 else round(v, 6)


def local(ts):
    """epoch ms / ISO (UTC or offset) -> aware datetime in Istanbul"""
    if ts in (None, ''): return None
    if isinstance(ts, (int, float)): return dt.datetime.fromtimestamp(ts / 1000, TZ)
    s = str(ts).replace('Z', '+00:00')
    d = dt.datetime.fromisoformat(s)
    if d.tzinfo is None: d = d.replace(tzinfo=dt.timezone.utc)
    return d.astimezone(TZ)


def iso_local(ts):
    d = local(ts)
    return d.strftime('%Y-%m-%dT%H:%M:%S') if d else None


def r2(x):
    return None if x is None else round(x, 2)


# ---------------------------------------------------------------- stores
METRICS = defaultdict(dict)        # key tuple -> {col: value}
REVIEWS = {}                       # (platform, id) -> row
CANCELS = {}                       # (platform, order_ref) -> row
PRODUCTS = defaultdict(dict)       # key -> row
CAMPAIGNS = {}                     # key -> row
HOURLY = {}                        # key -> row
AD_STORES = {}                     # advert id -> branches it was listed under
ORDERS = defaultdict(dict)         # platform -> {order_id: record}  (merged across runs)
RUNS = []                          # raw run metadata for run_log
CUTOFF = {}                        # platform -> last complete day covered by its latest run
SOURCES = defaultdict(set)         # (platform, column) -> source description (for field_map)


def put(ps, pe, gran, platform, brand, branch, values, src=None):
    k = (ps, pe, gran, platform, brand, BRANCH.get(branch, branch))
    row = METRICS[k]
    for c, v in values.items():
        if v is not None:
            row[c] = v
            if src: SOURCES[(platform, c)].add(src)


def week_end(d): return (dt.date.fromisoformat(d) + dt.timedelta(days=6)).isoformat()


# ---------------------------------------------------------------- Yemeksepeti
def do_ys(run):
    for code, d in run['data'].items():
        v = d['vendor']; b, br = v.get('brand'), v.get('branch')
        if not b or not br: continue
        S = 'YS'
        for blk in d.get('performance') or []:
            for r in ((blk or {}).get('resp') or {}).get('data', []) or []:
                o, rev = num(r.get('orderCount')), num(r.get('revenue'))
                put(r['date'], r['date'], 'day', 'yemeksepeti', b, br, {'orders': o, 'cancelled_orders': num(r.get('cancelledOrderCount')), 'gross_revenue': rev,
                    'avg_basket': r2(rev / o) if o else None}, f'{S} Performans>Satış /reports/performance (DAY)')
        for blk in d.get('offline_duration') or []:
            for r in (((blk or {}).get('resp') or {}).get('data') or {}).get('dates', []) or []:
                off, sch = num(r.get('offlineDuration')), num(r.get('scheduledDuration'))
                put(r['date'], r['date'], 'day', 'yemeksepeti', b, br, {'offline_minutes': r2(off / 60) if off is not None else None, 'uptime_ratio': round(1 - off / sch, 6) if sch else None}, f'{S} Operasyon>Kapalı kalma /reports/offline_duration')
        for blk in d.get('prep_time') or []:
            for r in (((blk or {}).get('resp') or {}).get('data') or {}).get('dates', []) or []:
                put(r['date'], r['date'], 'day', 'yemeksepeti', b, br, {'prep_time_sec': num(r.get('avgPreparationTime')), 'late_delivery_ratio': pct(r.get('orderDelayRate'))}, f'{S} Operasyon>Hazırlık süresi /reports/prep_time')
        for blk in d.get('contact_rate') or []:
            for r in (((blk or {}).get('resp') or {}).get('data') or {}).get('dates', []) or []:
                t = r.get('totals') or {}
                put(r['date'], r['date'], 'day', 'yemeksepeti', b, br, {'complaint_count': num(t.get('contactsReceivedCounts')), 'complaint_ratio': pct(t.get('rate'))}, f'{S} Operasyon>Müşteri iletişim oranı /reports/contact-rate')
        for blk in d.get('order_rejection') or []:
            for r in (((blk or {}).get('resp') or {}).get('data') or {}).get('dates', []) or []:
                for rs in r.get('reasons') or []:
                    pass  # reasons are aggregated counts; order-level reasons come from ListOrders
        for x in d.get('customer_conversion') or []:
            j = ((x or {}).get('resp') or {}).get('data') or {}
            if not j: continue
            vis, buy = num(j.get('visitors')), num(j.get('buyers'))
            put(x['day'], x['day'], 'day', 'yemeksepeti', b, br, {'impressions': vis, 'menu_views': num(j.get('explorers')), 'add_to_cart': num(j.get('cart_viewers')), 'checkout_orders': buy,
                'conversion_rate': round(buy / vis, 6) if vis else None}, f'{S} Performans>Müşteriler>Siparişe Dönüşüm /reports/customer_conversion (from=to=gün)')
        for x in d.get('customer_retention') or []:
            j = ((x or {}).get('resp') or {}).get('data') or {}
            if j: put(x['day'], x['day'], 'day', 'yemeksepeti', b, br, {'new_customer_orders': num(j.get('new_customers')), 'returning_customer_orders': num(j.get('returning_customers'))}, f'{S} Performans>Müşteriler>Müşteri tipi /reports/customer_retention (from=to=gün)')
        for x in d.get('dishes') or []:
            for r in ((x or {}).get('resp') or {}).get('data', []) or []:
                k = (x['day'], x['day'], 'yemeksepeti', b, br, r.get('name'))
                PRODUCTS[k].update({'qty': num(r.get('orderCount')), 'revenue': num(r.get('revenue'))})
        for it in ((d.get('ratings_history') or {}).get('items') or []):
            if it.get('rating'): put(it['date'], it['date'], 'day', 'yemeksepeti', b, br, {'rating_avg': num(it['rating'])}, f'{S} Yorumlar>Şube puanı geçmişi /ratings/history (DAY)')
        for r in d.get('reviews') or []:
            rep = r.get('reply') or {}
            REVIEWS[('yemeksepeti', r['id'])] = dict(review_id=r['id'], platform='yemeksepeti', brand=b, branch=br, created_at_local=iso_local(r['date']), rating=r.get('rating'), taste_rating=None, service_rating=None,
                text=scrub(r.get('text')), products='; '.join(sorted({p.get('product_name') or p.get('name') or '' for p in (r.get('product_ratings') or []) if isinstance(p, dict)} - {''})) or None,
                replied='true' if rep.get('text') else 'false', reply_at_local=iso_local(rep.get('date')) if rep.get('text') else None)
        for o in d.get('orders') or []:
            ORDERS['yemeksepeti'][o['orderId']] = dict(o, brand=b, branch=br)
        for x in d.get('deals') or []:
            typ = 'joker' if (x.get('label') or '').lower() == 'joker' else ('full_menu' if 'tüm menü' in (x.get('title') or '').lower() else 'deal')
            CAMPAIGNS[('yemeksepeti', b, br, x.get('id'))] = dict(platform='yemeksepeti', brand=b, branch=br, campaign_name=scrub(x.get('title') or x.get('label')), type=typ, start_date=(x.get('startDate') or '')[:10] or None,
                end_date=((x.get('cancelledAt') or x.get('endDate') or '')[:10]) or None, status=x.get('status'), orders=None, discount_cost=None, new_customers=None, roas=None,
                _note=f"hedef={x.get('customerTargeting')}")
    if run.get('ratings_now'):
        for a in run['ratings_now'].get('avg_ratings', []):
            v = next((d['vendor'] for c, d in run['data'].items() if c == a.get('global_vendor_code')), None)
            if v and v.get('brand'):
                day = local(run['pulledAt']).date().isoformat()
                put(day, day, 'snapshot', 'yemeksepeti', v['brand'], v['branch'], {'rating_avg': num(a.get('avg_rating')), 'rating_count': num(a.get('total_ratings') or sum(x.get('rating_count', 0) for x in a.get('ratings', [])))}, 'YS Yorumlar (güncel puan özeti) /ratings')


def ys_from_orders():
    by_day = defaultdict(lambda: Counter()); net = defaultdict(float)
    for oid, o in ORDERS['yemeksepeti'].items():
        t = local(o.get('placedTimestamp'));
        if not t: continue
        day, b, br = t.date().isoformat(), o['brand'], o['branch']
        if day > CUTOFF.get('yemeksepeti', '9999'): continue
        st = (o.get('orderStatus') or '').upper()
        issues = [i.get('orderIssue') for i in (o.get('orderIssuesDetails') or [])]
        if st == 'CANCELLED':
            reason = '; '.join(filter(None, [((m or {}).get('reason')) for i in (o.get('orderIssuesDetails') or []) for m in (i.get('metadata') or [])])) or None
            code = next((i for i in issues if i and 'CANCEL' in i), None) or 'CANCELLED'
            CANCELS[('yemeksepeti', oid)] = dict(date=day, platform='yemeksepeti', brand=b, branch=br, order_ref=oid, reason_code=code, reason_text=scrub(reason), amount=num(o.get('subtotal')),
                                                  source='restaurant' if code == 'AVOIDABLE_CANCELLATION' else 'platform')
        else:
            HOURLY_ADD(day, 'yemeksepeti', b, br, t.hour)


def HOURLY_ADD(day, platform, b, br, hour, n=1):
    k = (day, platform, b, BRANCH.get(br, br), hour)
    row = HOURLY.setdefault(k, dict(date=day, platform=platform, brand=b, branch=BRANCH.get(br, br), hour=hour, orders=0, uptime_ratio=None, _src='orders'))
    if row.get('_src') == 'orders': row['orders'] = (row['orders'] or 0) + n


# ---------------------------------------------------------------- Trendyol GO
def do_tgo(run):
    for sid, d in run['data'].items():
        s = d['store']; b, br = s['brand'], s['branch']
        day_vals = defaultdict(dict)
        for mt, blks in (d.get('daily') or {}).items():
            for blk in blks or []:
                for metric, ms in ((((blk or {}).get('resp') or {}).get('metrics')) or {}).items():
                    for per in (ms or {}).get('periods', []): day_vals[per['startDate']][metric] = per.get('value')
        for day, m in day_vals.items():
            put(day, day, 'day', 'trendyolgo', b, br, {
                'orders': num(m.get('countCompletedOrder')), 'gross_revenue': num(m.get('sumNmv')), 'avg_basket': num(m.get('avgBasketAmount')), 'visitors': num(m.get('sumSessionCount')),
                'conversion_rate': pct(m.get('orderConversionRate')), 'promo_order_ratio': pct(m.get('promotionalOrderRatio')), 'ads_roas': num(m.get('adsRoas')),
                'uptime_ratio': ratio(m.get('uptimeRatio')), 'late_delivery_ratio': pct(m.get('overdue')), 'complaint_ratio': pct(m.get('complaintRatio'))}, 'TGO Performans Metrikleri analytics/metric DAILY_* (7 günlük pencere, günlük periods)')
        snap = d.get('snapshot') or {}
        hs = ((snap.get('HOURLY_SALES_METRIC') or {}).get('data') or {}).get('hourlyMetrics1w') or {}
        for r in hs.get('metrics', []) or []:
            if not r.get('hour') or not r.get('date'): continue
            hr = int(str(r['hour']).split(':')[0]); k = (r['date'], 'trendyolgo', b, br, hr)
            row = HOURLY.setdefault(k, dict(date=r['date'], platform='trendyolgo', brand=b, branch=br, hour=hr, orders=None, uptime_ratio=None, _src='panel'))
            row['orders'] = num(r.get('completedOrderCount')); row['_src'] = 'panel'
        hu = ((snap.get('HOURLY_UPTIME_METRIC') or {}).get('data') or {}).get('hourlyMetrics1w') or {}
        for r in hu.get('metrics', []) or []:
            if not r.get('hour') or not r.get('date'): continue
            hr = int(str(r['hour']).split(':')[0]); k = (r['date'], 'trendyolgo', b, br, hr)
            row = HOURLY.setdefault(k, dict(date=r['date'], platform='trendyolgo', brand=b, branch=br, hour=hr, orders=None, uptime_ratio=None, _src='panel'))
            row['uptime_ratio'] = ratio(r.get('uptimeRatio'))
        conv = ((snap.get('DAILY_SALES_CONVERSION_METRIC') or {}).get('data') or {})
        pulled = local(run['pulledAt']).date()
        for key, days, gran in [('conversionMetric1w', 7, 'week'), ('conversionMetric4w', 28, 'period'), ('conversionMetric12w', 84, 'period')]:
            c = conv.get(key)
            if c:
                ps = (pulled - dt.timedelta(days=days)).isoformat(); pe = (pulled - dt.timedelta(days=1)).isoformat()
                put(ps, pe, gran, 'trendyolgo', b, br, {'visitors': num(c.get('sumSessionCount')), 'add_to_cart': num(c.get('sumAddToCartSessionCount')), 'checkout_orders': num(c.get('sumSessionOrderCount') or c.get('sumOrderSessionCount'))}, 'TGO Performans>Siparişe Dönüşüm Süreci DAILY_SALES_CONVERSION_METRIC (1/4/12 hafta)')
        seg = (((snap.get('DAILY_CUSTOMER_SEGMENT_METRIC') or {}).get('data') or {}).get('customerSegmentMetric12w')) or {}
        if seg:
            ps = (pulled - dt.timedelta(days=84)).isoformat(); pe = (pulled - dt.timedelta(days=1)).isoformat()
            nc = seg.get('newCustomer') or {}; rc = seg.get('regularCustomer') or seg.get('returningCustomer') or {}
            put(ps, pe, 'period', 'trendyolgo', b, br, {'new_customer_orders': num(nc.get('countCompletedOrder') or nc.get('orderCount')), 'returning_customer_orders': num(rc.get('countCompletedOrder') or rc.get('orderCount'))}, 'TGO Müşteri segmenti DAILY_CUSTOMER_SEGMENT_METRIC (12 hafta)')
        cm = (((snap.get('DAILY_CUSTOMER_COMPLAINT_METRIC') or {}).get('data') or {}).get('complaintMetric12w')) or {}
        if cm:
            ps = (pulled - dt.timedelta(days=84)).isoformat(); pe = (pulled - dt.timedelta(days=1)).isoformat()
            put(ps, pe, 'period', 'trendyolgo', b, br, {'complaint_count': num(cm.get('customerComplaintCount')), 'complaint_ratio': pct(cm.get('customerComplaintRatio'))}, 'TGO Şikayet özeti DAILY_CUSTOMER_COMPLAINT_METRIC (12 hafta)')
        for p in ((((snap.get('DAILY_CUSTOMER_PRODUCT_REVIEW_METRIC') or {}).get('data') or {}).get('productReviewMetric12w')) or []):
            ps = (pulled - dt.timedelta(days=84)).isoformat(); pe = (pulled - dt.timedelta(days=1)).isoformat()
            PRODUCTS[(ps, pe, 'trendyolgo', b, br, p.get('productName'))].update({'like_ratio': pct(p.get('likeRate')), '_sales': num(p.get('productSalesAmount'))})
        rs = d.get('review_stats') or {}
        if rs:
            put(pulled.isoformat(), pulled.isoformat(), 'snapshot', 'trendyolgo', b, br, {'rating_avg': num((rs.get('averageScores') or {}).get('overall')), 'rating_count': num(rs.get('ratingCount'))}, 'TGO Değerlendirmeler özet /reviews/restaurants/{id}/stats')
        for r in d.get('reviews') or []:
            sc = r.get('score') or {}
            REVIEWS[('trendyolgo', r['reviewId'])] = dict(review_id=r['reviewId'], platform='trendyolgo', brand=b, branch=br, created_at_local=iso_local(r.get('createdDate')), rating=sc.get('overall'),
                taste_rating=sc.get('flavorScore'), service_rating=sc.get('serviceScore'), text=scrub(r.get('comment')), products=None,
                replied='true' if r.get('answer') else 'false', reply_at_local=iso_local(r.get('answerDate')) if r.get('answer') else None)
        for p in d.get('packages') or []:
            if p.get('testPackage'): continue
            key = f"{p.get('orderId')}|{p.get('orderStatus')}"
            ORDERS['trendyolgo'][key] = dict(p, brand=b, branch=br)
        for p in d.get('cancelled') or []:
            if p.get('testPackage'): continue
            ORDERS['trendyolgo_cancel'][str(p.get('orderId'))] = dict(p, brand=b, branch=br)
    for m in run.get('market_report') or []:
        if not m or m.get('missing'): continue
        s = next((x for x in TGO_STORE_MAP if x['id'] == str(m.get('store_id'))), None)
        if not s: continue
        pulled = local(run['pulledAt']).date(); last_mon = pulled - dt.timedelta(days=pulled.weekday() + 7)
        g = lambda k, sub: (m.get(k) or {}).get(sub)
        put(last_mon.isoformat(), (last_mon + dt.timedelta(days=6)).isoformat(), 'week', 'trendyolgo', s['brand'], s['branch'], {
            'market_avg_revenue': g('revenue', 'market'), 'market_avg_orders': g('orders', 'market'), 'market_avg_visitors': g('visitors', 'market'),
            'market_avg_conversion_rate': (g('conversion', 'market') or 0) / 100 if g('conversion', 'market') is not None else None,
            'market_avg_promo_order_ratio': (g('promo_ratio', 'market') or 0) / 100 if g('promo_ratio', 'market') is not None else None}, 'TGO Performans>Pazar Raporu (sayfa metni; şube eşleşmesi doğrulanmadı)')
    for a in run.get('adverts') or []:
        st = a.get('stats') or {}
        v = lambda k: (st.get(k) or [{}])[0].get('value')
        sm = next((x for x in TGO_STORE_MAP if x['id'] == str(a.get('store_id'))), None)
        b = sm['brand'] if sm else next((x['brand'] for x in TGO_STORE_MAP if x['supplier'] == run.get('supplier')), None)
        if not b: continue
        AD_STORES.setdefault(a['id'], set()).add(sm['branch'] if sm else 'all')
        # an ad listed under several branches targets all of them: keep one row with branch=all
        br = next(iter(AD_STORES[a['id']])) if len(AD_STORES[a['id']]) == 1 else 'all'
        for k in [k for k in CAMPAIGNS if k[0] == 'trendyolgo' and k[3] == a['id']]: del CAMPAIGNS[k]
        CAMPAIGNS[('trendyolgo', b, br, a['id'])] = dict(platform='trendyolgo', brand=b, branch=br, campaign_name=a.get('name'), type='ad', start_date=(a.get('startAt') or '')[:10] or None,
            end_date=((a.get('actualEndAt') or a.get('endAt') or '') or '')[:10] or None, status=a.get('status'), orders=num(v('OrderCount')),
            discount_cost=r2(num(v('BudgetSpent')) / 100) if v('BudgetSpent') is not None else None, new_customers=num(v('NewBuyerCount')), roas=num(v('Roas')),
            _note=f"reklam cirosu={r2(num(v('TotalRevenue'))/100) if v('TotalRevenue') is not None else ''} TL; gösterim={v('ImpressionCount')}; tıklama={v('ClickCount')}; discount_cost=reklam harcaması")


TGO_STORE_MAP = [
    {'id': '336068', 'supplier': '1078227', 'brand': 'kcalculate', 'branch': 'basin'}, {'id': '468410', 'supplier': '1078227', 'brand': 'kcalculate', 'branch': 'bayrakli'},
    {'id': '456386', 'supplier': '6725507', 'brand': 'terabowl', 'branch': 'basin'}, {'id': '468415', 'supplier': '6725507', 'brand': 'terabowl', 'branch': 'bayrakli'},
    {'id': '293817', 'supplier': '989799', 'brand': 'breakingfast', 'branch': 'basin'}, {'id': '468407', 'supplier': '989799', 'brand': 'breakingfast', 'branch': 'bayrakli'}]


def tgo_discount(p):
    dd = p.get('discount') or {}
    seller = (dd.get('seller') or {})
    items = []
    for kind in ('promotions', 'coupons'):
        for x in seller.get(kind) or []:
            items.append((kind, x.get('name') or x.get('title') or x.get('promotionName') or kind, num(x.get('amount') or x.get('discountAmount') or x.get('price') or x.get('total'))))
    return num(seller.get('total')), items


def tgo_from_orders():
    agg = defaultdict(lambda: defaultdict(float)); camp = defaultdict(lambda: {'orders': 0, 'cost': 0.0, 'first': None, 'last': None, 'kind': None})
    for key, p in ORDERS['trendyolgo'].items():
        t = local(p.get('createdDate'))
        if not t: continue
        day, b, br = t.date().isoformat(), p['brand'], p['branch']
        if day > CUTOFF.get('trendyolgo', '9999'): continue
        st = p.get('orderStatus'); grp = p.get('appGroup')
        tot, disc = num(p.get('totalPrice')) or 0, num(p.get('totalDiscountPrice')) or 0
        for platform in (['trendyolgo', 'trendyolgo_getir'] if grp == 'getir' else ['trendyolgo']):
            a = agg[(day, platform, b, br)]
            if st == 'Delivered':
                a['orders'] += 1; a['gross'] += tot; a['disc'] += disc; a['net'] += tot - disc
                if disc > 0: a['promo'] += 1
                if (p.get('badges') or {}).get('sellerRefund'): a['refunded'] += 1
                if (p.get('badges') or {}).get('sponsoredOrder'): a['sponsored'] += 1
            elif st == 'Cancelled':
                a['cancelled'] += 1
        if st == 'Delivered':
            for ln in p.get('lines') or []:
                k = (day, day, 'trendyolgo', b, br, ln.get('name'))
                row = PRODUCTS[k]; row['_o_qty'] = row.get('_o_qty', 0) + (ln.get('qty') or 1); row['_o_rev'] = row.get('_o_rev', 0) + (num(ln.get('price')) or 0)
                if (p.get('badges') or {}).get('sellerRefund'): row['refund_count'] = (row.get('refund_count') or 0) + 1
            total_seller, items = tgo_discount(p)
            for kind, name, amt in items:
                c = camp[(b, br, name)]; c['orders'] += 1; c['cost'] += amt or 0; c['kind'] = kind
                c['first'] = min(filter(None, [c['first'], day])); c['last'] = max(filter(None, [c['last'], day]))
            HOURLY_ADD(day, 'trendyolgo_orders', b, br, t.hour)
        elif st == 'Cancelled':
            for ln in p.get('lines') or []:
                row = PRODUCTS[(day, day, 'trendyolgo', b, br, ln.get('name'))]; row['cancel_count'] = (row.get('cancel_count') or 0) + 1
    for (day, platform, b, br), a in agg.items():
        vals = {'cancelled_orders': a['cancelled'] or None if a['cancelled'] else 0 if a['orders'] else None,
                'refunded_orders': a['refunded'] if a['orders'] else None, 'discount_amount': r2(a['disc']) if a['orders'] else None, 'net_revenue': r2(a['net']) if a['orders'] else None}
        if platform == 'trendyolgo_getir':
            vals.update({'orders': a['orders'] or None, 'gross_revenue': r2(a['gross']) if a['orders'] else None, 'promo_order_ratio': round(a['promo'] / a['orders'], 6) if a['orders'] else None})
        else:
            row = METRICS.get((day, day, 'day', 'trendyolgo', b, br), {})
            if row.get('orders') is None and a['orders']:  # analytics not available for this day → order history
                vals.update({'orders': a['orders'], 'gross_revenue': r2(a['gross']), 'avg_basket': r2(a['gross'] / a['orders']), 'promo_order_ratio': round(a['promo'] / a['orders'], 6)})
                SOURCES[('trendyolgo', 'orders')].add('TGO Sipariş>Geçmiş Siparişler packages/filter (analytics olmayan günlerde)')
        put(day, day, 'day', platform, b, br, {k: v for k, v in vals.items() if v is not None}, 'TGO Sipariş>Geçmiş/İptal Siparişler packages/filter')
    for (b, br, name), c in camp.items():
        CAMPAIGNS[('trendyolgo', b, br, name)] = dict(platform='trendyolgo', brand=b, branch=br, campaign_name=scrub(name), type='coupon' if c['kind'] == 'coupons' else 'promotion',
            start_date=c['first'], end_date=c['last'], status=None, orders=c['orders'], discount_cost=r2(c['cost']) if c['cost'] else None, new_customers=None, roas=None,
            _note='siparişlerdeki satıcı indirim dağılımından; tarih=ilk/son kullanım')
    for oid, p in ORDERS['trendyolgo_cancel'].items():
        t = local(p.get('cancelDate') or p.get('createdDate'))
        txt = p.get('cancellationReasonText') or ''
        src = 'restaurant' if ((p.get('badges') or {}).get('sellerCancellation') or re.search(r'sizin tarafınızdan|restoran tarafından', txt, re.I)) else ('customer' if re.search(r'müşteri|vazgeç|isteğiniz', txt, re.I) else ('courier' if re.search(r'kurye', txt, re.I) else 'platform'))
        CANCELS[('trendyolgo', oid)] = dict(date=t.date().isoformat() if t else None, platform='trendyolgo' if p.get('appGroup') != 'getir' else 'trendyolgo_getir', brand=p['brand'], branch=p['branch'],
            order_ref=p.get('orderParentId') or oid, reason_code='sellerCancellation' if (p.get('badges') or {}).get('sellerCancellation') else None, reason_text=scrub(txt), amount=num(p.get('totalPrice')), source=src)


# ---------------------------------------------------------------- Migros
def do_migros(run):
    def iso_from(text):
        m = re.match(r'^(\d{2})\.(\d{2})\.(\d{4})$', str(text))
        return f'{m.group(3)}-{m.group(2)}-{m.group(1)}' if m else None
    for sid, d in run['data'].items():
        s = d['store']; b, br = s['brand'], s['branch']
        def vals(r):
            o = r.get('orderCount')
            return {'orders': o, 'cancelled_orders': r.get('cancelledOrderCount'), 'gross_revenue': r2(r['totalIncome'] / 100) if r.get('totalIncome') is not None else None,
                    'avg_basket': r2(r['averageCartAmount'] / 100) if r.get('averageCartAmount') is not None else None, 'uptime_ratio': ratio(r.get('opennessRate')),
                    'delivery_time_min': r.get('averageDeliveryTime') or None, 'rating_avg': r.get('averageUserRating') or None}
        for r in d.get('daily') or []:
            day = iso_from(r.get('dateText'))
            if day: put(day, day, 'day', 'migros', b, br, vals(r), 'Migros Performans GetStatistics/{id}/Daily (son 30 gün)')
        for r in d.get('weekly') or []:
            y, w = map(int, r['dateText'].split('-')); ps = dt.date.fromisocalendar(y, w, 1).isoformat()
            put(ps, week_end(ps), 'week', 'migros', b, br, vals(r), 'Migros Performans GetStatistics/{id}/Weekly (son 12 hafta)')
        for r in d.get('monthly') or []:
            y, mo = map(int, r['dateText'].split('-')); ps = dt.date(y, mo, 1); pe = (dt.date(y + (mo == 12), mo % 12 + 1, 1) - dt.timedelta(days=1))
            put(ps.isoformat(), pe.isoformat(), 'month', 'migros', b, br, vals(r), 'Migros Performans GetStatistics/{id}/Monthly (son 7 ay)')
        fc = d.get('feedback_counts') or {}
        if fc:
            day = local(run['pulledAt']).date().isoformat(); n = sum(fc.get(k) or 0 for k in ('excellent', 'good', 'normal', 'bad', 'worst'))
            put(day, day, 'snapshot', 'migros', b, br, {'rating_count': n or None}, 'Migros Müşteri Değerlendirmeleri GetFeedbacksStoreCounts')
        for r in d.get('feedbacks') or []:
            sc = r.get('score') or {}; parts = [x for x in (sc.get('taste'), sc.get('service'), sc.get('speed')) if x is not None]
            REVIEWS[('migros', r['id'])] = dict(review_id=r['id'], platform='migros', brand=b, branch=br, created_at_local=iso_local(r.get('createdAt')), rating=round(statistics.mean(parts), 2) if parts else None,
                taste_rating=sc.get('taste'), service_rating=sc.get('service'), text=scrub(r.get('comment')), products=None, replied='true' if r.get('answer') else 'false', reply_at_local=None)
        for o in d.get('orders') or []:
            ORDERS['migros'][o['id']] = dict(o, brand=b, branch=br)
        sd = (d.get('star_discount') or {})
        rep = sd.get('report') or {}
        if rep:
            CAMPAIGNS[('migros', b, br, 'star')] = dict(platform='migros', brand=b, branch=br, campaign_name='Star İndirim', type='star_discount', start_date=None, end_date=None,
                status='katıldı' if (sd.get('storeStatuses') or {}).get('participated') else 'katılmadı', orders=rep.get('totalUsageCount'), discount_cost=None, new_customers=None, roas=None,
                _note=f"şimdiye dek: gösterim={rep.get('totalDisplayCount')}, ciro={rep.get('totalOrderRevenue')}")
        for kind in ('coupons_active', 'coupons_expired'):
            for c in d.get(kind) or []:
                CAMPAIGNS[('migros', b, br, 'coupon-' + str(c.get('id')))] = dict(platform='migros', brand=b, branch=br, campaign_name=scrub(c.get('name') or c.get('code')), type='coupon',
                    start_date=str(c.get('startDate') or '')[:10] or None, end_date=str(c.get('endDate') or '')[:10] or None, status='aktif' if kind == 'coupons_active' else 'bitti', orders=c.get('usageCount'), discount_cost=None, new_customers=None, roas=None)


def migros_from_orders():
    agg = defaultdict(lambda: defaultdict(float))
    for oid, o in ORDERS['migros'].items():
        t = local(o.get('createdAt'))
        if not t: continue
        day, b, br = t.date().isoformat(), o['brand'], o['branch']
        if day > CUTOFF.get('migros', '9999'): continue
        tot = (num(o.get('totalPrice')) or 0) / 100; paid = (num(o.get('discountedPrice')) or 0) / 100
        rest_disc = tot - (num(o.get('restaurantDiscountedPrice')) or o.get('totalPrice') or 0) / 100
        a = agg[(day, b, br)]
        if o.get('cancelled'):
            a['cancelled'] += 1
            src = 'customer' if re.search(r'müşteri', o.get('cancelReason') or '', re.I) else ('restaurant' if re.search(r'restoran|stok|kapalı', o.get('cancelReason') or '', re.I) else 'platform')
            CANCELS[('migros', oid)] = dict(date=day, platform='migros', brand=b, branch=br, order_ref=oid, reason_code=o.get('status'), reason_text=scrub(o.get('cancelReason')), amount=r2(tot), source=src)
            for p in o.get('products') or []:
                row = PRODUCTS[(day, day, 'migros', b, br, p.get('name'))]; row['cancel_count'] = (row.get('cancel_count') or 0) + 1
            continue
        a['orders'] += 1; a['disc'] += tot - paid; a['net'] += paid; a['rest_disc'] += rest_disc
        if tot - paid > 0.001: a['promo'] += 1
        HOURLY_ADD(day, 'migros', b, br, t.hour)
        for p in o.get('products') or []:
            row = PRODUCTS[(day, day, 'migros', b, br, p.get('name'))]; row['qty'] = (row.get('qty') or 0) + (p.get('amount') or 1); row['revenue'] = r2((row.get('revenue') or 0) + (num(p.get('price')) or 0) / 100 * (p.get('amount') or 1))
    for (day, b, br), a in agg.items():
        put(day, day, 'day', 'migros', b, br, {'discount_amount': r2(a['disc']) if a['orders'] else None, 'net_revenue': r2(a['net']) if a['orders'] else None,
            'promo_order_ratio': round(a['promo'] / a['orders'], 6) if a['orders'] else None}, 'Migros Siparişler>Geçmiş Siparişler PassiveOrdersV2 (son ~30 gün)')


# ---------------------------------------------------------------- Getir (frozen)
def do_getir(run):
    for rid, d in run['data'].items():
        s = d['store']; b, br = s['brand'], s.get('branch') or 'basin'
        for x in d.get('daily_financial') or []:
            j = (x or {}).get('resp') or {}
            if not j: continue
            o = num((j.get('orderCount') or {}).get('totalOrderCount')); rev = num((j.get('revenue') or {}).get('totalRevenue'))
            put(x['day'], x['day'], 'day', 'getir', b, br, {'orders': o, 'gross_revenue': rev, 'avg_basket': num((j.get('averageBasketSize') or {}).get('totalAverageBasketSize')) or (r2(rev / o) if o else None)},
                'Getir Anasayfa>Finansal Durum statistics/financial-status (from=to=gün)')
        day = local(run['pulledAt']).date().isoformat()
        rt = d.get('ratings') or {}
        if rt: put(day, day, 'snapshot', 'getir', b, br, {'rating_avg': num(rt.get('restaurantRating')), 'rating_count': num(rt.get('restaurantRatingCount'))}, 'Getir Yorumlar /ratings')
        op = d.get('order_performance') or {}
        if op:
            g = lambda k: (op.get(k) or {}).get('ratio')
            put(day, day, 'snapshot', 'getir', b, br, {'uptime_ratio': pct(g('restaurantAvailabilityRatio')), 'complaint_ratio': pct(g('chatRatio'))}, 'Getir Sipariş Performansı (son 30 gün; kapanış sonrası anlamsız olabilir)')
        for r in d.get('reviews') or []:
            REVIEWS[('getir', r['id'])] = dict(review_id=r['id'], platform='getir', brand=b, branch=br, created_at_local=None, rating=r.get('rating'), taste_rating=None, service_rating=None,
                text=scrub(r.get('comment')), products=None, replied=None, reply_at_local=None)


HANDLERS = {'yemeksepeti': do_ys, 'trendyolgo': do_tgo, 'migros': do_migros, 'getir': do_getir}


# ---------------------------------------------------------------- write
COUNT_COLS = {'orders', 'cancelled_orders', 'refunded_orders', 'impressions', 'menu_views', 'add_to_cart', 'checkout_orders', 'visitors',
              'new_customer_orders', 'returning_customer_orders', 'complaint_count', 'rating_count', 'review_count', 'qty', 'cancel_count',
              'refund_count', 'new_customers', 'market_avg_orders', 'market_avg_visitors'}


def cell(c, v):
    if v is None: return ''
    if c in COUNT_COLS and isinstance(v, float) and v.is_integer(): return int(v)
    return v


def write_csv(name, rows, cols):
    with open(os.path.join(OUT, name), 'w', newline='', encoding='utf-8') as fh:
        w = csv.DictWriter(fh, fieldnames=cols, extrasaction='ignore'); w.writeheader()
        for r in rows: w.writerow({c: cell(c, r.get(c)) for c in cols})


def main():
    os.makedirs(OUT, exist_ok=True)
    files = sorted({p for g in RAW_GLOBS for p in glob.glob(g)})
    raws = []
    for p in files:
        try:
            j = json.load(open(p, encoding='utf-8'))
            if j.get('schema') == 'kcal-platform-raw/v1': raws.append((j.get('pulledAt'), p, j))
        except Exception as e:
            RUNS.append({'file': p, 'error': str(e)})
    raws.sort(key=lambda x: x[0] or '')
    for pulled, p, j in raws:
        HANDLERS[j['platform']](j)
        if (j.get('range') or {}).get('to'): CUTOFF[j['platform']] = max(CUTOFF.get(j['platform'], ''), j['range']['to'])
        RUNS.append({'file': p, 'platform': j['platform'], 'mode': j.get('mode'), 'pulledAt': pulled, 'range': j.get('range'), 'stores': list(j.get('data', {}).keys()),
                     'errors': j.get('errors', []), 'checks': j.get('checks', {}), 'notes': j.get('notes', []), 'raw': j})
    ys_from_orders(); tgo_from_orders(); migros_from_orders()
    rc = Counter()
    for r in REVIEWS.values():
        if r.get('created_at_local'): rc[(r['created_at_local'][:10], r['platform'], r['brand'], r['branch'])] += 1
    for (day, plat, b, br), n in rc.items():
        if day <= CUTOFF.get(plat, '9999'): put(day, day, 'day', plat, b, br, {'review_count': n}, 'reviews.csv (o gün gelen yorum sayısı)')

    # products: order-derived qty/revenue for TGO where no panel value
    prows = []
    for (ps, pe, platform, b, br, name), r in PRODUCTS.items():
        if not name: continue
        row = dict(period_start=ps, period_end=pe, platform=platform, brand=b, branch=BRANCH.get(br, br), product_name=scrub(name), qty=r.get('qty', r.get('_o_qty')), revenue=r.get('revenue', r2(r['_o_rev']) if r.get('_o_rev') is not None else None),
                   cancel_count=r.get('cancel_count'), refund_count=r.get('refund_count'), like_ratio=r.get('like_ratio'))
        prows.append(row)
    mrows = [dict(zip(KEY_COLS, k), **v) for k, v in METRICS.items() if any(v.get(c) is not None for c in METRIC_COLS)]
    mrows.sort(key=lambda r: (r['platform'], r['brand'], r['branch'], r['granularity'], r['period_start']))
    write_csv('platform_metrics.csv', mrows, KEY_COLS + METRIC_COLS)
    write_csv('reviews.csv', sorted(REVIEWS.values(), key=lambda r: (r['platform'], r['created_at_local'] or '')), ['review_id', 'platform', 'brand', 'branch', 'created_at_local', 'rating', 'taste_rating', 'service_rating', 'text', 'products', 'replied', 'reply_at_local'])
    write_csv('cancellations.csv', sorted(CANCELS.values(), key=lambda r: (r['date'] or '', r['platform'])), ['date', 'platform', 'brand', 'branch', 'order_ref', 'reason_code', 'reason_text', 'amount', 'source'])
    write_csv('products.csv', sorted(prows, key=lambda r: (r['platform'], r['brand'], r['branch'], r['period_start'], r['product_name'] or '')), ['period_start', 'period_end', 'platform', 'brand', 'branch', 'product_name', 'qty', 'revenue', 'cancel_count', 'refund_count', 'like_ratio'])
    write_csv('campaigns.csv', sorted(CAMPAIGNS.values(), key=lambda r: (r['platform'], r['brand'], r['start_date'] or '')), ['platform', 'brand', 'branch', 'campaign_name', 'type', 'start_date', 'end_date', 'status', 'orders', 'discount_cost', 'new_customers', 'roas', '_note'])
    hrows = []
    for k, r in HOURLY.items():
        if r['platform'] == 'trendyolgo_orders':  # order-derived TGO hours only where panel hourly is missing
            pk = (r['date'], 'trendyolgo', r['brand'], r['branch'], r['hour'])
            if pk in HOURLY: continue
            r = dict(r, platform='trendyolgo')
        hrows.append(r)
    write_csv('hourly.csv', sorted(hrows, key=lambda r: (r['platform'], r['brand'], r['branch'], r['date'], r['hour'])), ['date', 'platform', 'brand', 'branch', 'hour', 'orders', 'uptime_ratio'])
    write_field_map(mrows)
    write_run_log(mrows)
    print('OK', OUT, 'metrics', len(mrows), 'reviews', len(REVIEWS), 'cancellations', len(CANCELS), 'products', len(prows), 'campaigns', len(CAMPAIGNS), 'hourly', len(hrows))


FIELD_NOTES = {
    'gross_revenue': 'Panelin "Ciro" kartı (platforma göre tanım farklı). YS: sipariş değerleri (panel notu: indirim/kupon/teslimat ücreti dahil değil). TGO: sumNmv = sipariş liste tutarı, indirim öncesi (analytics olmayan günlerde sipariş geçmişi totalPrice toplamı; aynı tanım). Migros: totalIncome/100 = liste tutarı − restoran indirimi (Migros indirimi düşülmemiş); bu yüzden Migros\'ta gross − discount ≠ net. Getir: totalRevenue.',
    'discount_amount': 'Toplam indirim (restoran + platform). TGO: totalDiscountPrice; Migros: totalPrice − discountedPrice. YS ve Getir panelinde sipariş bazlı indirim yok.',
    'net_revenue': 'gross − indirim = müşterinin ödediği ürün tutarı (sipariş geçmişinden). Platform komisyonu düşülmemiştir.',
    'conversion_rate': '0–1 oranı. YS: buyers/visitors (gösterimden siparişe). TGO: orderConversionRate (ziyaretten siparişe).',
    'uptime_ratio': '0–1. YS: 1 − kapalı/planlı süre. TGO: uptimeRatio. Migros: opennessRate. Getir: son 30 gün açıklık (snapshot).',
    'late_delivery_ratio': 'YS: orderDelayRate (restoran kaynaklı hazırlık gecikmesi). TGO: overdue/100 — tanımı panelde doğrulanmadı.',
    'complaint_count': 'YS: müşteri temas (contact) sayısı. TGO: 12 haftalık şikayet sayısı (period satırı).',
    'rating_avg': 'YS: günlük şube puanı (birikimli). Migros: günlük/haftalık/aylık ortalama kullanıcı puanı. TGO/Getir: sadece snapshot.',
    'ads_roas': 'TGO günlük adsRoas (çoğu gün boş). Reklam harcaması kampanya bazında campaigns.csv\'de (type=ad, discount_cost=harcama).',
}


def write_field_map(mrows):
    plats = ['yemeksepeti', 'trendyolgo', 'trendyolgo_getir', 'migros', 'getir']
    L = ['# field_map — platform_metrics.csv sütun kaynakları', '',
         'Satır anahtarı: period_start, period_end, granularity (day/week/month; ayrıca `period` = 4/12 haftalık panel penceresi, `snapshot` = çekim anındaki değer), platform, brand, branch.',
         'Oranlar 0–1 aralığında. Para birimi TL. Zaman Europe/Istanbul. Boş hücre = platform bu metriği bu dönem için vermiyor (0 yazılmaz).', '',
         '**Önemli:** `trendyolgo` satırları Getir uygulamasından gelip Trendyol paneline düşen siparişleri İÇERİR. `trendyolgo_getir` bunların alt kırılımıdır (sipariş geçmişindeki Platform Tipi = GetirYemek / appName=Galaxy). Toplam alırken ikisini birlikte toplamayın.', '',
         '**YS notu:** Yemeksepeti günlük satış raporu sipariş olmayan günleri hiç döndürmez; o günlerde `orders` boş kalır.', '']
    L.append('| Sütun | ' + ' | '.join(plats) + ' | Not |'); L.append('|---|' + '---|' * (len(plats) + 1))
    for c in METRIC_COLS:
        cells = []
        for p in plats:
            src = sorted(SOURCES.get((p, c), []))
            filled = sum(1 for r in mrows if r['platform'] == p and r.get(c) is not None)
            cells.append(('<br>'.join(src) + f' ({filled} satır)') if src else 'YOK')
        L.append(f'| `{c}` | ' + ' | '.join(cells) + f" | {FIELD_NOTES.get(c, '')} |")
    L += ['', '## Bulunamayan / eşlenemeyen alanlar', '',
          '- `market_avg_rating`, `market_avg_cancel_ratio`, `market_avg_complaint_ratio`: TGO Pazar Raporu bu metrikleri göstermiyor (ciro, sipariş, ziyaretçi, dönüşüm, promosyonlu oran gösteriyor). Bu yüzden boş; gösterilenler ek `market_avg_*` sütunlarına yazıldı.',
          '- `refunded_orders`: sadece TGO (sipariş rozetinde sellerRefund). YS, Migros, Getir panelinde sipariş bazlı iade alanı yok.',
          '- `impressions`/`menu_views`: sadece YS (gün bazında). TGO\'da gösterim yok; `visitors` = mağaza sayfası oturumu.',
          '- `add_to_cart`/`checkout_orders`: YS günlük; TGO sadece 1/4/12 haftalık toplam.',
          '- `new_customer_orders`: YS günlük; TGO 12 haftalık; Migros/Getir yok.',
          '- `prep_time_sec`: sadece YS. Migros averageCollectionDuration ve TGO wtpu tanımları doğrulanamadığı için eşlenmedi.',
          '- `delivery_time_min`: sadece Migros.',
          '- `ads_spend`/`ads_revenue` günlük: hiçbir panel günlük vermiyor. TGO reklamları kampanya bazında campaigns.csv\'de. YS reklam hesabı boş; Migros reklamı çekilmedi.',
          '- Getir: 01.09.2026\'da kapandı. Geçmiş 23.10.2025–31.08.2026 bir kez çekildi ve dondu.',
          '', '## Diğer dosyalar', '',
          '- **reviews.csv**: YS /reviews, TGO /reviews/restaurants/{id}/filter (taste=lezzet, service=servis), Migros GetFeedBacks (taste, service; rating = lezzet/servis/hız ortalaması), Getir /reviews (tarih yok, yanıt durumu yok).',
          '- **cancellations.csv**: YS ListOrders (CANCELLED; reason_code=orderIssue), TGO cancelled/stores/filter (reason_text panel metni; source: sellerCancellation→restaurant, metinde müşteri/kurye geçiyorsa customer/courier, diğerleri platform — sezgisel), Migros PassiveOrdersV2 (cancelReason; son 30 gün).',
          '- **products.csv**: YS /reports/dishes (gün bazında), TGO sipariş satırları (gün; cancel/refund sayıları) + 12 haftalık beğeni oranı, Migros sipariş ürünleri (son 30 gün).',
          '- **campaigns.csv**: YS deals/search (Joker vb.; sipariş/maliyet yok), TGO sipariş indirim dağılımı (promosyon/kupon adı, sipariş sayısı, restoran maliyeti) + reklamlar (type=ad, discount_cost=harcama), Migros Star İndirim + kuponlar.',
          '- **hourly.csv**: YS ListOrders saatleri, TGO HOURLY_SALES + HOURLY_UPTIME (son 1 hafta) / sipariş geçmişi, Migros sipariş saatleri (son 30 gün).']
    open(os.path.join(OUT, 'field_map.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')


def write_run_log(mrows):
    L = [f"# run_log — {dt.datetime.now(TZ).strftime('%Y-%m-%d %H:%M')} (Europe/Istanbul)", '']
    # latest run that contains each store (a weekly run of one profile must not hide another store's data)
    store_run = {}
    for r in RUNS:
        if not r.get('platform'): continue
        for sid in r['stores']:
            store_run[(r['platform'], sid)] = r
    def meta_of(r, sid):
        m = r['raw']['data'].get(sid) or {}; s = m.get('vendor') or m.get('store') or {}
        return s.get('brand'), BRANCH.get(s.get('branch'), s.get('branch'))
    L += ['## Çalıştırmalar', '', '| Platform | Mod | Çekim zamanı | Aralık | Mağaza | Hata |', '|---|---|---|---|---:|---:|']
    for r in RUNS:
        if 'error' in r: L.append(f"| ? | — | — | {r['file']} | — | okunamadı: {r['error']} |"); continue
        rg = r.get('range') or {}
        L.append(f"| {r['platform']} | {r['mode']} | {iso_local(r['pulledAt'])} | {rg.get('from') or '—'} – {rg.get('to') or '—'} | {len(r['stores'])} | {len(r['errors'])} |")
    L += ['', '## Son 7 gün sipariş kontrolü (günlük satırlar toplamı vs panelin aynı aralık için verdiği toplam)', '',
          '| Platform | Marka | Şube | Aralık | Günlük toplam | Panel | Fark | Durum |', '|---|---|---|---|---:|---:|---:|---|']
    for (plat, sid), r in sorted(store_run.items()):
        ck = (r.get('checks') or {}).get(sid)
        if not ck: continue
        b, br = meta_of(r, sid)
        tot = sum((x.get('orders') or 0) for x in mrows if x['platform'] == plat and x['brand'] == b and x['branch'] == br and x['granularity'] == 'day' and ck['from'] <= x['period_start'] <= ck['to'])
        pv = ck.get('panel_orders'); diff = None if pv is None else tot - pv
        ok = 'panel değeri alınamadı' if pv is None else ('OK' if abs(diff) <= max(1, 0.02 * max(pv, 1)) else 'FARK')
        L.append(f"| {plat} | {b} | {br} | {ck['from']} – {ck['to']} | {tot:.0f} | {'' if pv is None else f'{pv:.0f}'} | {'' if diff is None else f'{diff:+.0f}'} | {ok} |")
    ys_runs = {sid: r for (plat, sid), r in store_run.items() if plat == 'yemeksepeti'}
    if ys_runs:
        L += ['', 'Yemeksepeti ek kontrol — sipariş listesi (ListOrders, iptal hariç) ile satış raporu, son 7 gün:']
        for sid, r in sorted(ys_runs.items()):
            ck = r['checks'].get(sid) or {}; b, br = meta_of(r, sid)
            n = sum(1 for o in ORDERS['yemeksepeti'].values() if o['brand'] == b and o['branch'] == br and (o.get('orderStatus') or '').upper() != 'CANCELLED' and local(o['placedTimestamp']) and ck.get('from', '9') <= local(o['placedTimestamp']).date().isoformat() <= ck.get('to', '0'))
            L.append(f"- {b}/{br}: liste {n}, rapor {ck.get('panel_orders')}" + ('' if n == ck.get('panel_orders') else '  ← FARK'))
    tg_runs = {sid: r for (plat, sid), r in store_run.items() if plat == 'trendyolgo'}
    if tg_runs:
        L += ['', 'Trendyol GO ek kontrol — sipariş geçmişi (teslim edilen) ile analitik raporu, son 7 gün:']
        for sid, r in sorted(tg_runs.items()):
            ck = r['checks'].get(sid) or {}; b, br = meta_of(r, sid)
            n = sum(1 for p in ORDERS['trendyolgo'].values() if p['brand'] == b and p['branch'] == br and p.get('orderStatus') == 'Delivered' and local(p.get('createdDate')) and ck.get('from', '9') <= local(p['createdDate']).date().isoformat() <= ck.get('to', '0'))
            L.append(f"- {b}/{br}: sipariş geçmişi {n}, analitik {ck.get('panel_orders')}")
    L += ['', '## Eksik gün', '', 'Günlük satırı (sipariş değeri) olmayan günler, her mağazanın son çekim aralığında. Yemeksepeti sipariş olmayan günleri hiç döndürmez; bu yüzden YS için sadece ilk ve son siparişli gün arasındaki boşluklar sayılır.', '']
    for (plat, sid), r in sorted(store_run.items()):
        rg = r.get('range') or {}
        if not rg.get('from'): continue
        b, br = meta_of(r, sid)
        start = rg.get('analytics_from') or rg['from']
        if plat == 'migros': start = (dt.date.fromisoformat(rg['to']) - dt.timedelta(days=29)).isoformat()
        have = sorted(x['period_start'] for x in mrows if x['platform'] == plat and x['brand'] == b and x['branch'] == br and x['granularity'] == 'day' and x.get('orders') is not None and start <= x['period_start'] <= rg['to'])
        if plat == 'yemeksepeti' and have: start = have[0]
        days = []; d0 = dt.date.fromisoformat(start)
        while d0.isoformat() <= rg['to']: days.append(d0.isoformat()); d0 += dt.timedelta(days=1)
        hs = set(have); miss = [d for d in days if d not in hs]
        L.append(f"- {plat} {b}/{br} ({start} – {rg['to']}): {len(miss)} gün" + (f" — ilk 8: {', '.join(miss[:8])}" if miss else ''))
    dup = Counter(tuple(r[c] for c in KEY_COLS) for r in mrows)
    L += ['', '## Mükerrer satır', '', f"- platform_metrics anahtar tekrarı: {sum(v - 1 for v in dup.values() if v > 1)}"]
    for (plat, sid), r in sorted(store_run.items()):
        ids = Counter((x.get('id') or x.get('reviewId')) for x in (r['raw']['data'].get(sid) or {}).get('reviews') or [])
        d = sum(v - 1 for v in ids.values() if v > 1)
        if d: L.append(f"- {plat} {sid}: ham yorum id tekrarı {d}")
    L += ['', '## Tamamen boş kalan sütunlar (platform bazında, day satırları)', '', 'Bu sütunlar ilgili panelde gün bazında yok; ayrıntı field_map.md\'de.', '']
    for plat in sorted({r['platform'] for r in mrows}):
        rows = [r for r in mrows if r['platform'] == plat and r['granularity'] == 'day']
        empty = [c for c in METRIC_COLS if all(r.get(c) is None for r in rows)]
        L.append(f"- {plat}: {', '.join(empty) if empty else '—'}")
    L += ['', '## Çekilemeyen ekranlar / hatalar', '', 'Her mağazanın en son çekiminde kalan hatalar (sonraki bir çekimle giderilenler hariç).', '']
    any_err = False
    for (plat, sid), r in sorted(store_run.items()):
        errs = [e for e in r['errors'] if str(e.get('where', '')).startswith(sid)]
        if errs:
            any_err = True
            grp = Counter(re.sub(r'\d{4}-\d\d-\d\d|p\d+|off=\d+', '…', e.get('where', '')) + f" [{e.get('status')}] {str(e.get('message') or '')[:80]}" for e in errs)
            for k, v in grp.most_common(10): L.append(f'- {plat}: {k} ×{v}')
    last_by_plat = {}
    for r in RUNS:
        if r.get('platform'): last_by_plat[r['platform']] = r
    for plat, r in last_by_plat.items():
        for e in r['errors']:
            if not any(str(e.get('where', '')).startswith(s) for s in r['stores']) and e.get('where') != 'session':
                any_err = True; L.append(f"- {plat}: {e.get('where')} [{e.get('status')}] {str(e.get('message') or '')[:80]}")
    if not any_err: L.append('- hata yok')
    sess = sorted({r['platform'] for r in RUNS if r.get('platform') and r is last_by_plat.get(r['platform']) and any(e.get('where') == 'session' for e in r['errors'])})
    L += ['', '## Oturum', '', f"- Son çalıştırmada oturumu düşmüş platform: {', '.join(sess) if sess else 'yok'}"]
    expected = {('yemeksepeti', 6), ('trendyolgo', 6), ('migros', 6), ('getir', 3)}
    L += ['', '## Kapsam', '']
    for plat, n in sorted(expected):
        have = sorted({meta_of(r, sid) for (p, sid), r in store_run.items() if p == plat})
        L.append(f"- {plat}: {len(have)}/{n} mağaza — " + ', '.join(f'{b}/{br}' for b, br in have))
    notes = [n for r in RUNS if r.get('platform') for n in r.get('notes', [])]
    if notes: L += ['', '## Notlar', ''] + [f'- {n}' for n in notes[:30]]
    open(os.path.join(OUT, 'run_log.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()
