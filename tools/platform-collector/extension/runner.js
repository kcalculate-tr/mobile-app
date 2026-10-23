// Orchestrates one collection run in this Chrome profile.
const mode = new URLSearchParams(location.search).get('mode') === 'full' ? 'full' : 'weekly';
const runId = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1_$2');
const logEl = document.getElementById('log');
const log = (m) => { logEl.textContent += `[${new Date().toLocaleTimeString('tr-TR')}] ${m}\n`; };

const PANELS = [
  { platform: 'yemeksepeti', host: 'partner-app.yemeksepeti.com', start: 'https://partner-app.yemeksepeti.com/reviews' },
  { platform: 'trendyolgo', host: 'partner.tgoyemek.com', start: 'https://partner.tgoyemek.com/meal-store/restaurant-selection' },
  { platform: 'migros', host: 'restoran.migrosonline.com', start: 'https://restoran.migrosonline.com/home' },
  { platform: 'getir', host: 'restoran.getiryemek.com', start: 'https://restoran.getiryemek.com/' },
];
const TGO_STORES = { '1078227': ['336068', '468410'], '6725507': ['456386', '468415'], '989799': ['293817', '468407'] };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const inPage = async (tabId, func, args = []) => (await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func, args }))[0].result;
async function load(tabId, url, extraWait = 5000) {
  await chrome.tabs.update(tabId, { url });
  for (let i = 0; i < 60; i++) { const t = await chrome.tabs.get(tabId); if (t.status === 'complete') break; await sleep(500); }
  await sleep(extraWait);
}

async function save(obj, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
  await chrome.downloads.download({ url, filename: `kcal-platform-raw/${runId}/${name}.json`, conflictAction: 'overwrite', saveAs: false });
}

const created = []; // tabs this run opened (closed at the end)
const status = [];  // per-platform outcome, saved as runner_status.json
async function record(platform, result) {
  const session = (result.errors || []).some((e) => e.where === 'session');
  status.push({ platform, ok: !session, session, stores: Object.keys(result.data || {}), errors: (result.errors || []).length });
  if (!session && Object.keys(result.data || {}).length) { const { okPlatforms = {} } = await chrome.storage.local.get('okPlatforms'); okPlatforms[platform] = true; await chrome.storage.local.set({ okPlatforms }); }
}

