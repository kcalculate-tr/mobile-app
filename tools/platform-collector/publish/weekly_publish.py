#!/usr/bin/env python3
"""Weekly publish: raw collector files -> CSVs -> checks -> kcal-platform-data repo.

Steps (stops at the first failure; nothing is pushed on failure):
  1. today's raw files exist for every expected store and have no session error
  2. normalize.py rebuilds ~/kcal-reports/platform_data
  3. run_log.md 7-day order check is OK for every store pulled today
  4. personal-data scan (phone, e-mail, national id, masked customer names, PII columns)
  5. copy to <data repo>/latest and <data repo>/runs/YYYY-MM-DD, commit, push
  6. after a successful push: upload the 6 CSVs + run_log.md to the private Supabase
     Storage bucket platform-metrics (latest/ and runs/YYYY-MM-DD/) for the boss panel
     /boss/metrics page. Key: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in ~/.kcal-metrics.env
     (path overridable with KCAL_METRICS_ENV; never commit that file).
On failure: writes WEEKLY_FAILED_<date>.md next to the CSVs and shows a macOS notification.
No analysis is done here.

Usage: weekly_publish.py [--initial] [--date YYYY-MM-DD] [--dry-run] [--upload-only]
  --initial      publish the first full pull (do not require raw files from today)
  --upload-only  only the personal-data scan + Storage upload of the current CSVs (no normalize, no git)
"""
import argparse, csv, datetime as dt, glob, json, os, re, shutil, ssl, subprocess, sys, urllib.error, urllib.request

HOME = os.path.expanduser('~')
RAW_GLOBS = [f'{HOME}/Downloads/kcal-platform-raw/*/*.json', f'{HOME}/Downloads/kcalraw__*.json']
OUT = f'{HOME}/kcal-reports/platform_data'
DATA_REPO = os.environ.get('KCAL_DATA_REPO', f'{HOME}/kcal-platform-data')
DATA_REMOTE = os.environ.get('KCAL_DATA_REMOTE', 'https://github.com/kcalculate-tr/kcal-platform-data.git')
HERE = os.path.dirname(os.path.abspath(__file__))
NORMALIZE = os.environ.get('KCAL_NORMALIZE', os.path.join(HERE, '..', 'normalize', 'normalize.py'))
FILES = ['platform_metrics.csv', 'reviews.csv', 'cancellations.csv', 'products.csv', 'campaigns.csv', 'hourly.csv', 'field_map.md', 'run_log.md']
TZ = dt.timezone(dt.timedelta(hours=3))
METRICS_ENV = os.environ.get('KCAL_METRICS_ENV', f'{HOME}/.kcal-metrics.env')
BUCKET = 'platform-metrics'
STORAGE_FILES = ['platform_metrics.csv', 'reviews.csv', 'cancellations.csv', 'products.csv', 'campaigns.csv', 'hourly.csv', 'run_log.md']

# stores the weekly run must cover (Getir is frozen and not pulled weekly)
EXPECTED = {
    'yemeksepeti': {'YS_TR;nm1w', 'YS_TR;ny1f', 'YS_TR;mu8f', 'YS_TR;s6at', 'YS_TR;etqq', 'YS_TR;de09'},
    'trendyolgo': {'336068', '468410', '456386', '468415', '293817', '468407'},
    'migros': {'23000000175425', '23000000220838', '23000000157620', '23000000222370', '23000000222332', '23000000222220'},
}

PHONE = re.compile(r'(?<!\d)(?:\+?90[\s-]?)?0?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}(?!\d)')
EMAIL = re.compile(r'[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}')
TCKN = re.compile(r'(?<!\d)[1-9]\d{10}(?!\d)')
MASKED_NAME = re.compile(r'\b[A-ZÇĞİÖŞÜ][a-zçğıöşü]?\*{2,}\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]?\*{2,}')  # e.g. "E*** Ç****"
PII_COLUMN = re.compile(r'(customer|müşteri|musteri|phone|telefon|e-?mail|address|adres|username|user_name|full_?name|first_?name|last_?name)', re.I)
ID_COLUMNS = {'order_ref', 'review_id'}  # numeric ids that can look like phone / national id numbers
METRIC_OK = {'product_name', 'campaign_name', 'new_customer_orders', 'returning_customer_orders', 'new_customers'}  # counts, not people


def notify(msg):
    try:
        subprocess.run(['osascript', '-e', f'display notification "{msg}" with title "KCAL platform verisi"'], check=False, timeout=10)
    except Exception:
        pass


