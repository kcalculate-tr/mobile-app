// G55-S1 md.1 — bildirim dili (SAF; Deno + node:test okur, bağımlılık yok).
//
// Sunucu kullanıcının dilini `push_tokens.locale` ('tr' | 'en', varsayılan 'tr')
// üzerinden bilir: uygulama token kaydında arayüz dilini yazar; eski sürümler
// alanı yazmaz → 'tr'. Metin seçimi:
//   locale === 'en' VE İngilizce metin dolu → İngilizce
//   aksi hâlde → Türkçe (bugünkü davranış)
// Başlık ve gövde AYRI AYRI geri düşer (yalnız başlığı çevrilmiş şablonda gövde TR kalır).

export type PushLocale = 'tr' | 'en'

export const DEFAULT_PUSH_LOCALE: PushLocale = 'tr'

/** Herhangi bir değeri desteklenen bir dile indirger: 'en' (ve 'en-US' gibi) → 'en', diğer her şey → 'tr'. */
export function normalizePushLocale(v: unknown): PushLocale {
  if (typeof v !== 'string') return DEFAULT_PUSH_LOCALE
  return v.trim().toLowerCase().startsWith('en') ? 'en' : DEFAULT_PUSH_LOCALE
}

export type LocalizedText = { title: string; body: string }

/** TR metin + isteğe bağlı EN metin. */
export type BilingualText = LocalizedText & { en?: { title?: string | null; body?: string | null } | null }

function dolu(s: string | null | undefined): s is string {
  return typeof s === 'string' && s.trim().length > 0
}

/** Token'ın diline göre başlık/gövde seçer; EN alanı boşsa o alan TR'ye düşer. */
export function pickLocalized(text: BilingualText, locale: PushLocale): LocalizedText {
  if (locale !== 'en' || !text.en) return { title: text.title, body: text.body }
  return {
    title: dolu(text.en.title) ? text.en.title : text.title,
    body: dolu(text.en.body) ? text.en.body : text.body,
  }
}

/** `{{değişken}}` doldurma — iki dilde aynı; bilinmeyen değişken olduğu gibi kalır. */
export function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

type TemplateRow = {
  title_template: string
  body_template: string
  title_template_en?: string | null
  body_template_en?: string | null
}

/** `notification_templates` satırından iki dilli metin (değişkenler iki dilde de doldurulur). */
export function templateText(t: TemplateRow, vars: Record<string, string>): BilingualText {
  return {
    title: renderTemplate(t.title_template, vars),
    body: renderTemplate(t.body_template, vars),
    en: {
      title: dolu(t.title_template_en) ? renderTemplate(t.title_template_en, vars) : null,
      body: dolu(t.body_template_en) ? renderTemplate(t.body_template_en, vars) : null,
    },
  }
}

type CampaignRow = { title: string; body: string; title_en?: string | null; body_en?: string | null }

/** `notification_campaigns` satırından iki dilli metin. */
export function campaignText(c: CampaignRow): BilingualText {
  return { title: c.title, body: c.body, en: { title: c.title_en ?? null, body: c.body_en ?? null } }
}