(async () => {
  log(`Mod: ${mode === 'full' ? 'ilk tam çekim' : 'haftalık (son 14 gün)'} — çalıştırma ${runId}`);
  const { getirDone } = await chrome.storage.local.get('getirDone');
  for (const p of PANELS) {
    if (p.platform === 'getir' && (mode !== 'full' || getirDone)) { log('Getir: dondurulmuş, atlandı.'); continue; }
    let tabs = await chrome.tabs.query({ url: `https://${p.host}/*` });
    if (!tabs.length) {
      // open the panel ourselves (needed for the unattended Friday run)
      const t = await chrome.tabs.create({ url: p.start, active: false }); created.push(t.id);
      for (let i = 0; i < 60; i++) { const x = await chrome.tabs.get(t.id); if (x.status === 'complete') break; await sleep(500); }
      await sleep(4000);
      tabs = [await chrome.tabs.get(t.id)];
    }
    const tabId = tabs[0].id;
    const { okPlatforms = {} } = await chrome.storage.local.get('okPlatforms');
    if (/login|giris|signin|auth/i.test((await chrome.tabs.get(tabId)).url || '')) {
      // never worked in this profile → not this profile's panel; otherwise the session dropped
      if (okPlatforms[p.platform]) { status.push({ platform: p.platform, ok: false, session: false, error: 'Oturum düşmüş: giriş sayfasına yönlendi' }); log(`${p.platform}: OTURUM DÜŞMÜŞ (giriş sayfası).`); }
      else log(`${p.platform}: bu profilde oturum yok, atlandı.`);
      continue;
    }
    try {
      log(`${p.platform}: sayfa yenileniyor (oturum başlıkları yakalanıyor)…`);
      let marketReport = null;
      if (p.platform === 'trendyolgo') {
        // The panel reports on the *selected* store: select each store ("Seç"), then read its
        // "Pazar Raporu" (performance page text) and its ad list (ads are tied to the selected store).
        await load(tabId, p.start, 4000);
        const sup = await inPage(tabId, () => { const m = document.body.innerText.match(/CARİ[^\d]*(\d{5,})/i); return m ? m[1] : null; });
        marketReport = [];
        for (const id of TGO_STORES[sup] || []) {
          await load(tabId, `https://${p.host}/meal-store/restaurant-selection`, 4000);
          await inPage(tabId, (sid) => { const row = [...document.querySelectorAll('*')].find((e) => e.children.length < 40 && /ID:\s*/.test(e.innerText || '') && (e.innerText || '').includes(sid) && [...e.querySelectorAll('button,div,span')].some((b) => (b.innerText || '').trim() === 'Seç')); const btn = row && [...row.querySelectorAll('button,div,span')].reverse().find((b) => (b.innerText || '').trim() === 'Seç'); if (btn) btn.click(); return !!btn; }, [id]);
          await sleep(4000);
          await load(tabId, `https://${p.host}/meal/${id}/dashboard/performance`, 7000);
          await inPage(tabId, () => window.scrollTo(0, document.body.scrollHeight)); await sleep(3000);
          const mr = await inPage(tabId, () => window.__kcal && window.__kcal.readTgoMarketReport && window.__kcal.readTgoMarketReport());
          marketReport.push(mr && mr.store_id === id ? mr : { store_id: id, missing: true });
          // ads of this store: open the ad list so the panel itself calls the ads service first
          await load(tabId, `https://${p.host}/advert-management/`, 5000);
          await inPage(tabId, () => { const el = [...document.querySelectorAll('div,span,button')].find((e) => (e.innerText || '').trim() === 'Reklam Listesi'); if (el) el.click(); });
          await sleep(4000);
          const ads = await inPage(tabId, (md) => window.__kcal.collectors.trendyolgo({ mode: md, adsOnly: true }), [mode]);
          if (ads && ads.adverts && ads.adverts.length) await save(ads, `trendyolgo__ads_${id}`);
        }
        // order-history page first, so the order service's own headers are captured before collecting
        await load(tabId, `https://${p.host}/meal/${(TGO_STORES[sup] || [''])[0]}/order/history/packages`, 6000);
        log(`${p.platform}: veri çekiliyor (birkaç dakika sürebilir)…`);
        const result = await inPage(tabId, (md, mr) => window.__kcal.collectors.trendyolgo({ mode: md, marketReport: mr, skipAdverts: true }), [mode, marketReport]);
        await save(result, `trendyolgo__${Object.keys(result.data || {}).join('-') || 'bos'}`);
        record(p.platform, result);
        log(`${p.platform}: tamam — ${Object.keys(result.data || {}).length} mağaza, ${result.errors.length} hata.`);
        for (const e of result.errors.slice(0, 5)) log(`   hata: ${e.where} ${e.status || ''} ${e.message || ''}`);
        continue;
      }
      await load(tabId, p.start, 6000);
      log(`${p.platform}: veri çekiliyor (birkaç dakika sürebilir)…`);
      const result = await inPage(tabId, (pl, md, mr) => window.__kcal.collectors[pl]({ mode: md, marketReport: mr }), [p.platform, mode, marketReport]);
      const name = `${p.platform}__${Object.keys(result.data || {}).join('-') || 'bos'}`;
      await save(result, name);
      record(p.platform, result);
      log(`${p.platform}: tamam — ${Object.keys(result.data || {}).length} mağaza, ${result.errors.length} hata. Kaydedildi: ${name}.json`);
      for (const e of result.errors.slice(0, 5)) log(`   hata: ${e.where} ${e.status || ''} ${e.message || ''}`);
      if (p.platform === 'getir' && !result.errors.some((e) => e.where === 'session')) await chrome.storage.local.set({ getirDone: true });
    } catch (e) { log(`${p.platform}: HATA ${e.message}`); status.push({ platform: p.platform, ok: false, error: String(e.message) }); }
  }
  for (const id of created) { try { await chrome.tabs.remove(id); } catch (e) { /* already closed */ } }
  if (mode === 'weekly') await chrome.storage.local.set({ lastWeeklyRun: Date.now() });
  await save({ schema: 'kcal-runner-status/v1', runId, mode, finishedAt: new Date().toISOString(), status }, 'runner_status');
  log('Bitti. Şimdi dönüştürücüyü çalıştırın: python3 tools/platform-collector/normalize/normalize.py');
})();