def fail(date, problems, pushed=False):
    path = os.path.join(OUT, f'WEEKLY_FAILED_{date}.md')
    os.makedirs(OUT, exist_ok=True)
    with open(path, 'w', encoding='utf-8') as fh:
        state = ('Veri reposuna push EDİLDİ, ama Supabase Storage yüklemesi (boss paneli Metrikler) başarısız.'
                 if pushed else 'Veri reposuna push EDİLMEDİ.')
        fh.write(f'# Haftalık yayın BAŞARISIZ — {date}\n\n{state}\n\n')
        for p in problems: fh.write(f'- {p}\n')
    print('FAIL:', *problems, sep='\n  ')
    notify(f'Push edilmedi: {problems[0][:120]}')
    sys.exit(1)


def raw_files():
    out = []
    for p in sorted({f for g in RAW_GLOBS for f in glob.glob(g)}):
        try: j = json.load(open(p, encoding='utf-8'))
        except Exception: continue
        out.append((p, j))
    return out


def check_raw(date):
    problems = []
    todays = [(p, j) for p, j in raw_files() if (j.get('pulledAt') or j.get('finishedAt') or '') and dt.datetime.fromisoformat((j.get('pulledAt') or j.get('finishedAt')).replace('Z', '+00:00')).astimezone(TZ).date().isoformat() == date]
    if not todays: return [f'{date} tarihli ham dosya yok (eklenti çalışmamış ya da Chrome kapalıydı).']
    got = {k: set() for k in EXPECTED}
    for p, j in todays:
        if j.get('schema') == 'kcal-runner-status/v1':
            for s in j.get('status', []):
                if not s.get('ok'): problems.append(f"{s.get('platform')}: {s.get('error') or 'oturum düşmüş'} ({os.path.basename(os.path.dirname(p))})")
            continue
        plat = j.get('platform')
        for e in j.get('errors', []):
            if e.get('where') == 'session': problems.append(f'{plat}: oturum düşmüş — {e.get("message")}')
        if plat in got: got[plat] |= set((j.get('data') or {}).keys())
    for plat, need in EXPECTED.items():
        miss = sorted(need - got[plat])
        if miss: problems.append(f'{plat}: bu hafta veri gelmeyen mağaza(lar): {", ".join(miss)}')
    return problems


def check_runlog():
    text = open(os.path.join(OUT, 'run_log.md'), encoding='utf-8').read()
    sec = text.split('## Son 7 gün sipariş kontrolü', 1)[-1].split('\n## ', 1)[0]
    bad = [l for l in sec.splitlines() if l.startswith('| ') and not l.startswith('| Platform') and not l.rstrip().endswith('| OK |')]
    return [f'7 gün kontrolü başarısız: {l.strip()}' for l in bad]


def check_pii():
    problems = []
    for f in FILES:
        path = os.path.join(OUT, f)
        if not os.path.exists(path): problems.append(f'{f} yok'); continue
        if f.endswith('.csv'):
            with open(path, encoding='utf-8') as fh:
                rd = csv.reader(fh); header = next(rd, [])
                for c in header:
                    if PII_COLUMN.search(c) and c not in METRIC_OK: problems.append(f'{f}: kişisel veri sütunu "{c}"')
                for n, row in enumerate(rd, start=2):
                    for c, v in zip(header, row):
                        if not v: continue
                        if c in ID_COLUMNS and re.fullmatch(r'[\w.-]+', v): continue
                        for name, rx in (('telefon', PHONE), ('e-posta', EMAIL), ('müşteri adı (maskeli)', MASKED_NAME)):
                            if rx.search(v): problems.append(f'{f} satır {n} sütun {c}: {name} deseni')
                        if c not in ID_COLUMNS and TCKN.search(v) and not re.fullmatch(r'[\d.]+', v): problems.append(f'{f} satır {n} sütun {c}: 11 haneli kimlik no deseni')
        else:
            t = open(path, encoding='utf-8').read()
            for name, rx in (('telefon', PHONE), ('e-posta', EMAIL), ('müşteri adı (maskeli)', MASKED_NAME)):
                if rx.search(t): problems.append(f'{f}: {name} deseni')
    return problems[:50]


