// G63-S1 — push derin bağlantısı: kcal://dm/<uuid> → { conversationId }. SAF (test edilir).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function dmLinkTarget(url: string | null | undefined): { conversationId: string } | null {
  if (!url) return null;
  const m = url.trim().match(/^kcal:\/\/+dm\/([^/?#]+)\/?$/i);
  if (!m || !UUID.test(m[1])) return null;
  return { conversationId: m[1].toLowerCase() };
}
