const axios = require('axios');
const cheerio = require('cheerio');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');
const tagger = require('./tagger');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const axiosInstance = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
  }
});

// ============ 化工关键词（中英文）============
const CHEM_KEYWORDS = [
  '化工', '化学', '石化', '乙烯', '丙烯', '苯', '甲醇', '合成氨', '化肥',
  '塑料', '树脂', '橡胶', '催化剂', '溶剂', '涂料', '胶粘剂', '添加剂',
  '精细化工', '新材料', '聚合物', '聚烯烃', '聚氨酯', '环氧', '丙烯酸',
  '苯乙烯', 'PX', 'PTA', 'MDI', 'TDI', 'PVC', 'PE', 'PP', 'PO',
  '产能', '停产', '关停', '检修', '扩产', '投产', '新建', '开工',
  '并购', '收购', '出售', '剥离', '合资', '重组', '上市',
  '碳边境', '碳关税', '碳中和', '碳排放', '碳交易', '双碳',
  '园区', '基地', '装置', '工厂', '炼油', '裂解', '乙烯裂解',
  '生物基', '可降解', '循环利用', '回收', '绿色化工',
  '巴斯夫', '赢创', '科思创', '英力士', '沙比克', '阿科玛',
  '索尔维', '帝斯曼', '诺力昂', '科莱恩', '朗盛', '北欧化工',
  '万华', '恒力', '荣盛', '恒逸', '桐昆', '卫星化学',
  '欧盟', 'REACH', '反倾销', '危险化学品', '危化品',
  '应急管理', '生态环境', '安全生产', '环保督察', '安监',
  'chemical', 'polymer', 'petrochemical', 'olefin', 'ethylene',
  'capacity', 'shutdown', 'closure', 'M&A', 'acquisition',
  'BASF', 'INEOS', 'SABIC', 'LyondellBasell', 'Covestro', 'Evonik',
  'REACH', 'ECHA', 'SVHC', 'PFAS', 'CBAM', 'carbon border'
];

function isRelevant(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  return CHEM_KEYWORDS.some(k => lower.includes(k.toLowerCase()));
}

// ============ 数据源定义 ============
// 分类说明：
//   scrapable: 可直接HTTP爬取
//   blocked: 需登录/付费/JS渲染（标记但跳过）
//   rss: 通过RSS订阅
const SOURCES = [
  // === 可爬取：中国行业门户 ===
  { name: '中国化工网', url: 'https://news.chemnet.com/', type: 'news' },
  { name: '化工新闻网', url: 'https://www.chem234.com/', type: 'news' },
  { name: '中国聚合网', url: 'http://www.polymer.cn/', type: 'news' },

  // === 可爬取：政府公告 ===
  { name: '生态环境部', url: 'https://www.mee.gov.cn/ywdt/', type: 'regulatory' },
  { name: '应急管理部', url: 'https://www.mem.gov.cn/xw/', type: 'regulatory' },

  // === 可爬取：论坛 ===
  { name: '海川化工论坛', url: 'https://bbs.hcbbs.com/forum-2-1.html', type: 'forum' },

  // === 可爬取：国际来源 ===
  { name: 'ECHA News', url: 'https://echa.europa.eu/news-and-events/news', type: 'regulatory' },
  { name: 'BASF 新闻', url: 'https://www.basf.com/global/en/media/news-releases.html', type: 'company' },
  { name: 'Covestro 新闻', url: 'https://www.covestro.com/press', type: 'company' },
  { name: 'SABIC 新闻', url: 'https://www.sabic.com/en/news', type: 'company' },
  { name: 'INEOS 新闻', url: 'https://www.ineos.com/news/', type: 'company' },
  { name: 'Solvay 新闻', url: 'https://www.solvay.com/en/press', type: 'company' },
  { name: 'Arkema 新闻', url: 'https://www.arkema.com/global/en/media/news/', type: 'company' },
  { name: 'ICIS News', url: 'https://www.icis.com/explore/news/', type: 'news' },
  { name: 'Chemical & Engineering News', url: 'https://cen.acs.org/sections/business.html', type: 'news' },

  // === 需付费/登录（仅记录，不爬取）===
  // Reuters, Bloomberg, Wind, Choice - 需要订阅或终端
  // 微信公众号, 微博 - 需要OAuth
  // 慧博投研 - 需要登录
];

