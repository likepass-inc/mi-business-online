import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

// データベースファイルのパス
// 環境変数から取得、なければデフォルトパスを使用
// Render.comの永続ディスクを使用する場合:
// DB_DIR=/var/data のように環境変数を設定
const DB_DIR = process.env.DB_DIR || path.join(process.cwd(), 'data')
const DB_PATH = process.env.DB_PATH || path.join(DB_DIR, 'products.db')

let dbInstance: Database.Database | null = null

export function getDatabase(): Database.Database {
  if (dbInstance) {
    return dbInstance
  }

  try {
    // データベースディレクトリが存在しない場合は作成（実行時のみ）
    if (!fs.existsSync(DB_DIR)) {
      try {
        fs.mkdirSync(DB_DIR, { recursive: true })
      } catch (mkdirError: any) {
        // ディレクトリ作成に失敗した場合でも、親ディレクトリが存在する可能性があるので続行
        if (mkdirError.code !== 'EEXIST') {
          console.warn('[Database] Failed to create directory, continuing anyway:', mkdirError.message)
        }
      }
    }
    
    console.log('[Database] Initializing database at:', DB_PATH)
    console.log('[Database] DB_DIR:', DB_DIR)
    
    dbInstance = new Database(DB_PATH)
    dbInstance.pragma('journal_mode = WAL')
    
    // テーブル作成
    initializeSchema(dbInstance)
    
    console.log('[Database] Database initialized successfully')
    return dbInstance
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error)
    throw error
  }
}

function initializeSchema(db: Database.Database) {
  // products テーブル
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
      image_urls TEXT, -- JSON配列として保存
      availability TEXT, -- 在庫状況
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_crawled_at DATETIME
    )
  `)

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_product_code ON products(product_code);
    CREATE INDEX IF NOT EXISTS idx_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_last_crawled ON products(last_crawled_at);
  `)

  // crawl_logs テーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS crawl_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      crawl_type TEXT NOT NULL, -- 'full' or 'incremental'
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      total_urls INTEGER DEFAULT 0,
      success_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running', -- 'running', 'completed', 'failed'
      error_message TEXT
    )
  `)

  // インデックス作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crawl_status ON crawl_logs(status);
    CREATE INDEX IF NOT EXISTS idx_crawl_started ON crawl_logs(started_at);
  `)

  // updated_at を自動更新するトリガー
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
    AFTER UPDATE ON products
    BEGIN
      UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END
  `)
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close()
    dbInstance = null
  }
}