def git(*args, cwd=DATA_REPO):
    return subprocess.run(['git', *args], cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def publish(date, dry):
    if not os.path.isdir(os.path.join(DATA_REPO, '.git')):
        subprocess.run(['git', 'clone', DATA_REMOTE, DATA_REPO], check=True)
    for target in ('latest', f'runs/{date}'):
        d = os.path.join(DATA_REPO, target); os.makedirs(d, exist_ok=True)
        for f in FILES: shutil.copy2(os.path.join(OUT, f), os.path.join(d, f))
    readme = os.path.join(DATA_REPO, 'README.md')
    if not os.path.exists(readme):
        open(readme, 'w', encoding='utf-8').write('# kcal-platform-data\n\nYemeksepeti, Trendyol GO, Migros Yemek ve Getir panel verisi (haftalık).\n\n- `latest/` — en güncel dosyalar (her hafta üzerine yazılır)\n- `runs/YYYY-MM-DD/` — o haftanın arşiv kopyası\n\nSütun tanımları: `latest/field_map.md`. Kontroller: `latest/run_log.md`.\nKişisel veri (ad, telefon, adres, e-posta) içermez.\n')
    git('add', '-A')
    if git('status', '--porcelain'): git('commit', '-m', f'data: {date} platform verisi')
    else: print('Değişiklik yok, yeni commit yok.')
    sha = git('rev-parse', 'HEAD')
    if not dry:
        # always push: also sends commits left behind by an earlier failed push
        r = subprocess.run(['git', 'push', '-u', 'origin', 'HEAD:main'], cwd=DATA_REPO, capture_output=True, text=True)
        if r.returncode != 0: fail(date, [f'git push başarısız (commit yerelde duruyor, sonraki çalışmada tekrar denenir): {(r.stderr or r.stdout).strip()[-300:]}'])
    return sha


def load_metrics_env():
    """SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from the environment or ~/.kcal-metrics.env."""
    if os.path.exists(METRICS_ENV):
        for line in open(METRICS_ENV, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"\''))
    return os.environ.get('SUPABASE_URL', '').rstrip('/'), os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')


def ssl_context():
    # python.org builds ship without CA roots; use the macOS system bundle when present
    for ca in (os.environ.get('SSL_CERT_FILE'), '/etc/ssl/cert.pem', '/opt/homebrew/etc/ca-certificates/cert.pem'):
        if ca and os.path.exists(ca): return ssl.create_default_context(cafile=ca)
    return ssl.create_default_context()


def upload_storage(date):
    """Upload STORAGE_FILES to platform-metrics/latest/ and platform-metrics/runs/<date>/ (upsert)."""
    url, key = load_metrics_env()
    ctx = ssl_context()
    if not url or not key:
        return [f'Storage yüklemesi yapılamadı: {METRICS_ENV} içinde SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY yok.']
    problems = []
    for prefix in ('latest', f'runs/{date}'):
        for f in STORAGE_FILES:
            body = open(os.path.join(OUT, f), 'rb').read()
            ctype = 'text/csv' if f.endswith('.csv') else 'text/markdown'
            req = urllib.request.Request(
                f'{url}/storage/v1/object/{BUCKET}/{prefix}/{f}', data=body, method='POST',
                headers={'Authorization': f'Bearer {key}', 'apikey': key, 'Content-Type': ctype,
                         'x-upsert': 'true', 'cache-control': 'max-age=60'})
            try:
                urllib.request.urlopen(req, timeout=60, context=ctx).read()
            except urllib.error.HTTPError as e:
                problems.append(f'Storage {prefix}/{f}: HTTP {e.code} {e.read()[:200].decode("utf-8", "replace")}')
            except Exception as e:
                problems.append(f'Storage {prefix}/{f}: {e}')
    if not problems: print(f'Storage OK: {BUCKET}/latest + {BUCKET}/runs/{date} ({len(STORAGE_FILES)} dosya)')
    return problems


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--initial', action='store_true'); ap.add_argument('--date'); ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--upload-only', action='store_true')
    a = ap.parse_args()
    date = a.date or dt.datetime.now(TZ).date().isoformat()
    if a.upload_only:
        problems = check_pii()
        if problems: fail(date, problems)
        problems = upload_storage(date)
        if problems: fail(date, problems, pushed=True)
        old = os.path.join(OUT, f'WEEKLY_FAILED_{date}.md')
        if os.path.exists(old): os.remove(old)
        return
    if not a.initial:
        problems = check_raw(date)
        if problems: fail(date, problems)
    r = subprocess.run([sys.executable, NORMALIZE], capture_output=True, text=True)
    if r.returncode != 0: fail(date, [f'normalize.py hata verdi: {(r.stderr or r.stdout)[-300:]}'])
    print(r.stdout.strip())
    problems = check_runlog() + check_pii()
    if problems: fail(date, problems)
    sha = publish(date, a.dry_run)
    remote = DATA_REMOTE.removesuffix('.git')
    print('OK', f'{remote}/commit/{sha}' if sha else '(değişiklik yok)')
    if not a.dry_run:
        problems = upload_storage(date)
        if problems: fail(date, problems, pushed=True)
    old = os.path.join(OUT, f'WEEKLY_FAILED_{date}.md')
    if os.path.exists(old): os.remove(old)


if __name__ == '__main__':
    main()
