CREATE TABLE IF NOT EXISTS cards (
  token TEXT PRIMARY KEY CHECK(length(token) = 12 AND token NOT GLOB '*[^A-Za-z0-9_-]*'),
  status TEXT NOT NULL DEFAULT 'unclaimed' CHECK(status IN ('unclaimed','active','paused')),
  claim_code_hash TEXT,
  pin_hash TEXT, pin_salt TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER NOT NULL DEFAULT 0,
  auth_version INTEGER NOT NULL DEFAULT 0,
  recovery_email TEXT, backup_code_hash TEXT,
  full_name TEXT, job_title TEXT, company TEXT,
  phone TEXT, whatsapp TEXT, email TEXT, website TEXT, social_link TEXT, bio TEXT,
  theme_color TEXT NOT NULL DEFAULT '#0D6E4F',
  lost_mode_message TEXT,
  scan_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
