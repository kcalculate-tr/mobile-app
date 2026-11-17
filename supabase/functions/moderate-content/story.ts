// G59-S1 — hikâye denetimi için SAF yardımcılar (Deno + Node testleri ortak; bağımlılık yok).
// Hikâye "katmanlı"dır: denetlenecek metin `overlays` içindeki yazı / konum / bahset / etiket /
// anket katmanlarından toplanır (istemci tek kaynağı: src/modules/hikaye/overlays.ts).

export interface StoryRowLite {
  media_url: string | null
  media_type: string | null
  thumb_url: string | null
  overlays: unknown
}

const TEXT_KINDS = new Set(['text', 'location', 'mention', 'hashtag'])

/** Katmanlardaki tüm kullanıcı metni (satır satır). Metin yoksa ''. */
export function storyModerationText(overlays: unknown): string {
  if (!Array.isArray(overlays)) return ''
  const out: string[] = []
  for (const o of overlays) {
    if (!o || typeof o !== 'object') continue
    const kind = String((o as { kind?: unknown }).kind ?? '')
    const data = ((o as { data?: unknown }).data ?? {}) as Record<string, unknown>
    if (TEXT_KINDS.has(kind) && typeof data.text === 'string' && data.text.trim()) {
      out.push(data.text.trim())
    } else if (kind === 'poll') {
      if (typeof data.question === 'string' && data.question.trim()) out.push(data.question.trim())
      if (Array.isArray(data.options)) {
        for (const opt of data.options) if (typeof opt === 'string' && opt.trim()) out.push(opt.trim())
      }
    }
  }
  return out.join('\n')
}

/**
 * Denetime gönderilecek görsel yolları: fotoğraf hikâyede taban görsel, videoda kapak (ilk kare).
 * Yalnız `stories/` altındaki depo yolları (tam URL ya da başka klasör → atlanır).
 */
export function storyImagePaths(row: StoryRowLite): string[] {
  const p = row.media_type === 'video' ? row.thumb_url : row.media_type === 'image' ? row.media_url : null
  if (!p || typeof p !== 'string') return []
  if (!p.startsWith('stories/') || p.includes('..')) return []
  return [p]
}