// ============ 链接提取 ============
function extractLinks(html, sourceUrl) {
  const $ = cheerio.load(html);
  const links = [];
  const seen = new Set();

  // 先去噪
  $('script, style, nav, footer, .footer, .nav, .sidebar, .ad, .comment').remove();

  // 通用提取：找所有a标签里包含化学关键词的
  $('a[href]').each((i, el) => {
    const $el = $(el);
    const title = $el.text().trim();
    let href = $el.attr('href') || '';
    if (!title || !href || title.length < 8) return;
    if (href.startsWith('#') || href.startsWith('javascript')) return;

    // 转为绝对URL
    try {
      if (!href.startsWith('http')) {
        href = new URL(href, sourceUrl).href;
      }
    } catch(e) { return; }

    // 去重
    const key = href.split('?')[0];
    if (seen.has(key)) return;
    seen.add(key);

    // 化工相关性检查
    if (!isRelevant(title)) return;

    links.push({ title, url: href });
  });

  return links.slice(0, 15);
}

// ============ 文章内容提取 ============
async function fetchArticle(url) {
  try {
    const response = await axiosInstance.get(url);
    const $ = cheerio.load(response.data);

    // 去噪
    $('script, style, nav, footer, header, .nav, .footer, .header, .sidebar, ' +
      '.advertisement, .ad, .menu, .comment, .related, .recommend, .share, ' +
      '.breadcrumb, .navigation, noscript, iframe, .cookie, .popup').remove();

    // 尝试各种文章体选择器
    const contentSelectors = [
      'article', '.article-body', '.article-content', '.post-content',
      '.entry-content', '.story-body', '.news-content', '.content-body',
      '.detail-content', '.article-text', '.main-content',
      '#article-body', '#content', '.content', '.article', '.detail',
      '[itemprop="articleBody"]', '.post-body', '.news-text',
      '.TRS_Editor', '.Custom_UnionStyle', '.text-content'
    ];

    let text = '';
    for (const sel of contentSelectors) {
      const el = $(sel);
      if (el.length > 0) {
        const paras = [];
        el.find('p, .paragraph, section, .text').each((i, p) => {
          const t = $(p).text().trim();
          if (t.length > 20 && !/^(分享|点赞|收藏|关注|相关|推荐|热门|上一篇|下一篇|编辑|审核|来源)/.test(t)) {
            paras.push(t);
          }
        });
        text = paras.join('\n\n');
        if (text.length > 200) break;
      }
    }

    // 后备：取所有p标签
    if (text.length < 100) {
      const paras = [];
      $('p').each((i, p) => {
        const t = $(p).text().trim();
        if (t.length > 30) paras.push(t);
      });
      text = paras.join('\n\n');
    }

    return text.substring(0, 4000);
  } catch(e) {
    return '';
  }
}

// ============ 摘要生成 ============
function makeSummary(title, content) {
  if (!content || content.length < 20) return title;
  const cleaned = content.replace(/\s+/g, ' ').trim();
  const sentences = cleaned.split(/[。！？\.!\?]/);
  let summary = '';
  for (const s of sentences) {
    if (summary.length + s.length > 450) break;
    if (s.trim().length > 5) summary += s.trim() + '。';
  }
  return summary.substring(0, 500) || cleaned.substring(0, 500);
}

// ============ Google News RSS 抓取 (绕过付费墙) ============
const RSS_QUERIES = [
  { name: 'EU化工政策', url: 'https://news.google.com/rss/search?q=EU+chemical+regulation+policy+CBAM+REACH&hl=en-US&gl=US&ceid=US:en' },
  { name: '全球化工并购', url: 'https://news.google.com/rss/search?q=chemical+industry+M%26A+acquisition+divestiture+Europe&hl=en-US&gl=US&ceid=US:en' },
  { name: '化工产能变化', url: 'https://news.google.com/rss/search?q=chemical+plant+closure+shutdown+capacity+expansion+Europe&hl=en-US&gl=US&ceid=US:en' },
  { name: '化工巨头动态', url: 'https://news.google.com/rss/search?q=BASF+INEOS+SABIC+Covestro+Evonik+LyondellBasell+chemical&hl=en-US&gl=US&ceid=US:en' },
  { name: '化工新材料技术', url: 'https://news.google.com/rss/search?q=chemical+recycling+green+chemistry+bio-based+new+materials&hl=en-US&gl=US&ceid=US:en' },
  { name: '中国化工产业', url: 'https://news.google.com/rss/search?q=化工+产能+政策+并购+新材料+绿色&hl=zh-CN&gl=CN&ceid=CN:zh-Hans' },
];

