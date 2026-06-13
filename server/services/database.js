const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const INTEL_FILE = path.join(DATA_DIR, 'intel_items.json');
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json');
const ACTIONS_FILE = path.join(DATA_DIR, 'action_tracker.json');

class DatabaseService {
  constructor() {
    this.intelItems = [];
    this.reports = [];
    this.actions = [];
  }

  async initialize() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    this._loadAll();
    console.log('[DB] Initialized with', this.intelItems.length, 'intel items,', this.reports.length, 'reports,', this.actions.length, 'actions');
  }

  _loadAll() {
    try { this.intelItems = JSON.parse(fs.readFileSync(INTEL_FILE, 'utf8')); } catch(e) { this.intelItems = []; }
    try { this.reports = JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8')); } catch(e) { this.reports = []; }
    try { this.actions = JSON.parse(fs.readFileSync(ACTIONS_FILE, 'utf8')); } catch(e) { this.actions = []; }
  }

  _saveIntel() { fs.writeFileSync(INTEL_FILE, JSON.stringify(this.intelItems, null, 2)); }
  _saveReports() { fs.writeFileSync(REPORTS_FILE, JSON.stringify(this.reports, null, 2)); }
  _saveActions() { fs.writeFileSync(ACTIONS_FILE, JSON.stringify(this.actions, null, 2)); }

  // ============ Intel Items ============
  insertIntelItem(item) {
    const exists = this.intelItems.find(i => i.id === item.id || i.source_url === item.source_url);
    if (exists) return; // Skip duplicates
    this.intelItems.push({
      id: item.id,
      title: item.title || '',
      summary: item.summary || '',
      source_name: item.source_name || '',
      source_url: item.source_url || '',
      published_date: item.published_date || new Date().toISOString().split('T')[0],
      scraped_date: new Date().toISOString(),
      topic_category: item.topic_category || 'General',
      signal_level: item.signal_level || 'Monitor',
      signal_confidence: item.signal_confidence || 'Watch',
      tags: item.tags || [],
      raw_content: item.raw_content || '',
      metadata: item.metadata || {}
    });
    this._saveIntel();
  }

  getIntelItems({ tag, topic, search, page = 1, limit = 50 }) {
    let items = [...this.intelItems];

    if (tag && tag !== 'All' && !tag.startsWith('__all_')) {
      // 新标签系统：按重要程度/紧急程度/风险机会筛选
      if (['高','中','低'].includes(tag)) {
        items = items.filter(i => (i.metadata?.impact?.importance || '中') === tag);
      } else if (['立即关注','持续跟踪','定期观察'].includes(tag)) {
        items = items.filter(i => (i.metadata?.impact?.urgency || '定期观察') === tag);
      } else if (['风险','机会','中性'].includes(tag)) {
        items = items.filter(i => (i.metadata?.impact?.risk_opportunity || '中性') === tag);
      } else if (['Critical','Priority','High','Monitor','Confirmed','Strong Signal','Watch'].includes(tag)) {
        // 兼容老标签
        items = items.filter(i => i.signal_level === tag || i.signal_confidence === tag);
      }
    }
    // 如果选了__all_xxx，不筛选该维度

    if (topic && topic !== 'All') {
      // 新标签：按变化类型ID筛选（存储在 metadata.change_types 数组中）
      items = items.filter(i => {
        const changeTypes = (i.metadata?.change_types || []).map(ct => ct.id || ct);
        return changeTypes.includes(topic) || i.topic_category === topic;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        (i.title || '').toLowerCase().includes(q) ||
        (i.summary || '').toLowerCase().includes(q) ||
        (i.raw_content || '').toLowerCase().includes(q)
      );
    }

    items.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
    const total = items.length;
    const start = (page - 1) * limit;
    const paged = items.slice(start, start + limit);

    return {
      items: paged,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  updateItemTags(id, tags) {
    const item = this.intelItems.find(i => i.id === id);
    if (item) { item.tags = tags; this._saveIntel(); }
  }

  // ============ KPI ============
  // KPI derived from actual data (no hardcoded fallbacks)
  getKPI() {
    const total = this.intelItems.length;
    const critical = this.intelItems.filter(i => i.signal_level === 'Critical').length;
    const priority = this.intelItems.filter(i => i.signal_level === 'Priority').length;

    // 关停站点：统计Capacity主题中涉及关闭/停产/关停/closure/shutdown的条目
    const sitesClosed = this.intelItems.filter(i => {
      const txt = (i.title + (i.summary||'')).toLowerCase();
      return (txt.includes('close') || txt.includes('closure') || txt.includes('shut') ||
              txt.includes('停产') || txt.includes('关停') || txt.includes('关闭') ||
              txt.includes('mothball') || txt.includes('idle') || txt.includes('halt'));
    }).length;

    // 产能影响：统计涉及产能变化的条目（Capacity主题 + M&A中涉及产能的）
    const capacityRelated = this.intelItems.filter(i => {
      const txt = (i.title + (i.summary||'')).toLowerCase();
      return i.topic_category === 'Capacity' ||
             txt.includes('capacity') || txt.includes('tonne') || txt.includes('产能') ||
             txt.includes('KT') || txt.includes('MT') || txt.includes('扩产') ||
             txt.includes('减产') || txt.includes('投产');
    }).length;

    // 统计涉及的具体数字（从摘要中提取MT/KT数据）
    let mtCapacity = 0;
    this.intelItems.forEach(i => {
      const txt = (i.title + (i.summary||''));
      // 提取 xx KT / xx MT 等产能数字
      const mtMatch = txt.match(/(\d+[\.,]?\d*)\s*MT/i);
      const ktMatch = txt.match(/(\d+[\.,]?\d*)\s*KT/i);
      if (mtMatch) mtCapacity += parseFloat(mtMatch[1]);
      if (ktMatch) mtCapacity += parseFloat(ktMatch[1]) / 1000;
    });
    // 四舍五入
    mtCapacity = Math.round(mtCapacity * 10) / 10;

    return {
      totalItems: total,
      critical: critical,
      priority: priority,
      sitesClosed: sitesClosed,
      mtCapacity: mtCapacity || capacityRelated // 如果无法提取具体数字，返回关联条目数
    };
  }

  // ============ Reports ============
  insertReport(report) {
    this.reports.push({
      id: report.id,
      type: report.type,
      title: report.title,
      period_start: report.period_start,
      period_end: report.period_end,
      content: report.content,
      generated_date: new Date().toISOString(),
      status: report.status || 'published'
    });
    this._saveReports();
  }

  getReports(type = 'all') {
    let result = [...this.reports].sort((a, b) => new Date(b.generated_date) - new Date(a.generated_date));
    if (type !== 'all') result = result.filter(r => r.type === type);
    return result.slice(0, 20);
  }

  getReportById(id) {
    return this.reports.find(r => r.id === id) || null;
  }

  // ============ Company & Product ============
  getCompanyUpdates() {
    return this.intelItems
      .filter(i => i.topic_category === 'M&A' || i.topic_category === 'Capacity')
      .sort((a, b) => new Date(b.published_date) - new Date(a.published_date))
      .slice(0, 100);
  }

  getProductUpdates() {
    return this.intelItems
      .filter(i => i.topic_category === 'Technology')
      .sort((a, b) => new Date(b.published_date) - new Date(a.published_date))
      .slice(0, 100);
  }

  getRegulatoryUpdates() {
    return this.intelItems
      .filter(i => i.topic_category === 'Policy')
      .sort((a, b) => new Date(b.published_date) - new Date(a.published_date))
      .slice(0, 50);
  }

  // ============ Action Tracker ============
  getActionTracker() {
    return this.actions.filter(a => a.status === 'open');
  }

  addActionItem(item) {
    this.actions.push({
      id: item.id,
      title: item.title,
      description: item.description || '',
      priority: item.priority || 'Monitor',
      created_date: new Date().toISOString().split('T')[0],
      status: 'open'
    });
    this._saveActions();
  }

  getIntelCount() {
    return this.intelItems.length;
  }
}

module.exports = new DatabaseService();
