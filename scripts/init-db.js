const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_DIR || '/var/data';
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'products.db');

console.log('DB_DIR:', DB_DIR);
console.log('DB_PATH:', DB_PATH);

if (!fs.existsSync(DB_DIR)) {
  console.log('Creating directory:', DB_DIR);
  fs.mkdirSync(DB_DIR, { recursive: true });
}

console.log('Initializing database...');
try {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_code TEXT UNIQUE NOT NULL,
      product_name TEXT NOT NULL,
      price_incl_tax INTEGER,
      price_excl_tax INTEGER,
      description TEXT,
      category TEXT,
      sub_category TEXT,
      product_url TEXT NOT NULL,
      image_urls TEXT,
      availability TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_crawled_at DATETIME
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS crawl_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crawl_type TEXT NOT NULL,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      total_urls INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running',
      error_message TEXT
    )
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_product_code ON products(product_code);
    CREATE INDEX IF NOT EXISTS idx_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_last_crawled ON products(last_crawled_at);
    CREATE INDEX IF NOT EXISTS idx_crawl_status ON crawl_logs(status);
    CREATE INDEX IF NOT EXISTS idx_crawl_started ON crawl_logs(started_at);
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
    AFTER UPDATE ON products
    BEGIN
      UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `);

  console.log('Database initialized successfully!');
  console.log('File exists:', fs.existsSync(DB_PATH));
  db.close();
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

