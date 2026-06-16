import { Router } from 'express';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getDb, getDbPath, getDataDirectory } from '../db/database.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverPackage = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

const router = Router();

router.get('/info', (req, res) => {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings WHERE key IN (?, ?)')
    .all('theme', 'language');

  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]));

  res.json({
    success: true,
    data: {
      serverVersion: serverPackage.version || 'dev',
      dataDirectory: getDataDirectory(),
      databasePath: getDbPath(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      theme: settings.theme || 'dark',
      language: settings.language || 'zh-CN',
    },
  });
});

export default router;
