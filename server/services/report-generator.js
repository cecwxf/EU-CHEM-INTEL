const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const https = require('https');
const fs = require('fs');
const path = require('path');

let DEEPSEEK_KEY = '';
try { DEEPSEEK_KEY = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'apiconfig.json'), 'utf8')).DEEPSEEK_API_KEY; } catch(e) {}

async function callDeepSeek(systemPrompt, userPrompt) {
  if (!DEEPSEEK_KEY) return null;
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: 'deepseek-chat', max_tokens: 4000, temperature: 0.3,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }]
    });
    const req = https.request({
      hostname: 'api.deepseek.com', port: 443, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DEEPSEEK_KEY}` }
    }, res => {
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
    req.setTimeout(120000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

async function generateReport(type = 'weekly', period = 'this_week') {
  console.log(`[REPORT] Generating ${type} report...`);
  const now = new Date();
  let periodStart, periodEnd;
  if (type === 'daily') {
    periodEnd = new Date(now); periodStart = new Date(now); periodStart.setHours(0,0,0,0);
  } else {
    periodEnd = new Date(now); periodStart = new Date(now); periodStart.setDate(periodStart.getDate() - 7);
  }
  const dateRange = { start: periodStart.toISOString().split('T')[0], end: periodEnd.toISOString().split('T')[0] };

  const allItems = db.getIntelItems({ page: 1, limit: 500 }).items;
  if (allItems.length === 0) {
    const report = { id: uuidv4(), type, title: `EU-CHEM INTEL · ${type==='daily'?'日报':'周报'} · ${dateRange.end}`, period_start: dateRange.start, period_end: dateRange.end, content: { overview: { text: '暂无数据。' } }, status: 'published' };
    db.insertReport(report);
    return report;
  }

  // Build context from all intel
  const topItems = [...allItems].sort((a,b) => {
    const sa = a.signal_level === 'Critical' ? 3 : a.signal_level === 'Priority' ? 2 : a.signal_level === 'High' ? 1 : 0;
    const sb = b.signal_level === 'Critical' ? 3 : b.signal_level === 'Priority' ? 2 : b.signal_level === 'High' ? 1 : 0;
    return sb - sa || new Date(b.published_date) - new Date(a.published_date);
  }).slice(0, 40);

  const context = topItems.map((i, idx) =>
    `[${idx+1}] ${i.title}\n来源: ${i.source_name} | 日期: ${i.published_date} | 等级: ${i.signal_level} | 主题: ${i.topic_category}\n${(i.summary||'').substring(0, 400)}`
  ).join('\n\n---\n\n');

  // Topic & signal stats
  const critCount = topItems.filter(i => i.signal_level === 'Critical').length;
  const topicCounts = {};
  topItems.forEach(i => { topicCounts[i.topic_category] = (topicCounts[i.topic_category]||0) + 1; });
  const topicSummary = Object.entries(topicCounts).sort((a,b)=>b[1]-a[1]).map(([t,c])=>`${t}(${c}条)`).join('、');

  const stats = `数据范围: ${allItems.length}条情报 | 重大预警: ${critCount} | 主题分布: ${topicSummary}`;

  // Try DeepSeek AI generation
  let aiContent = null;
  if (DEEPSEEK_KEY) {
    console.log('[REPORT] Using DeepSeek AI...');
    try {
      const dailyPrompt = `你是 EU-CHEM INTEL 的每日情报分析师。根据今日情报，生成一份简洁的每日研情报告（800-1200字）。
## 一、今日概览（100字）
## 二、今日要闻（3-5条，每条50字+来源）
## 三、预警信号（如有Critical/Priority级别）
## 四、今日关注企业
## 五、行动提示（2-3条）`;

      const weeklyPrompt = `你是 EU-CHEM INTEL 的资深行业分析师。根据本周情报，生成一份深度每周研情分析报告（2000-3000字）。
## 一、行业概览（150-200字总结本周最重要趋势）
## 二、重点动态（5-8条，每条含标题、摘要、战略影响分析、来源链接）
## 三、法规监测（REACH/SVHC、PFAS、6PPD、BPA等政策更新）
## 四、企业深度追踪（BASF、Covestro、Evonik、INEOS、SABIC等27家重点企业动态）
## 五、产品与技术前沿（新材料、绿色化工、循环技术、生物基化学品等）
## 六、战略启示（150-200字，对管理层决策参考）
## 七、下周行动建议（3-5条具体建议）
要求：引用具体情报编号和来源，数据分析深入，观点鲜明但不编造。`;

      const systemPrompt = type === 'daily' ? dailyPrompt : weeklyPrompt;
      aiContent = await callDeepSeek(systemPrompt, `${stats}\n\n情报数据：\n${context}\n\n请生成${type==='daily'?'每日':'每周'}研情分析报告。`);
      console.log('[REPORT] AI generated:', aiContent.length, 'chars');
    } catch(e) {
      console.error('[REPORT] DeepSeek error:', e.message);
    }
  }

  // Parse AI content or build fallback
  let content;
  if (aiContent) {
    content = { aiGenerated: true, fullReport: aiContent };
  } else {
    // Fallback: template-based
    content = {
      aiGenerated: false,
      overview: { text: `${allItems.length}条情报，${critCount}条重大预警，覆盖${Object.keys(topicCounts).length}个主题维度。` },
      developments: { items: topItems.slice(0, 8).map(i => ({ title: i.title, summary: i.summary, source: i.source_name, source_url: i.source_url, date: i.published_date, signal_level: i.signal_level })) },
      implications: { text: '请配置 DeepSeek API Key 以启用 AI 自动生成研报。当前为模板模式。' },
      actions: { actions: [{ title: '配置 API Key 启用 AI 研报生成', priority: 'High' }] }
    };
  }

  const title = `EU-CHEM INTEL · ${type === 'daily' ? '每日研情分析报告' : '每周研情分析报告'} · ${dateRange.end}`;
  const report = { id: uuidv4(), type, title, period_start: dateRange.start, period_end: dateRange.end, content, status: 'published' };
  db.insertReport(report);
  return report;
}

module.exports = { generateReport };
