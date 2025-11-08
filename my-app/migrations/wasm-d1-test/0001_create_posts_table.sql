-- 初期マイグレーション: posts テーブルを作成
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_title ON posts(title);

INSERT OR IGNORE INTO posts (id, title, body)
VALUES (
  1,
  'Hello from D1 migrations',
  'This sample row was inserted via migrations so the /d1 route has something to show.'
);
