#!/usr/bin/env bash
# G42-S1 md.2 — Onboarding sahne arka planlarını uygulama boyutuna indirir.
#
# Kaynak: docs/tur27/onboarding/sahneler/*.png (3840 px yükseklik, 4–7 MB; repoda DEĞİL,
#         ana klasörde — yol 1. argümanla verilebilir).
# Çıktı : assets/onboarding/sahne-*.webp (kalite ~80, her biri ≤ 400 KB).
#
#  · 1, 4, 5 (1772×3840 ≈ 1290×2796 oranı) → doğrudan 1290×2796'ya ölçeklenir.
#  · 2, 3 (2307×3840, daha geniş) → GENİŞLİĞE oturtulur: 1290×2147. KARAR (LOG): OBS bileşeni
#    bu iki sahneyi `width: 393; height: 393·3840/2307; bottom: 0` ile çiziyor (üstte FILL
#    degradesine 40 pt geçiş maskesi). Ortadan kırpıp 2796 yüksekliğe büyütmek çipleri/küreleri
#    ~100 pt yukarı kaydırıyor ve OB-TR-02/03 referansından sapıyor; genişliğe oturtmak hiçbir
#    şeyi kesmiyor ve referansla örtüşüyor.
#
# Yeni paket yok: macOS `sips` (ölçek) + Homebrew `cwebp` (kodlama).
set -euo pipefail

SRC="${1:-$HOME/dev/kcal-mobile/docs/tur27/onboarding/sahneler}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/assets/onboarding"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

command -v sips >/dev/null || { echo "sips yok (macOS gerekir)"; exit 1; }
command -v cwebp >/dev/null || { echo "cwebp yok: brew install webp"; exit 1; }

encode() { # $1 kaynak png, $2 hedef ad, $3 genişlik, $4 yükseklik
  local tmp="$TMP/$2.png"
  sips -z "$4" "$3" "$1" --out "$tmp" >/dev/null
  local q=80
  while :; do
    cwebp -quiet -q "$q" -m 6 -metadata none "$tmp" -o "$OUT/$2.webp"
    local size
    size=$(stat -f%z "$OUT/$2.webp")
    if [ "$size" -le 409600 ] || [ "$q" -le 50 ]; then
      printf '%-16s %4dx%-4d q=%d %6d KB\n' "$2" "$3" "$4" "$q" $((size / 1024))
      break
    fi
    q=$((q - 5))
  done
}

encode "$SRC/sahne-1.png" sahne-1 1290 2796
encode "$SRC/sahne-2.png" sahne-2 1290 2147
encode "$SRC/sahne-3-tr.png" sahne-3-tr 1290 2147
encode "$SRC/sahne-3-en.png" sahne-3-en 1290 2147
encode "$SRC/sahne-4-tr.png" sahne-4-tr 1290 2796
encode "$SRC/sahne-4-en.png" sahne-4-en 1290 2796
encode "$SRC/sahne-5.png" sahne-5 1290 2796
