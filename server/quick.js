const http = require('http');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DIST = path.join(__dirname, '..', 'frontend', 'dist');
const MIME = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json' };

// Load database and services directly (no separate process)
const db = require('./services/database');
const tagger = require('./services/tagger');
const reportGen = require('./services/report-generator');
const seedData = require('./services/seed-data');

// Parse JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch(e) { resolve({}); }
    });
  });
}

// Send JSON response
function json(res, data, code = 200) {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

// Simple router
async function handleAPI(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const method = req.method;

  // CORS
  if (method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PUT', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  try {
    if (url.pathname === '/api/status' && method === 'GET') {
      return json(res, {
        running: true,
        totalItems: db.intelItems.length,
        lastScrape: lastScrapeTime,
        nextScrape: lastScrapeTime ? new Date(new Date(lastScrapeTime).getTime() + 2*60*60*1000).toISOString() : null,
        uptime: process.uptime()
      });
    }
    if (url.pathname === '/api/kpi' && method === 'GET') {
      const kpi = db.getKPI();
      kpi.lastUpdated = lastScrapeTime;
      return json(res, kpi);
    }
    if (url.pathname === '/api/intel' && method === 'GET') {
      const { tag, topic, search, page = 1, limit = 50 } = Object.fromEntries(url.searchParams);
      return json(res, db.getIntelItems({ tag, topic, search, page: parseInt(page), limit: parseInt(limit) }));
    }
    if (url.pathname === '/api/tags' && method === 'GET') {
      return json(res, tagger.getTagDefinitions());
    }
    if (url.pathname === '/api/reports' && method === 'GET') {
      const type = url.searchParams.get('type') || 'all';
      return json(res, db.getReports(type));
    }
    // Download must be BEFORE the generic /api/reports/:id route
    if (url.pathname === '/api/reports/download' && method === 'GET') {
      const reportId = url.searchParams.get('id');
      const report = reportId ? db.getReportById(reportId) : db.getReports('weekly')[0];
      if (!report) return json(res, { error: 'No report found' }, 404);
      const html = generateDownloadHTML(report);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="EU-CHEM-INTEL-${report.type}-${report.period_end}.html"`
      });
      return res.end(html);
    }
    if (url.pathname.startsWith('/api/reports/') && method === 'GET') {
      const id = url.pathname.split('/').pop();
      if (id === 'download') return; // handled above
      const report = db.getReportById(id);
      if (!report) return json(res, { error: 'Not found' }, 404);
      return json(res, report);
    }
    if (url.pathname === '/api/reports/generate' && method === 'POST') {
      const body = await parseBody(req);
      const report = await reportGen.generateReport(body.type || 'weekly', body.period || 'all_data');
      return json(res, { success: true, report });
    }
    if (url.pathname === '/api/companies' && method === 'GET') {
      return json(res, db.getCompanyUpdates());
    }
    if (url.pathname === '/api/products' && method === 'GET') {
      return json(res, db.getProductUpdates());
    }
    if (url.pathname === '/api/regulatory' && method === 'GET') {
      return json(res, db.getRegulatoryUpdates());
    }
    if (url.pathname === '/api/action-tracker' && method === 'GET') {
      return json(res, db.getActionTracker());
    }
    if (url.pathname === '/api/scrape' && method === 'POST') {
      const scraper = require('./services/scraper');
      const results = await scraper.scrapeAll();
      return json(res, { success: true, items: results.length, message: `Scraped ${results.length} items` });
    }
    if (url.pathname.startsWith('/api/intel/') && url.pathname.endsWith('/tags') && method === 'PUT') {
      const id = url.pathname.split('/')[3];
      const body = await parseBody(req);
      db.updateItemTags(id, body.tags || []);
      return json(res, { success: true });
    }

    // ============ Agent Chat API (AI分析引擎) ============
    if (url.pathname === '/api/chat' && method === 'POST') {
      const body = await parseBody(req);
      const query = (body.message || '').trim();
      const history = body.history || [];
      if (!query) return json(res, { reply: '请输入您的问题。', results: [] });

      // Search intel - enhanced matching with CN/EN mapping
      const allItems = db.getIntelItems({ page: 1, limit: 500 }).items;
      const qLower = query.toLowerCase();
      let keywords = qLower.split(/[\s,，、]+/).filter(k => k.length > 1);

      // Add English equivalents for Chinese search terms
      const cn2en = {
        '欧盟':'european commission eu ec ',
        '政策':'policy regulation regulatory ',
        '法规':'regulation regulatory law directive ',
        '并购':'merger acquisition m&a deal buyout divestiture ',
        '关停':'closure shutdown close mothball halt ',
        '产能':'capacity production output tonne ',
        '巴斯夫':'basf ',
        '碳关税':'cbam carbon border ',
        '反倾销':'anti-dumping anti-subsidy tariff duty ',
        '关闭':'closure shutdown close mothball ',
        '扩产':'expansion capacity new plant ',
        '停产':'shutdown idled halted stopped ',
        '技术':'technology innovation r&d ',
        '绿色':'green sustainable bio-based circular ',
        '价格':'price cost margin ',
        '能源':'energy gas power electricity ',
        '投资':'investment invest funding capital ',
        '新材料':'new material polymer resin specialty ',
        '安全':'safety accident fire explosion incident ',
      };
      for (const [cn, en] of Object.entries(cn2en)) {
        if (qLower.includes(cn)) keywords.push(...en.trim().split(/\s+/));
      }

      // Score each item by relevance
      const scored = allItems.map(item => {
        const txt = ((item.title||'') + ' ' + (item.summary||'') + ' ' + (item.tags||[]).join(' ') + ' ' + (item.source_name||'')).toLowerCase();
        let score = 0;

        // Full query match (highest weight)
        if (txt.includes(qLower)) score += 50;

        // Keyword matching
        keywords.forEach(k => {
          if (txt.includes(k)) score += 10;
          // Partial match (for long keywords)
          if (k.length >= 4) {
            for (let i = 0; i < k.length - 2; i++) {
              if (txt.includes(k.substring(i, i+2))) score += 1;
            }
          }
        });

        // Boost Critical/Priority items
        if (item.signal_level === 'Critical') score += 5;
        if (item.signal_level === 'Priority') score += 3;
        if (item.signal_level === 'High') score += 1;

        // Boost items with rich summaries
        if ((item.summary||'').length > 100) score += 2;

        return { item, score };
      });

      // Sort by score and take top
      scored.sort((a, b) => b.score - a.score);
      const topResults = scored.slice(0, 20).map(s => s.item);
      const results = scored.filter(s => s.score >= 8).map(s => s.item);

      // ===== DeepSeek AI 分析 =====
      // Load API key
      let DEEPSEEK_KEY = '';
      try { DEEPSEEK_KEY = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, 'apiconfig.json'), 'utf8')).DEEPSEEK_API_KEY; } catch(e) {}

      // Build context from top matching intel
      const contextParts = topResults.slice(0, 15).map((i, idx) =>
        `[情报${idx+1}] 标题: ${i.title}\n来源: ${i.source_name} | 日期: ${i.published_date} | 等级: ${i.signal_level}\n摘要: ${(i.summary||'').substring(0, 300)}`
      );
      const context = contextParts.join('\n\n---\n\n');

      // Statistical summary for the AI
      const critCount = topResults.filter(i => i.signal_level === 'Critical').length;
      const topicDist = {};
      topResults.forEach(i => { topicDist[i.topic_category] = (topicDist[i.topic_category]||0) + 1; });
      const topics = Object.entries(topicDist).sort((a,b)=>b[1]-a[1]).map(([t,c])=>`${topicLabel(t)}(${c}条)`).join('、');

      const statsSummary = `匹配情报: ${results.length}条 | 重大预警: ${critCount}条 | 主题分布: ${topics}`;

      if (DEEPSEEK_KEY) {
        try {
          const https = require('https');
          const dsReply = await new Promise((resolve, reject) => {
            const data = JSON.stringify({
              model: 'deepseek-chat',
              max_tokens: 2000,
              temperature: 0.7,
              messages: [
                { role: 'system', content: `你是 EU-CHEM INTEL 的 AI 情报分析专家。你的知识库是欧洲化工行业实时情报数据。

基于提供的情报数据进行专业分析，遵守以下规则：
1. 必须引用具体情报（标注编号、来源、日期）
2. 进行趋势分析和战略解读
3. 数据不足时诚实说明，不编造信息
4. 使用专业简洁的中文
5. 输出结构清晰，可用Markdown标题（## 和 ###）
6. 回复结尾给出3-5条具体建议

当前数据库统计：${statsSummary}` },
                { role: 'user', content: `以下是从情报系统中检索到的相关数据：\n\n${context}\n\n---\n用户问题：${query}\n\n请基于以上情报数据进行分析。` }
              ]
            });

            const opts = {
              hostname: 'api.deepseek.com', port: 443, path: '/v1/chat/completions', method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` }
            };

            const req = https.request(opts, res => {
              let d = '';
              res.on('data', c => d += c);
              res.on('end', () => {
                try {
                  const p = JSON.parse(d);
                  if (p.choices && p.choices[0]) resolve(p.choices[0].message.content);
                  else reject(new Error((p.error && p.error.message) || 'API error'));
                } catch(e) { reject(e); }
              });
            });
            req.on('error', reject);
            req.setTimeout(45000, () => { req.destroy(); reject(new Error('timeout')); });
            req.write(data);
            req.end();
          });

          return json(res, {
            reply: dsReply,
            results: topResults.slice(0, 8).map(i => ({
              title: i.title, summary: (i.summary||'').substring(0, 200),
              source: i.source_name, date: i.published_date,
              signal_level: i.signal_level, topic: i.topic_category, url: i.source_url
            }))
          });
        } catch(dsErr) {
          console.error('DeepSeek error:', dsErr.message);
          // Fall through to template-based analysis
        }
      }

      // Fallback: smart template analysis (if no API key or API fails)
      const criticalItems = topResults.filter(i => i.signal_level === 'Critical');
      let reply = `> ⚠️ AI 模型暂时不可用 (${DEEPSEEK_KEY ? 'API调用失败' : '未配置Key'})，以下为系统内置分析：\n\n`;
      reply += `当前匹配 ${results.length} 条情报，其中 ${criticalItems.length} 条重大预警。\n\n`;
      reply += `### 关键情报\n`;
      topResults.slice(0, 8).forEach((i, idx) => {
        reply += `**${idx+1}.** ${i.title}\n> ${(i.summary||'').substring(0, 150)}...\n> 📰 ${i.source_name} | ${i.published_date}\n\n`;
      });
      reply += `### 建议\n请检查 API Key 配置或稍后重试。\n`;

      return json(res, {
        reply,
        results: topResults.slice(0, 8).map(i => ({
          title: i.title, summary: (i.summary||'').substring(0, 200),
          source: i.source_name, date: i.published_date,
          signal_level: i.signal_level, topic: i.topic_category, url: i.source_url
        }))
      });
    }

    json(res, { error: 'Not found' }, 404);
  } catch(err) {
    console.error('API Error:', err.message);
    json(res, { error: err.message }, 500);
  }
}

