/**
 * SQLite 数据库服务（sql.js 纯 JS 实现）
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'eu_chem_intel.db');
const DATA_DIR = path.dirname(DB_PATH);

class DatabaseService {
  constructor() {
    this.db = null;
  }

  async initialize() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buf = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(buf);
    } else {
      this.db = new SQL.Database();
    }
    this._createTables();
    console.log('[DB] SQLite initialized at', DB_PATH);
  }

  _createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS intel_items (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        summary TEXT DEFAULT '',
        source_name TEXT DEFAULT '',
        source_url TEXT DEFAULT '',
        published_date TEXT DEFAULT '',
        scraped_date TEXT DEFAULT '',
        topic_category TEXT DEFAULT 'General',
        signal_level TEXT DEFAULT 'Monitor',
        signal_confidence TEXT DEFAULT 'Watch',
        tags TEXT DEFAULT '[]',
        raw_content TEXT DEFAULT '',
        metadata TEXT DEFAULT '{}'
      )
    `);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_intel_date ON intel_items(published_date)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_intel_signal ON intel_items(signal_level)`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_intel_topic ON intel_items(topic_category)`);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS reports (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        period_start TEXT,
        period_end TEXT,
        content TEXT,
        generated_date TEXT DEFAULT (datetime('now')),
        status TEXT DEFAULT 'draft'
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS action_tracker (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        priority TEXT DEFAULT 'Monitor',
        created_date TEXT DEFAULT (date('now')),
        status TEXT DEFAULT 'open'
      )
    `);
    this._save();
  }

  _save() {
    const data = this.db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  _rowToItem(row) {
    return {
      ...row,
      tags: JSON.parse(row.tags || '[]'),
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  // ============ Intel Items ============
  insertIntelItem(item) {
    const exists = this.db.exec('SELECT id FROM intel_items WHERE id=? OR source_url=?',
      [item.id || '', item.source_url || '']);
    if (exists.length > 0 && exists[0].values.length > 0) return;

    this.db.run(
      `INSERT INTO intel_items (id,title,summary,source_name,source_url,published_date,scraped_date,topic_category,signal_level,signal_confidence,tags,raw_content,metadata)
       VALUES (?,?,?,?,?,?,datetime('now'),?,?,?,?,?,?)`,
      [
        item.id, item.title, item.summary || '', item.source_name || '', item.source_url || '',
        item.published_date || '', item.topic_category || 'General',
        item.signal_level || 'Monitor', item.signal_confidence || 'Watch',
        JSON.stringify(item.tags || []), item.raw_content || '', JSON.stringify(item.metadata || {})
      ]
    );
    this._save();
  }

  getIntelItems({ tag, topic, search, page = 1, limit = 50 }) {
    let where = ['1=1'];
    let params = [];

    if (tag && tag !== 'All' && !tag.startsWith('__all_')) {
      if (['高','中','低'].includes(tag)) {
        where.push("json_extract(metadata, '$.impact.importance') = ?");
        params.push(tag);
      } else if (['立即关注','持续跟踪','定期观察'].includes(tag)) {
        where.push("json_extract(metadata, '$.impact.urgency') = ?");
        params.push(tag);
      } else if (['风险','机会','中性'].includes(tag)) {
        where.push("json_extract(metadata, '$.impact.risk_opportunity') = ?");
        params.push(tag);
      } else if (['Critical','Priority','High','Monitor'].includes(tag)) {
        where.push('signal_level = ?');
        params.push(tag);
      } else if (['Confirmed','Strong Signal','Watch'].includes(tag)) {
        where.push('signal_confidence = ?');
        params.push(tag);
      }
    }

    if (topic && topic !== 'All') {
      where.push("(topic_category = ? OR metadata LIKE ?)");
      params.push(topic, `%"id":"${topic}"%`);
    }

    if (search) {
      where.push('(title LIKE ? OR summary LIKE ? OR raw_content LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM intel_items WHERE ${where.join(' AND ')}`;
    const countResult = this.db.exec(countSql, params);
    const total = countResult[0]?.values[0]?.[0] || 0;

    const sql = `SELECT * FROM intel_items WHERE ${where.join(' AND ')} ORDER BY published_date DESC LIMIT ? OFFSET ?`;
    const result = this.db.exec(sql, [...params, limit, (page - 1) * limit]);
    const items = result[0]?.values.map(row => this._rowToItem({
      id: row[0], title: row[1], summary: row[2], source_name: row[3], source_url: row[4],
      published_date: row[5], scraped_date: row[6], topic_category: row[7],
      signal_level: row[8], signal_confidence: row[9], tags: row[10],
      raw_content: row[11], metadata: row[12]
    })) || [];

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  updateItemTags(id, tags) {
    this.db.run('UPDATE intel_items SET tags=? WHERE id=?', [JSON.stringify(tags), id]);
    this._save();
  }

  get intelItems() {
    const result = this.db.exec('SELECT * FROM intel_items');
    return result[0]?.values.map(row => this._rowToItem({
      id: row[0], title: row[1], summary: row[2], source_name: row[3], source_url: row[4],
      published_date: row[5], scraped_date: row[6], topic_category: row[7],
      signal_level: row[8], signal_confidence: row[9], tags: row[10],
      raw_content: row[11], metadata: row[12]
    })) || [];
  }

  set intelItems(items) {
    this.db.run('DELETE FROM intel_items');
    const stmt = this.db.prepare(`INSERT INTO intel_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    items.forEach(i => {
      stmt.run([i.id, i.title, i.summary||'', i.source_name||'', i.source_url||'',
        i.published_date||'', i.scraped_date||'', i.topic_category||'General',
        i.signal_level||'Monitor', i.signal_confidence||'Watch',
        JSON.stringify(i.tags||[]), i.raw_content||'', JSON.stringify(i.metadata||{})]);
    });
    stmt.free();
    this._save();
  }

  // ============ KPI ============
  getKPI() {
    const total = this.db.exec('SELECT COUNT(*) FROM intel_items')[0].values[0][0];
    const critical = this.db.exec("SELECT COUNT(*) FROM intel_items WHERE signal_level='Critical'")[0].values[0][0];
    const sitesClosed = this.db.exec("SELECT COUNT(*) FROM intel_items WHERE (title||summary) LIKE '%close%' OR (title||summary) LIKE '%shut%' OR (title||summary) LIKE '%停产%' OR (title||summary) LIKE '%关停%'")[0].values[0][0];
    const capacityRelated = this.db.exec("SELECT COUNT(*) FROM intel_items WHERE topic_category='Capacity' OR (title||summary) LIKE '%capacity%' OR (title||summary) LIKE '%产能%'")[0].values[0][0];

    let mtCapacity = 0;
    const items = this.intelItems;
    items.forEach(i => {
      const txt = (i.title||'') + ' ' + (i.summary||'');
      const mt = txt.match(/(\d+[\.,]?\d*)\s*MT/i);
      const kt = txt.match(/(\d+[\.,]?\d*)\s*KT/i);
      if (mt) mtCapacity += parseFloat(mt[1]);
      if (kt) mtCapacity += parseFloat(kt[1]) / 1000;
    });

    return {
      totalItems: total,
      critical,
      sitesClosed,
      mtCapacity: Math.round(mtCapacity * 10) / 10 || capacityRelated
    };
  }

  // ============ Reports ============
  insertReport(report) {
    this.db.run(
      `INSERT INTO reports (id,type,title,period_start,period_end,content,status) VALUES (?,?,?,?,?,?,?)`,
      [report.id, report.type, report.title, report.period_start, report.period_end,
       JSON.stringify(report.content), report.status || 'published']
    );
    this._save();
  }

  getReports(type = 'all') {
    let sql = 'SELECT * FROM reports';
    if (type !== 'all') sql += ' WHERE type=?';
    sql += ' ORDER BY generated_date DESC LIMIT 20';
    const result = this.db.exec(sql, type !== 'all' ? [type] : []);
    return result[0]?.values.map(row => ({
      id: row[0], type: row[1], title: row[2], period_start: row[3], period_end: row[4],
      content: JSON.parse(row[5] || '{}'), generated_date: row[6], status: row[7]
    })) || [];
  }

  getReportById(id) {
    const result = this.db.exec('SELECT * FROM reports WHERE id=?', [id]);
    if (!result[0]?.values.length) return null;
    const row = result[0].values[0];
    return { id: row[0], type: row[1], title: row[2], period_start: row[3], period_end: row[4],
             content: JSON.parse(row[5] || '{}'), generated_date: row[6], status: row[7] };
  }

  // ============ Company / Product / Regulatory ============
  getCompanyUpdates() {
    return this.intelItems.filter(i => i.topic_category === 'M&A' || i.topic_category === 'Capacity').slice(0, 100);
  }
  getProductUpdates() {
    return this.intelItems.filter(i => i.topic_category === 'Technology').slice(0, 100);
  }
  getRegulatoryUpdates() {
    return this.intelItems.filter(i => i.topic_category === 'Policy').slice(0, 50);
  }

  // ============ Action Tracker ============
  getActionTracker() {
    const result = this.db.exec("SELECT * FROM action_tracker WHERE status='open' ORDER BY priority DESC");
    return result[0]?.values.map(row => ({
      id: row[0], title: row[1], description: row[2], priority: row[3], created_date: row[4], status: row[5]
    })) || [];
  }

  addActionItem(item) {
    this.db.run(
      'INSERT INTO action_tracker (id,title,description,priority) VALUES (?,?,?,?)',
      [item.id, item.title, item.description || '', item.priority || 'Monitor']
    );
    this._save();
  }

  getIntelCount() {
    return this.db.exec('SELECT COUNT(*) FROM intel_items')[0].values[0][0];
  }

  // for seed migration
  get intelCount() {
    return this.getIntelCount();
  }
}

module.exports = new DatabaseService();
