#!/bin/sh
# Store shots: scratch copy of the design boards (the design source is never written).
# Usage: sh prep.sh <emptyScratchDir>
#   then serve it: (cd <emptyScratchDir> && python3 -m http.server 8765 --bind 127.0.0.1)
set -e
OUT="$1"; [ -n "$OUT" ] || { echo "usage: prep.sh <emptyScratchDir>"; exit 1; }
D="$HOME/dev/kcal-mobile/.claude/night/design"
mkdir -p "$OUT"
cp "$D"/final/*.html "$D"/final/support.js "$OUT"/
cp -R "$D"/final/glass "$D"/final/t19 "$OUT"/
# Tur 26k boards (coach + coach-aware paywall) win over final/ copies of the same name.
cp "$D"/tur26k/dalga2/*.dc.html "$OUT"/
cp -n "$D"/tur26k/dalga2/glass/* "$OUT"/glass/ 2>/dev/null || true
cp -n "$D"/tur26k/dalga2/t19/* "$OUT"/t19/ 2>/dev/null || true
# Scan board pinned to voice mode (frame 02).
sed "s/props.mode === 'voice' ? 'voice' : 'photo'/'voice'/" "$OUT"/ScanR2.dc.html > "$OUT"/ScanR2Voice.dc.html
# Paywall: 1.1.0 store prices (M-S2, 11 Nov): 199,99 / 999,99 / 499,99 / 2999,99 TL; $5.99 / $29.99 / $12.99 / $59.99.
# Weekly = monthly x 12 / 52 or yearly / 52; discount = yearly vs 12 x monthly (Fresh 58%; Balance 50% TL, 62% USD).
P="$OUT"/FinSubPaywall.dc.html
sed -i '' \
  -e "s/\[4.99, 29.99, 12.99, 59.99\]/[5.99, 29.99, 12.99, 59.99]/" \
  -e "s/\[149, 999, 499, 2999\]/[199.99, 999.99, 499.99, 2999.99]/" \
  -e "s/return String(Math.round(v)) + ' TL';/return v.toFixed(2).replace('.', ',') + ' TL';/" \
  -e "s/price: '\$4.99', per: S.perM, eq: '\$1.15 per week'/price: '\$5.99', per: S.perM, eq: '\$1.38 per week'/" \
  -e "s/price: '\$29.99', per: S.perY, eq: '\$0.58 per week', off: '-50%'/price: '\$29.99', per: S.perY, eq: '\$0.58 per week', off: '-58%'/" \
  -e "s/price: '149 TL', per: S.perM, eq: 'Haftalık 34,38 TL'/price: '199,99 TL', per: S.perM, eq: 'Haftalık 46,15 TL'/" \
  -e "s/price: '999 TL', per: S.perY, eq: 'Haftalık 19,21 TL', off: '-%44'/price: '999,99 TL', per: S.perY, eq: 'Haftalık 19,23 TL', off: '-%58'/" \
  -e "s/price: '499 TL', per: S.perM, eq: 'Haftalık 115,15 TL'/price: '499,99 TL', per: S.perM, eq: 'Haftalık 115,38 TL'/" \
  -e "s/price: '2999 TL', per: S.perY, eq: 'Haftalık 57,67 TL'/price: '2999,99 TL', per: S.perY, eq: 'Haftalık 57,69 TL'/" \
  "$P"
sed -i '' -e "s/sonra 2999 TL\/yıl/sonra 2999,99 TL\/yıl/" "$OUT"/FinCoachChat.dc.html
# Fail loudly if an old price survived.
if grep -n "149 TL\|'999 TL'\|'499 TL'\|'2999 TL'\|34,38\|57,67\|4\.99" "$P"; then echo "prep.sh: old price left in $P"; exit 1; fi
echo "prep.sh: boards ready in $OUT"