// Serve static file
function serveStatic(req, res) {
  const url = req.url.split('?')[0];
  let file = url === '/' ? '/index.html' : url;
  let filePath = path.join(DIST, file);
  if (!fs.existsSync(filePath)) filePath = path.join(DIST, 'index.html');
  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/html' });
  fs.createReadStream(filePath).pipe(res);
}

// Create server
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    return handleAPI(req, res);
  }
  return serveStatic(req, res);
});

// Global status
let lastScrapeTime = null;
let scrapeInterval = null;

// ============ 辅助函数 ============
function topicLabel(t) {
  const map = {'M&A':'并购整合','Capacity':'产能变化','Policy':'政策法规','Cost Structure':'成本结构','Technology':'技术发展','Market':'市场动态','General':'综合'};
  return map[t] || t;
}

function signalCN(s) {
  const map = {'Critical':'重大','Priority':'优先','High':'重要','Monitor':'监控'};
  return map[s] || s;
}

function generateDownloadHTML(report) {
  const c = report.content || {};
  const sectionOrder = ['overview','developments','regulatory','companies','products','personal_care','nutrition','research','implications','actions'];
  const titles = {
    overview:'一、行业概览', developments:'二、重点动态', regulatory:'三、法规监测',
    companies:'四、企业追踪', products:'五、产品与技术', personal_care:'六、个人护理与特种化学品',
    nutrition:'七、营养与饲料行业', research:'八、研究创新方向', implications:'九、战略启示', actions:'十、行动追踪'
  };

  let html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${report.title}</title>
<style>body{font-family:'PingFang SC','Microsoft YaHei',sans-serif;max-width:900px;margin:0 auto;padding:40px;color:#1a2332;line-height:1.8}
h1{color:#1a3a5c;border-bottom:3px solid #c9a84c;padding-bottom:12px}h2{color:#1a3a5c;margin-top:32px;border-bottom:1px solid #e8ecf1;padding-bottom:8px}
.meta{color:#8896a6;font-size:14px;margin-bottom:24px}.section{margin:20px 0;padding:16px;background:#f8fafb}
.item{margin:12px 0;padding:12px;border-left:3px solid #2c6faa}.item h4{margin:0 0 6px}.item p{margin:4px 0;color:#4a5568}
.source{color:#8896a6;font-size:13px}.critical{border-left-color:#c0392b}.tag{display:inline-block;padding:2px 8px;background:#eef2f7;border-radius:3px;font-size:12px;margin:2px}
.dl-btn{position:fixed;top:16px;right:16px;background:#1a3a5c;color:white;border:none;padding:10px 20px;border-radius:4px;cursor:pointer;font-size:14px}
@media print{.dl-btn{display:none}}
</style></head><body>
<button class="dl-btn" onclick="window.print()">🖨️ 打印 / 导出PDF</button>
<h1>${report.title}</h1><div class="meta">周期：${report.period_start} – ${report.period_end} | 类型：${report.type === 'daily' ? '日报' : '周报'} | EU-CHEM INTEL 情报系统</div>`;

  for (const secId of sectionOrder) {
    const sec = c[secId];
    if (!sec) continue;
    html += `<h2>${titles[secId] || secId}</h2><div class="section">`;

    if (secId === 'developments' && sec.items) {
      sec.items.forEach(item => {
        html += `<div class="item ${(item.signal_level==='Critical'?'critical':'')}"><h4>${item.title}</h4><p>${item.summary||''}</p><div class="source">📰 ${item.source||''} | 📅 ${item.date||''} | ${signalCN(item.signal_level)}</div></div>`;
      });
    } else if (secId === 'regulatory' && sec.tracks) {
      for (const [track, updates] of Object.entries(sec.tracks)) {
        html += `<p><strong>📜 ${track}</strong></p>`;
        updates.forEach(u => { html += `<p>· ${u.status || (u.title+'（'+u.date+'）')}</p>`; });
      }
    } else if (secId === 'companies' && sec.companies) {
      const active = Object.entries(sec.companies).filter(([,v]) => v[0] && !v[0].status);
      if (active.length) {
        active.forEach(([name, updates]) => {
          html += `<p><strong>🏢 ${name}</strong></p>`;
          updates.forEach(u => { html += `<p>· ${u.title} <span class="source">${u.date}</span></p>`; });
        });
      } else { html += '<p>本周期未发现重大企业动态。</p>'; }
    } else if (secId === 'products' && sec.products) {
      const active = Object.entries(sec.products).filter(([,v]) => v[0] && !v[0].status);
      if (active.length) {
        active.forEach(([name, updates]) => {
          html += `<p><strong>🧪 ${name}</strong></p>`;
          updates.forEach(u => { html += `<p>· ${u.title} <span class="source">${u.date}</span></p>`; });
        });
      } else { html += '<p>本周期未发现重大产品更新。</p>'; }
    } else if (secId === 'actions' && sec.actions) {
      sec.actions.forEach(a => {
        html += `<p>· <span class="tag">${a.priority||''}</span> ${a.title}</p>`;
      });
    } else {
      html += `<p>${sec.text || '暂无内容'}</p>`;
    }
    html += `</div>`;
  }

  html += `<p style="text-align:center;color:#8896a6;margin-top:32px;font-size:12px">EU-CHEM INTEL · 欧洲化工行业综合情报系统 · 中国总部内部文件</p></body></html>`;
  return html;
}

// Init database and start
db.initialize().then(() => seedData.seedIfEmpty()).then(() => {
  server.listen(5173, '0.0.0.0', () => {
    console.log('EU-CHEM INTEL ready on 0.0.0.0:5173 with', db.intelItems.length, 'items');

    // Start background auto-scrape (every 2 hours)
    const scraper = require('./services/scraper');
    async function autoScrape() {
      try {
        console.log('[AUTO-SCRAPE] Starting periodic scrape...');
        await scraper.scrapeAll();
        lastScrapeTime = new Date().toISOString();
        console.log('[AUTO-SCRAPE] Done. Total items:', db.intelItems.length);
      } catch(e) { console.error('[AUTO-SCRAPE] Error:', e.message); }
    }
    // Run first auto-scrape after 30 seconds
    setTimeout(autoScrape, 30000);
    // Then every 2 hours
    scrapeInterval = setInterval(autoScrape, 2 * 60 * 60 * 1000);
    lastScrapeTime = new Date().toISOString();
  });
}).catch(err => {
  console.error('Init error:', err);
  server.listen(5173, '0.0.0.0', () => console.log('Server started with errors'));
});
