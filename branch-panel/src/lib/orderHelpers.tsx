// Şube paneli paylaşılan order yardımcıları:
// - Adres render (kart UI ve termal fiş)
// - Termal fiş print (Adisyo pattern: büyük punto, saf siyah, Trebuchet MS)
// - Item parsing, kod/zaman formatlama
//
// KitchenScreen ve ScheduledScreen aynı mantığı kullanır; bu dosya tek
// kaynak — değişiklikler her iki ekranda anında yansır.

import { MapPin, Phone } from 'lucide-react'
import type { Order, OrderItem } from '../types'
import { LOGO_B64 } from './kcalLogo'

// ── Item parsing & kimlik / zaman ─────────────────────────────────────────────
export function parseItems(raw: unknown): OrderItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as OrderItem[]
  try { return JSON.parse(raw as string) as OrderItem[] } catch { return [] }
}

export function itemLabel(item: OrderItem): string { return item.name || 'Ürün' }

// ── Selected options → tek-tek, alt alta satır listesi ────────────────────────
// Her opsiyon ayrı satır ("Slot: Değer"). Öncelik sırası:
//   1) selected_options snapshot (yeni standart alan)
//   2) legacy_selected_options.labels (bundle ürünler buraya yazıyor)
//   3) legacy_selected_options.bundleSelections (labels yoksa slot+name'den üret)
//   4) selectedOptions.labels / options[] (eski formatlar)
// Bundle siparişlerde 1) boş kalıyor; fallback geçmiş siparişleri de gösterir.
export function optionLines(item: OrderItem): string[] {
  const snap = Array.isArray(item.selected_options) ? item.selected_options : []
  if (snap.length > 0) {
    return snap
      .filter(Boolean)
      .map((o) => {
        const name = (o.template_name || '').trim()
        const val = (o.value_name || '').trim()
        return name ? `${name}: ${val}`.trim() : val
      })
      .filter(Boolean)
  }
  const legacy = item.legacy_selected_options
  if (legacy?.labels?.length) return legacy.labels.filter(Boolean)
  if (legacy?.bundleSelections?.length) {
    return legacy.bundleSelections
      .filter(Boolean)
      .map((b) => {
        const slot = (b.slot_name || '').trim()
        const name = (b.name || '').trim()
        return slot ? `${slot}: ${name}`.trim() : name
      })
      .filter(Boolean)
  }
  if (item.selectedOptions?.labels?.length) return item.selectedOptions.labels.filter(Boolean)
  if (Array.isArray(item.options) && item.options.length) return item.options.filter(Boolean)
  return []
}

// Sipariş kartı için seçilen opsiyonları render et — her opsiyon ayrı satır
export function ItemOptions({ item }: { item: OrderItem }) {
  const lines = optionLines(item)
  if (lines.length === 0) return null
  return (
    <div className="ml-8 mt-0.5 space-y-0.5">
      {lines.map((line, idx) => (
        <div key={idx} className="text-[11px] leading-snug text-slate-600">• {line}</div>
      ))}
    </div>
  )
}

// Termal fiş için seçilen opsiyon HTML satırları — her opsiyon ayrı satır (XSS-safe)
export function renderReceiptItemOptions(item: OrderItem): string {
  const lines = optionLines(item)
  if (lines.length === 0) return ''
  return lines
    .map(
      (line) =>
        `<tr class="opt-row"><td colspan="2" style="padding-left:5mm">• ${escapeHtml(line)}</td></tr>`,
    )
    .join('')
}

export function orderCode(order: Order): string {
  const explicit = String(order?.order_code || '').trim()
  if (explicit) return explicit
  const paytr = String(order?.paytr_oid || '').trim()
  if (paytr) return paytr
  const rawId = String(order?.id || '').trim()
  if (!rawId) return 'KCAL-XXXX'
  return `KCAL-${rawId.slice(0, 8).toUpperCase()}`
}

export function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) } catch { return '--:--' }
}

