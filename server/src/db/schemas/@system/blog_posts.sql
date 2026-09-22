CREATE TABLE IF NOT EXISTS blog_posts (
  id            SERIAL PRIMARY KEY,
  slug          VARCHAR(255) NOT NULL UNIQUE,
  title         VARCHAR(500) NOT NULL,
  excerpt       TEXT DEFAULT '',
  content       TEXT NOT NULL DEFAULT '',
  category      VARCHAR(100) DEFAULT 'Company',
  author        VARCHAR(255) DEFAULT 'The Team',
  tags          TEXT[] DEFAULT '{}',
  status        VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'scheduled', 'archived')),
  reading_time  INTEGER DEFAULT 0,
  featured      BOOLEAN DEFAULT FALSE,
  published_at  TIMESTAMPTZ,
  scheduled_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meta_title    VARCHAR(255),
  meta_description TEXT
);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category ON blog_posts(category);