async function scrapeRSS(query) {
  try {
    const response = await axiosInstance.get(query.url);
    const $ = cheerio.load(response.data, { xmlMode: true });
    const items = [];

    $('item').each((i, el) => {
      const title = $(el).find('title').text().trim();
      const link = $(el).find('link').text().trim();
      const description = $(el).find('description').text().trim();
      const pubDate = $(el).find('pubDate').text().trim();
      const source = $(el).find('source').text().trim();

      if (!title || !link) return;
      if (!isRelevant(title + description)) return;

      // Clean Google News source tag
      const sourceName = source || query.name;

      items.push({
        id: uuidv4(),
        title: title,
        summary: description.replace(/<[^>]+>/g, '').substring(0, 500),
        source_name: sourceName,
        source_url: link,
        published_date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        raw_content: description.replace(/<[^>]+>/g, '').substring(0, 2000)
      });
    });

    return items;
  } catch(e) {
    console.error(`  -> RSS ${query.name} 错误: ${e.message}`);
    return [];
  }
}

async function scrapeAllRSS() {
  console.log('[RSS抓取] 开始 Google News RSS...');
  const allItems = [];
  for (const q of RSS_QUERIES) {
    const items = await scrapeRSS(q);
    for (const item of items) {
      const tagRes = tagger.autoTag(item);
      item.topic_category = (tagRes.change_types && tagRes.change_types[0]) ? tagRes.change_types[0].id : 'General';
      item.signal_level = tagRes.signal_level;
      item.signal_confidence = tagRes.signal_confidence;
      item.tags = tagRes.all_tags;
      item.metadata = tagRes;
      db.insertIntelItem(item);
    }
    allItems.push(...items);
    console.log(`  -> ${q.name}: ${items.length} 条`);
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`[RSS抓取] 完成：${allItems.length} 条`);
  return allItems;
}

// ============ 主抓取函数 ============
async function scrapeSource(source) {
  console.log(`[抓取] ${source.name}...`);
  try {
    const response = await axiosInstance.get(source.url);
    const links = extractLinks(response.data, source.url);
    if (links.length === 0) {
      console.log(`  -> 无化工相关链接`);
      return [];
    }

    console.log(`  -> 找到 ${links.length} 条相关链接，正在获取详情...`);
    const items = [];

    // 取前5条获取详细内容
    for (const link of links.slice(0, 5)) {
      const content = await fetchArticle(link.url);
      if (content.length < 30) continue; // 跳过无法获取内容的

      const summary = makeSummary(link.title, content);
      if (!isRelevant(link.title + summary)) continue;

      const item = {
        id: uuidv4(),
        title: link.title,
        summary: summary,
        source_name: source.name,
        source_url: link.url,
        published_date: new Date().toISOString().split('T')[0],
        raw_content: content.substring(0, 4000)
      };

      const tagRes = tagger.autoTag(item);
      item.topic_category = (tagRes.change_types && tagRes.change_types[0]) ? tagRes.change_types[0].id : 'General';
      item.signal_level = tagRes.signal_level;
      item.signal_confidence = tagRes.signal_confidence;
      item.tags = tagRes.all_tags;
      item.metadata = tagRes;

      db.insertIntelItem(item);
      items.push(item);

      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200));
    }

    console.log(`  -> 保存 ${items.length} 条`);
    return items;
  } catch(err) {
    console.error(`  -> ${source.name} 错误: ${err.message}`);
    return [];
  }
}

async function scrapeAll() {
  console.log('[抓取] 开始全量抓取...');
  let allItems = [];

  // 先跑 RSS（Google News 聚合，覆盖付费墙后的源）
  const rssItems = await scrapeAllRSS();
  allItems.push(...rssItems);

  // 再跑直接爬取（中国门户、公司官网等）
  for (let i = 0; i < SOURCES.length; i += 2) {
    const batch = SOURCES.slice(i, i + 2);
    const results = await Promise.all(batch.map(s => scrapeSource(s).catch(() => [])));
    results.forEach(r => allItems.push(...r));
    if (i + 2 < SOURCES.length) await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`[抓取] 完成：${allItems.length} 条新情报`);
  return allItems;
}

module.exports = { scrapeAll, scrapeSource, SOURCES };
