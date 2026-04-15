#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();
const IGNORED_DIRS = new Set(['.git', 'node_modules', '.expo']);

const DUPLICATE_PATTERNS = [
  { key: 'suffix_2', regex: / 2(?:\.[^./\\]+)?$/i, label: '" 2" suffix' },
  { key: 'copy', regex: /copy/i, label: '"copy" içeren isim' },
  { key: 'paren_copy', regex: /\(\d+\)(?:\.[^./\\]+)?$/i, label: '"(1)/(2)" kopya formatı' },
];

function shouldIgnoreDir(dirName) {
  return IGNORED_DIRS.has(dirName);
}

function findSuspiciousEntries(rootDir) {
  const findings = [];
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    let entries = [];

    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch (error) {
      console.error(`[hygiene] Klasör okunamadı: ${currentDir}`);
      console.error(`[hygiene] ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      const relativePath = path.relative(rootDir, absolutePath);

      if (entry.isDirectory() && shouldIgnoreDir(entry.name)) {
        continue;
      }

      const matchedPattern = DUPLICATE_PATTERNS.find((pattern) =>
        pattern.regex.test(entry.name),
      );

      if (matchedPattern) {
        findings.push({
          relativePath,
          name: entry.name,
          type: entry.isDirectory() ? 'dir' : 'file',
          reason: matchedPattern.label,
        });
      }

      if (entry.isDirectory()) {
        queue.push(absolutePath);
      }
    }
  }

  return findings;
}

const findings = findSuspiciousEntries(ROOT_DIR);

if (findings.length > 0) {
  console.error(`[hygiene] ${findings.length} şüpheli duplicate bulundu:`);
  findings
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
    .forEach((finding) => {
      console.error(
        `- [${finding.type}] ${finding.relativePath} (${finding.reason})`,
      );
    });
  process.exit(1);
}

console.log('[hygiene] OK - duplicate pattern bulunmadı.');
