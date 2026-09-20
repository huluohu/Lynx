#!/usr/bin/env node
/**
 * 校验 zh-CN / en-US 两份 i18n 消息文件的 key 集合完全一致。
 * 用法：npm run check:i18n（或 node scripts/check-i18n.mjs）
 */
import { pathToFileURL } from 'url';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = resolve(__dirname, '..', 'client', 'src', 'i18n', 'messages');

async function loadMessages(file) {
  const mod = await import(pathToFileURL(resolve(messagesDir, file)).href);
  return mod.default;
}

function flattenKeys(obj, prefix = '') {
  const keys = new Set();
  for (const [key, value] of Object.entries(obj || {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const child of flattenKeys(value, path)) keys.add(child);
    } else {
      keys.add(path);
    }
  }
  return keys;
}

function diffSet(a, b) {
  return [...a].filter((key) => !b.has(key)).sort();
}

const zh = flattenKeys(await loadMessages('zh-CN.js'));
const en = flattenKeys(await loadMessages('en-US.js'));

const missingInEn = diffSet(zh, en);
const missingInZh = diffSet(en, zh);

let failed = false;
if (missingInEn.length) {
  failed = true;
  console.error(`✖ en-US 缺少 ${missingInEn.length} 个 key:`);
  for (const key of missingInEn) console.error(`  - ${key}`);
}
if (missingInZh.length) {
  failed = true;
  console.error(`✖ zh-CN 缺少 ${missingInZh.length} 个 key:`);
  for (const key of missingInZh) console.error(`  - ${key}`);
}
if (!failed) {
  console.log(`✓ i18n key 一致（共 ${zh.size} 个）`);
}
process.exit(failed ? 1 : 0);
