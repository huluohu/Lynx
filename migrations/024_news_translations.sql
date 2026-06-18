-- 024: cache translated news content without overwriting originals

CREATE TABLE IF NOT EXISTS news_translations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  news_id INTEGER NOT NULL REFERENCES news(id) ON DELETE CASCADE,
  target_language TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  content TEXT,
  status TEXT DEFAULT 'cached', -- fetching/cached/failed
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(news_id, target_language)
);

CREATE INDEX IF NOT EXISTS idx_news_translations_news ON news_translations(news_id, target_language);

