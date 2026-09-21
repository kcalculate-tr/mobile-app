#!/usr/bin/env node

// Amac: macOS'un kazara urettigi kopya dosyalarin ("dosya 2.png", "dosya copy.md",
// "dosya (1).sql") repo'ya girmesini engellemek.
//
// 21.09.2026 — Tarama artik SADECE git'in takip ettigi dosyalar uzerinde yapiliyor.
// Onceki surum tum agaci geziyordu ve ios/Pods icindeki vendor boost basliklarini
// (noncopyable.hpp, copy_move_algo.hpp ...) duplicate saniyordu; 46 bulgunun 41'i
// bu yuzden yanlis alarmdi ve typecheck zincirini bastan kesiyordu.
// git ls-files kullanimi .gitignore'u bedavaya kazandirir: vendor/build ciktilari
// zaten takip edilmiyor.

const { execFileSync } = require('child_process');
const path = require('path');

const DUPLICATE_PATTERNS = [
  // "logo 2.png", "rapor 3.pdf" — Finder'in "Duplicate" ciktisi
  { regex: / \d+(?:\.[^./\\]+)?$/i, label: '" 2" suffix' },
  // "logo copy.png", "logo copy 2.png", "logo-copy.png" — sadece kopya eki olarak
  { regex: /(?:^|[ _-])copy(?: \d+)?(?:\.[^./\\]+)?$/i, label: '"copy" kopya eki' },
  // "logo (1).png" — tarayici indirmesi
  { regex: /\(\d+\)(?:\.[^./\\]+)?$/i, label: '"(1)/(2)" kopya formatı' },
];

function trackedFiles() {
  const out = execFileSync(
    'git',
    ['ls-files', '--recurse-submodules', '-z'],
    { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024 },
  );
  return out.toString('utf8').split('\0').filter(Boolean);
}

let files;
try {
  files = trackedFiles();
} catch (error) {
  console.error('[hygiene] git ls-files calistirilamadi (repo disinda mi?).');
  console.error(`[hygiene] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const findings = [];
for (const relativePath of files) {
  const name = path.basename(relativePath);
  const matched = DUPLICATE_PATTERNS.find((pattern) => pattern.regex.test(name));
  if (matched) {
    findings.push({ relativePath, reason: matched.label });
  }
}

if (findings.length > 0) {
  console.error(`[hygiene] ${findings.length} şüpheli duplicate bulundu:`);
  findings
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .forEach((finding) => {
      console.error(`- ${finding.relativePath} (${finding.reason})`);
    });
  console.error('');
  console.error('[hygiene] Gercekten kopya ise sil; degilse dosyayi yeniden adlandir.');
  process.exit(1);
}

console.log(`[hygiene] OK — ${files.length} takipli dosyada duplicate deseni yok.`);
