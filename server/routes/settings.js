import { Router } from 'express';
import { getDb } from '../db/database.js';

const router = Router();

// GET 所有设置
router.get('/', (req, res) => {
  const rows = getDb().prepare('SELECT key, value FROM settings ORDER BY key').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json({ success: true, data: settings });
});

// GET 单个设置
router.get('/:key', (req, res) => {
  const row = getDb().prepare('SELECT key, value FROM settings WHERE key = ?').get(req.params.key);
  if (!row) return res.status(404).json({ success: false, error: '设置不存在' });
  res.json({ success: true, data: { [row.key]: row.value } });
});

// PUT 更新设置
router.put('/:key', (req, res) => {
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ success: false, error: 'value 不能为空' });
  getDb().prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')').run(req.params.key, String(value));
  res.json({ success: true, data: { [req.params.key]: String(value) } });
});

// PUT 批量更新
router.put('/', (req, res) => {
  const settings = req.body;
  if (!settings || typeof settings !== 'object') return res.status(400).json({ success: false, error: '无效数据' });
  const db = getDb();
  const stmt = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')');
  for (const [key, value] of Object.entries(settings)) {
    stmt.run(key, String(value));
  }
  res.json({ success: true });
});

export default router;