export function formatDate(iso: string): string {
  try { return new Date(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' }) } catch { return '' }
}

export function formatDateTime(iso: string): string {
  try { return new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

// ── Telefon / adres normalize ─────────────────────────────────────────────────
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return ''
  const clean = String(phone).replace(/\D/g, '')
  if (clean.length === 10) return `0${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,8)} ${clean.slice(8)}`
  if (clean.length === 11 && clean.startsWith('0')) return `${clean.slice(0,4)} ${clean.slice(4,7)} ${clean.slice(7,9)} ${clean.slice(9)}`
  if (clean.length === 12 && clean.startsWith('90')) return `0${clean.slice(2,5)} ${clean.slice(5,8)} ${clean.slice(8,10)} ${clean.slice(10)}`
  return String(phone)
}

export function getAddressFields(order: Order) {
  const rec = order.address_record ?? null
  return {
    rec,
    fallbackText: rec ? null : (order.address ?? null),
    contactName: rec?.contact_name ?? order.customer_name ?? null,
    contactPhone: rec?.contact_phone ?? order.phone ?? null,
  }
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Supabase select() için addresses JOIN clause (KitchenScreen + ScheduledScreen) ──
export const ORDERS_WITH_ADDRESS_SELECT =
  '*, address_record:addresses(id, title, full_address, neighbourhood, district, city, street, building_no, floor, apartment_no, building_name, contact_name, contact_phone)'

// ── Sipariş kartı için adres bloğu (kurye odaklı) ─────────────────────────────
export function AddressBlock({ order }: { order: Order }) {
  const { rec, fallbackText, contactName, contactPhone } = getAddressFields(order)

  if (!rec && !fallbackText && !contactPhone) return null

  // address_record yok ama orders.address text var → uyarılı legacy bloğu
  if (!rec && fallbackText) {
    return (
      <div className="mx-4 mb-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
        <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">⚠ Eski adres formatı</p>
        {contactPhone && (
          <a href={`tel:${String(contactPhone).replace(/\s/g, '')}`} className="mt-1 inline-flex items-center gap-1 text-base font-bold text-blue-700">
            <Phone size={14} /> {formatPhone(contactPhone)}
          </a>
        )}
        <p className="mt-1 text-sm font-semibold text-slate-800 leading-snug">{fallbackText}</p>
        {contactName && <p className="mt-1 text-xs text-slate-500">👤 {contactName}</p>}
      </div>
    )
  }

  if (!rec) return null

  const buildingLine = [
    rec.building_no && `No: ${rec.building_no}`,
    rec.floor && `Kat: ${rec.floor}`,
    rec.apartment_no && `D: ${rec.apartment_no}`,
  ].filter(Boolean).join(' ')

  return (
    <div className="mx-4 mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      {contactPhone && (
        <a
          href={`tel:${String(contactPhone).replace(/\s/g, '')}`}
          className="mb-1.5 inline-flex items-center gap-1 text-base font-bold text-blue-700"
        >
          <Phone size={14} /> {formatPhone(contactPhone)}
        </a>
      )}

      <p className="text-sm font-bold text-slate-900 leading-snug">
        <MapPin size={12} className="mr-1 inline-block align-text-bottom" />
        {rec.neighbourhood ? `${rec.neighbourhood} Mh., ` : ''}
        {rec.street || rec.full_address || '—'}
      </p>

      {buildingLine && (
        <p className="mt-0.5 text-sm font-semibold text-slate-700">
          {buildingLine}
          {rec.building_name ? ` (${rec.building_name})` : ''}
        </p>
      )}

      {(rec.district || rec.city) && (
        <p className="mt-0.5 text-[11px] font-medium text-slate-500">
          {[rec.district, rec.city].filter(Boolean).join(' / ')}
        </p>
      )}

      {contactName && (
        <p className="mt-0.5 text-[11px] text-slate-500">👤 {contactName}</p>
      )}
    </div>
  )
}

// ── Termal fiş için adres bloğu HTML (XSS-safe) ───────────────────────────────
export function renderReceiptAddressBlock(order: Order): string {
  const { rec, fallbackText, contactName, contactPhone } = getAddressFields(order)
  if (!rec && !fallbackText && !contactPhone) return ''

  const phoneHtml = contactPhone
    ? `<div class="kurye-phone">☎ ${escapeHtml(formatPhone(contactPhone))}</div>`
    : ''

  if (!rec && fallbackText) {
    return `
      <div class="kurye-block">
        <div class="kurye-label">Teslimat</div>
        ${phoneHtml}
        <div class="kurye-addr-1">${escapeHtml(fallbackText)}</div>
        ${contactName ? `<div class="kurye-name">\u{1F464} ${escapeHtml(contactName)}</div>` : ''}
      </div>
    `
  }

  if (!rec) return phoneHtml ? `<div class="kurye-block">${phoneHtml}</div>` : ''

  const addr1Parts: string[] = []
  if (rec.neighbourhood) addr1Parts.push(`${rec.neighbourhood} Mh.`)
  if (rec.street) addr1Parts.push(rec.street)
  else if (rec.full_address) addr1Parts.push(rec.full_address)
  const addr1 = addr1Parts.join(', ')

  const addr2Parts: string[] = []
  if (rec.building_no) addr2Parts.push(`No: ${rec.building_no}`)
  if (rec.floor) addr2Parts.push(`Kat: ${rec.floor}`)
  if (rec.apartment_no) addr2Parts.push(`D: ${rec.apartment_no}`)
  if (rec.building_name) addr2Parts.push(`(${rec.building_name})`)
  const addr2 = addr2Parts.join(' ')

  const meta = [rec.district, rec.city].filter(Boolean).join(' / ')

  return `
    <div class="kurye-block">
      <div class="kurye-label">Teslimat</div>
      ${phoneHtml}
      ${addr1 ? `<div class="kurye-addr-1">${escapeHtml(addr1)}</div>` : ''}
      ${addr2 ? `<div class="kurye-addr-2">${escapeHtml(addr2)}</div>` : ''}
      ${meta ? `<div class="kurye-addr-meta">${escapeHtml(meta)}</div>` : ''}
      ${contactName ? `<div class="kurye-name">\u{1F464} ${escapeHtml(contactName)}</div>` : ''}
    </div>
  `
}

// ── Termal fiş CSS — kompakt (saf siyah, Trebuchet MS) ───────────────────────
// Sipariş kodu + ürün adı vurgulu kalır; adres/tel/müşteri/opsiyon standart
// küçük puntoya çekildi (fiş gereksiz uzamasın).
const RECEIPT_PRINT_CSS = `
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; color: #000 !important; }
  html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body {
    font-family: 'Trebuchet MS','Helvetica Bold',Arial,sans-serif;
    font-weight: 700;
    font-size: 11pt;
    line-height: 1.3;
    color: #000;
    margin: 0;
    padding: 3mm 1mm;
    width: 80mm;
    background: #fff;
  }
  .center  { text-align: center; }
  .right   { text-align: right; }
  .bold    { font-weight: 900; }
  .small   { font-size: 9pt; font-weight: 700; }
  .divider { border: none; border-top: 2px dashed #000; margin: 2mm 0; }
  .label   { font-size: 9pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1mm; }
  table    { width: 100%; border-collapse: collapse; }

  .logo-wrap     { text-align: center; margin-bottom: 2mm; }
  .logo-wrap img { max-height: 48px; max-width: 60mm; object-fit: contain; }

  .order-code-box {
    text-align: center;
    font-size: 20pt;
    font-weight: 900;
    margin: 2mm 0;
    padding: 1.5mm 0;
    border-top: 2px solid #000;
    border-bottom: 2px solid #000;
  }

  .customer-name { font-size: 12pt; font-weight: 700; margin-bottom: 1mm; }
  .item-row td   { padding: 1mm 0; font-size: 14pt; font-weight: 900; line-height: 1.2; }
  .opt-row td    { padding: 0 0 0.5mm; font-size: 11pt; font-weight: 600; line-height: 1.25; }
  .total-row td  { font-size: 16pt; font-weight: 900; padding: 1.5mm 0; border-top: 2px solid #000; }

  .macro-grid { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 2px; margin: 2mm 0; }
  .macro-box  { border: 2px solid #000; padding: 1.5mm 1mm; text-align: center; }
  .macro-val  { font-size: 12pt; font-weight: 900; }
  .macro-lbl  { font-size: 8pt; font-weight: 700; }

  .qr-wrap        { text-align: center; margin: 3mm 0 2mm; }
  .qr-wrap img    { width: 80px; height: 80px; }
  .receipt-footer { text-align: center; font-size: 11pt; font-weight: 900; margin-top: 2mm; }
  .privileged     { font-weight: 900; font-size: 11pt; text-align: center; margin: 2mm 0; border: 2px solid #000; padding: 1.5mm 4mm; }

  /* Randevulu sipariş bayrağı — mutfakta hızlı ayırt etmek için siyah üstü beyaz */
  .scheduled-banner {
    background: #000;
    padding: 2mm;
    margin: 2mm 0;
    text-align: center;
    font-size: 14pt;
    font-weight: 900;
    line-height: 1.2;
  }
  .scheduled-banner * { color: #fff !important; }

  /* Kurye/teslimat bloğu — standart küçük punto */
  .kurye-block     { border: 2px solid #000; padding: 2mm; margin: 2mm 0; }
  .kurye-label     { font-size: 8pt; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1mm; }
  .kurye-phone     { font-family: 'Trebuchet MS','Helvetica Bold',Arial,sans-serif; font-size: 13pt; font-weight: 900; margin-bottom: 1.5mm; line-height: 1.15; }
  .kurye-addr-1    { font-size: 11pt; font-weight: 700; line-height: 1.25; margin-bottom: 1mm; }
  .kurye-addr-2    { font-size: 10pt; font-weight: 600; line-height: 1.25; margin-bottom: 0.5mm; }
  .kurye-addr-meta { font-size: 9pt; font-weight: 600; margin-top: 1mm; }
  .kurye-name      { font-size: 9pt; font-weight: 600; margin-top: 1mm; }

  /* Müşteri notu */
  .receipt-note     { background: #000; padding: 2mm; margin: 2mm 0; }
  .receipt-note *   { color: #fff !important; }
  .note-label       { font-size: 10pt; font-weight: 900; margin-bottom: 1mm; }
  .note-text        { font-size: 12pt; font-weight: 900; }
`

// ── Termal fiş yazdırma ───────────────────────────────────────────────────────
export function printReceipt(order: Order) {
  const items   = parseItems(order.items)
  const total   = Number(order.total_price || 0).toFixed(2)
  const code    = orderCode(order)
  const dt      = order.delivery_type || order.delivery_time_type || 'immediate'
  const isSched = dt === 'scheduled' || Boolean(order.scheduled_date)

  const macros = items.reduce((acc, item) => {
    const qty = item.quantity ?? 1
    acc.cal  += ((item as any).calories ?? (item as any).cal ?? (item as any).kcal ?? 0) * qty
    acc.prot += ((item as any).protein ?? 0) * qty
    acc.carb += ((item as any).carbs ?? 0) * qty
    acc.fat  += ((item as any).fats ?? (item as any).fat ?? 0) * qty
    return acc
  }, { cal: 0, prot: 0, carb: 0, fat: 0 })

  const hasMacros = macros.cal > 0 || macros.prot > 0

  const itemLines = items.map(item => {
    const qty       = item.quantity ?? 1
    const unitPrice = item.unit_price ?? (item as any).price ?? 0
    const lineTotal = (unitPrice * qty).toFixed(2)
    const optionRows = renderReceiptItemOptions(item)
    return `<tr class="item-row"><td>${qty} x ${escapeHtml(itemLabel(item))}</td><td style="text-align:right;white-space:nowrap">₺${lineTotal}</td></tr>${optionRows}`
  }).join('')

  const scheduledBannerHtml = isSched && order.scheduled_date
    ? `<div class="scheduled-banner">📅 RANDEVU<br/>${escapeHtml(order.scheduled_date)} ${escapeHtml(String(order.scheduled_time || '').slice(0,5))}</div>`
    : ''

  const note = order.customer_note || (order as any).note
  const noteHtml = note
    ? `<div class="receipt-note"><div class="note-label">MÜŞTERİ NOTU</div><div class="note-text">${escapeHtml(note)}</div></div>`
    : ''

  const macroHtml = hasMacros
    ? `<hr class="divider" /><div class="label">Besin Değerleri (Toplam)</div><div class="macro-grid"><div class="macro-box"><div class="macro-val">${Math.round(macros.cal)}</div><div class="macro-lbl">kcal</div></div><div class="macro-box"><div class="macro-val">${Math.round(macros.prot)}g</div><div class="macro-lbl">Protein</div></div><div class="macro-box"><div class="macro-val">${Math.round(macros.carb)}g</div><div class="macro-lbl">Karb.</div></div><div class="macro-box"><div class="macro-val">${Math.round(macros.fat)}g</div><div class="macro-lbl">Yağ</div></div></div>`
    : ''

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>${RECEIPT_PRINT_CSS}</style>
</head><body>
  <div class="logo-wrap"><img src="${LOGO_B64}" alt="KCAL" /></div>
  <div class="center small">Sekülart Sağlıklı Gıda Ürünleri San. ve Tic. Ltd. Şti.</div>
  <div class="center small">Basın Sitesi Mah. 177/3 Sk. No:3A — 35150 Karabağlar / İzmir</div>
  <div class="center small">VKN: 7591148741</div>
  <div class="center small" style="margin-top:2mm">${escapeHtml(formatDate(order.created_at))} ${escapeHtml(formatTime(order.created_at))}</div>
  <div class="order-code-box">${escapeHtml(code)}</div>
  ${scheduledBannerHtml}
  <div class="label">Müşteri</div>
  <div class="customer-name">${escapeHtml(order.customer_name || '—')}</div>
  ${order.is_privileged ? `<div class="privileged">⭐ Ayrıcalıklı Üye</div>` : ''}
  ${renderReceiptAddressBlock(order)}
  ${noteHtml}
  <hr class="divider" />
  <div class="label">Ürünler</div>
  <table class="items-table">${itemLines}</table>
  <table><tr class="total-row"><td>TOPLAM</td><td class="right">₺${total}</td></tr></table>
  ${macroHtml}
  <hr class="divider" />
  <div class="qr-wrap">
    <div class="label" style="margin-bottom:2mm">Uygulamayı İndir</div>
    <img src="https://api.qrserver.com/v1/create-qr-code/?size=128x128&data=https://eatkcal.com" alt="QR" />
    <div class="small" style="margin-top:1mm">eatkcal.com</div>
  </div>
  <hr class="divider" />
  <div class="receipt-footer">Afiyet Olsun! 🥗</div>
  <div class="receipt-footer" style="font-size:14pt">Teşekkürler, tekrar bekleriz.</div>
</body></html>`

  const w = window.open('', '_blank', 'width=420,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => { w.print(); w.close() }, 400)
}
