/**
 * G12-S4 — İlerleme raporu indir (FinPrProgress, madde 3).
 *
 * `src/screens/TrackerScreen.tsx`'teki `handleExportPDF` (satır ~1500) AYNI
 * paketleri (expo-print + expo-sharing) kullanır ama o fonksiyon dışa
 * verilmiyor (yerel closure) ve o dosya S3'e ait — buradan import edilemez.
 * Bu yüzden eşdeğer, daha sade bir rapor burada BAĞIMSIZ üretilir. KİLO/BMI
 * YOK (madde 3: "KİLO YOK; bel/kalça/göğüs"). ENTEGRASYONA: S6'da TrackerScreen
 * ile tek bir paylaşılan rapor üretici altında birleştirilmeli.
 */
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { brandLogoSvgMarkup } from '../../core/design/components/brandLogoMarkup';

export interface NutritionReportDay {
  date: string; // YYYY-MM-DD
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionReportMeasurement {
  date: string;
  waist_cm: number | null;
  hip_cm: number | null;
  chest_cm: number | null;
}

export interface NutritionReportParams {
  userName: string;
  userEmail: string;
  rangeLabel: string;
  days: NutritionReportDay[];
  measurements: NutritionReportMeasurement[];
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function buildHtml(params: NutritionReportParams): string {
  const { userName, userEmail, rangeLabel, days, measurements } = params;
  const activeDays = days.filter((d) => d.kcal > 0);
  const avgKcal = activeDays.length > 0
    ? Math.round(activeDays.reduce((s, d) => s + d.kcal, 0) / activeDays.length)
    : 0;

  const dayRows = days
    .map(
      (d) => `<tr>
        <td>${escapeHtml(d.date)}</td>
        <td>${d.kcal > 0 ? Math.round(d.kcal) : '—'}</td>
        <td>${d.kcal > 0 ? Math.round(d.protein) + ' g' : '—'}</td>
        <td>${d.kcal > 0 ? Math.round(d.carbs) + ' g' : '—'}</td>
        <td>${d.kcal > 0 ? Math.round(d.fat) + ' g' : '—'}</td>
      </tr>`,
    )
    .join('');

  const measurementRows = measurements
    .map(
      (m) => `<tr>
        <td>${escapeHtml(m.date)}</td>
        <td>${m.waist_cm != null ? m.waist_cm + ' cm' : '—'}</td>
        <td>${m.hip_cm != null ? m.hip_cm + ' cm' : '—'}</td>
        <td>${m.chest_cm != null ? m.chest_cm + ' cm' : '—'}</td>
      </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 50px 30px; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; font-size: 13px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #C6F04F; padding-bottom: 16px; margin-bottom: 20px; }
    .logo-img { height: 20px; width: auto; flex-shrink: 0; }
    .title { font-size: 20px; font-weight: 800; }
    .sub { color: #6B6B70; font-size: 12px; margin-top: 4px; }
    .meta { display: flex; gap: 24px; margin-bottom: 20px; }
    .meta-label { font-size: 11px; color: #6B6B70; text-transform: uppercase; }
    .meta-value { font-size: 14px; font-weight: 700; }
    .section-title { font-size: 15px; font-weight: 700; margin: 20px 0 8px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #E9EBEE; font-size: 12px; }
    th { color: #6B6B70; font-weight: 700; }
    .stat-row { display: flex; gap: 24px; margin-bottom: 8px; }
    .footer { margin-top: 30px; color: #6B6B70; font-size: 10px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div style="display:flex; align-items:center; gap:12px;">
      ${brandLogoSvgMarkup('kcalculate', { height: 20, className: 'logo-img' })}
      <div>
        <div class="title">Beslenme Raporu</div>
        <div class="sub">${escapeHtml(rangeLabel)}</div>
      </div>
    </div>
  </div>

  <div class="meta">
    <div><div class="meta-label">Ad</div><div class="meta-value">${escapeHtml(userName)}</div></div>
    <div><div class="meta-label">E-posta</div><div class="meta-value">${escapeHtml(userEmail)}</div></div>
    <div><div class="meta-label">Günlük ortalama</div><div class="meta-value">${avgKcal} kcal</div></div>
  </div>

  <div class="section-title">Kalori günlüğü</div>
  <table>
    <thead><tr><th>Tarih</th><th>Kalori</th><th>Protein</th><th>Karb</th><th>Yağ</th></tr></thead>
    <tbody>${dayRows}</tbody>
  </table>

  ${measurements.length > 0 ? `
  <div class="section-title">Ölçümler</div>
  <table>
    <thead><tr><th>Tarih</th><th>Bel</th><th>Kalça</th><th>Göğüs</th></tr></thead>
    <tbody>${measurementRows}</tbody>
  </table>
  ` : ''}

  <div class="footer">kcalculate — yalnız sen görürsün</div>
</body>
</html>`;
}

export async function exportNutritionReport(params: NutritionReportParams): Promise<void> {
  const html = buildHtml(params);
  const { uri } = await Print.printToFileAsync({ html, base64: false });
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Raporu Paylaş' });
}
