/**
 * 完整标签体系 — 基于附件《标签.pdf》
 * 五个维度：资讯变化类型、化工实体、影响判断、来源可信度、报告预警
 */

const TAG_SYSTEM = {
  // ============ 1. 资讯变化类型标签 ============
  change_types: [
    { id: 'policy', label: '政策法规与合规', keywords: [
      '政策','法规','监管','合规','REACH','CBAM','PFAS','SVHC','BPA','ECHA','反倾销','反补贴',
      '关税','碳边境','碳交易','排放','环保','安全生产','应急管理','工信部','生态环境部',
      'regulation','regulatory','compliance','directive','ban','restrict'
    ]},
    { id: 'price_cost', label: '价格、成本与利润变化', keywords: [
      '价格','成本','利润','涨价','降价','毛利','能源价格','天然气','电价','原材料','运费',
      'price','cost','margin','energy price','feedstock','inflation'
    ]},
    { id: 'supply_capacity', label: '供应、产能与装置运行', keywords: [
      '产能','产量','供应','开工率','检修','停产','关停','关闭','扩产','投产','新建','装置',
      'capacity','output','supply','shutdown','closure','expansion','startup','force majeure'
    ]},
    { id: 'demand_market', label: '下游需求与客户市场', keywords: [
      '需求','下游','客户','市场','消费','采购','订单','销售','出口','进口',
      'demand','downstream','customer','market','consumption','order'
    ]},
    { id: 'competitor', label: '竞争对手与企业动态', keywords: [
      '竞争','对手','战略','布局','组织','人事','CEO','总裁','任命',
      'competitor','strategy','restructuring','appointment','CEO'
    ]},
    { id: 'ma_investment', label: '投资并购与项目进展', keywords: [
      '并购','收购','出售','剥离','投资','合资','融资','IPO','上市','交易',
      'M&A','acquisition','merger','divestiture','investment','joint venture','deal'
    ]},
    { id: 'technology', label: '技术与应用趋势', keywords: [
      '技术','研发','创新','专利','突破','新材料','绿色','循环','回收','生物基','催化剂',
      'R&D','innovation','breakthrough','patent','sustainable','recycling','bio-based'
    ]},
    { id: 'safety_incident', label: '安全环保与突发事件', keywords: [
      '安全','事故','爆炸','火灾','泄漏','污染','环保','罚款','调查',
      'accident','fire','explosion','leak','spill','pollution','fatality','incident'
    ]},
    { id: 'trade_logistics', label: '贸易物流与供应链风险', keywords: [
      '贸易','物流','供应链','运输','港口','航运','制裁','禁运','中断',
      'trade','logistics','supply chain','shipping','sanction','embargo','disruption'
    ]}
  ],

  // ============ 2. 影响判断标签 ============
  impact: {
    importance: ['高','中','低'],
    risk_opportunity: ['风险','机会','中性','待观察'],
    direction: ['利好','利空','中性','不确定'],
    scope: ['价格','成本','供应','需求','竞争','技术','合规','客户','供应链'],
    urgency: ['立即关注','持续跟踪','定期观察'],
    action: ['推送预警','纳入周报','形成专题','分派跟进','仅归档'],
    manual_review: ['是','否'],
    ai_confidence: ['高','中','低']
  },

  // ============ 3. 来源与可信度标签 ============
  source: {
    types: ['政府公告','企业官网','行业媒体','专业数据库','研报','内部文件'],
    authority: ['高','中','低']
  },

  // ============ 4. 报告与预警标签 ============
  report: {
    attribution: ['日报','周报','月报','预警报告','专题报告'],
    alert_rules: ['价格异常','政策变化','竞争对手扩产','供应中断','重大并购','安全事故','环保处罚']
  }
};

// 化工实体词典
const ENTITY_DICT = {
  companies: [
    'BASF','Dow','CATL','INEOS','SABIC','Covestro','Evonik','Arkema','Solvay','Syensqo',
    'LyondellBasell','ExxonMobil','Shell','TotalEnergies','Neste','Borealis','OMV','Repsol',
    'Huntsman','Mitsui','Lubrizol','Cray Valley','Avantium','Amcor','Sealed Air','Nouryon',
    'Lanxess','Clariant','Croda','DSM','Firmenich','Givaudan',
    '万华','恒力','荣盛','恒逸','桐昆','卫星化学','湖南裕能','德方纳米','东方盛虹'
  ],
  products: [
    'LFP','MDI','TDI','PVDF','NMP','碳酸锂','磷酸铁',
    'PE','PP','PVC','PS','ABS','PC','PMMA','PA','PET','PBT','POM','PPS',
    'PEF','PEBA','EVOH','PVDC','COC','COP','PCTG','PETG','PSU','PPSU',
    '环氧树脂','聚氨酯','丙烯酸','有机硅','异氰酸酯','Rhamnolipids','Methionine','Carbomer'
  ],
  regions: ['中国','欧洲','东南亚','中东','北美','南美','非洲','印度','日本','韩国'],
  supply_chain: ['上游资源','上游原料','中间体','核心产品','下游应用','终端市场','回收循环'],
  business_segments: ['聚氨酯','石化','精细化工','新兴材料','未来产业','农化','医药','涂料','胶粘剂','电子化学品']
};

/**
 * 自动打标引擎
 */
function autoTag(item) {
  const text = ((item.title || '') + ' ' + (item.summary || '') + ' ' + (item.raw_content || '')).toLowerCase();
  const originalText = (item.title || '') + ' ' + (item.summary || '');

  // 1. 变化类型
  const changeTypes = [];
  TAG_SYSTEM.change_types.forEach(ct => {
    const matches = ct.keywords.filter(k => text.includes(k.toLowerCase()));
    if (matches.length >= 1) changeTypes.push(ct.id);
  });
  if (changeTypes.length === 0) changeTypes.push('competitor'); // 默认

  // 2. 影响判断
  // 重要程度
  let importance = '中';
  if (item.signal_level === 'Critical') importance = '高';
  else if (item.signal_level === 'Priority') importance = '高';
  else if (item.signal_level === 'Monitor') importance = '低';

  // 风险/机会
  let riskOpp = '中性';
  const riskWords = ['风险','危机','亏损','关闭','停产','裁员','decline','loss','shutdown','closure'];
  const oppWords = ['机会','增长','突破','创新','扩产','投资','growth','opportunity','expansion','breakthrough'];
  const riskCount = riskWords.filter(k => text.includes(k)).length;
  const oppCount = oppWords.filter(k => text.includes(k)).length;
  if (riskCount > oppCount + 2) riskOpp = '风险';
  else if (oppCount > riskCount + 2) riskOpp = '机会';
  else if (riskCount > 0 || oppCount > 0) riskOpp = '待观察';

  // 影响方向
  let direction = '中性';
  const positive = ['利好','增长','上涨','突破','扩产','创新','positive','growth','expansion'];
  const negative = ['利空','下跌','下滑','关停','亏损','事故','negative','decline','shutdown'];
  if (positive.some(k => text.includes(k))) direction = '利好';
  if (negative.some(k => text.includes(k))) direction = '利空';

  // 紧急程度
  let urgency = '定期观察';
  if (item.signal_level === 'Critical') urgency = '立即关注';
  else if (item.signal_level === 'Priority') urgency = '持续跟踪';

  // 建议动作
  let action = '仅归档';
  if (item.signal_level === 'Critical') action = '推送预警';
  else if (item.signal_level === 'Priority') action = '纳入周报';
  else if (item.signal_level === 'High') action = '形成专题';

  // AI置信度
  const summaryLen = (item.summary || '').length;
  let aiConfidence = '中';
  if (summaryLen > 200 && changeTypes.length >= 2) aiConfidence = '高';
  else if (summaryLen < 50) aiConfidence = '低';

  // 3. 实体识别
  const companies = ENTITY_DICT.companies.filter(c => originalText.includes(c));
  const products = ENTITY_DICT.products.filter(p => originalText.includes(p));
  const regions = ENTITY_DICT.regions.filter(r => originalText.includes(r));

  // 4. 来源类型
  let sourceType = '行业媒体';
  if (item.source_name) {
    if (/政府|生态|应急|工信|ECHA|European Commission/i.test(item.source_name)) sourceType = '政府公告';
    else if (/BASF|INEOS|SABIC|Covestro|Evonik|Arkema|Solvay|Press|官网/i.test(item.source_name)) sourceType = '企业官网';
    else if (/Reuters|Bloomberg|ICIS|Chemweek|C&EN|FT|Financial Times/i.test(item.source_name)) sourceType = '专业数据库';
  }

  // 5. 报告归属
  let reportAttr = '周报';
  if (item.signal_level === 'Critical') reportAttr = '预警报告';

  return {
    // 维度1: 变化类型
    change_types: changeTypes.map(id => ({
      id,
      label: TAG_SYSTEM.change_types.find(ct => ct.id === id)?.label || id
    })),
    // 维度2: 实体
    entities: { companies, products, regions },
    // 维度3: 影响判断
    impact: {
      importance,
      risk_opportunity: riskOpp,
      direction,
      urgency,
      suggested_action: action,
      manual_review_needed: item.signal_level === 'Critical' || item.signal_level === 'Priority' ? '是' : '否',
      ai_confidence: aiConfidence
    },
    // 维度4: 来源可信度
    source_credibility: {
      type: sourceType,
      name: item.source_name || '未知',
      authority: sourceType === '政府公告' ? '高' : sourceType === '企业官网' ? '高' : sourceType === '专业数据库' ? '中' : '低'
    },
    // 维度5: 报告预警
    report_alert: {
      attribution: reportAttr,
      alert_rules: detectAlertRules(text)
    },
    // 兼容老格式
    signal_level: item.signal_level || 'Monitor',
    signal_confidence: item.signal_confidence || 'Watch',
    topic_category: item.topic_category || 'General',
    all_tags: buildAllTags(changeTypes, item)
  };
}

function detectAlertRules(text) {
  const rules = [];
  if (/价格.*[涨跌升降变化]|price.*[up down change increase decrease]/i.test(text)) rules.push('价格异常');
  if (/政策.*[出台颁布实施]|法规.*[修订改]|regulation|policy|CBAM|REACH/i.test(text)) rules.push('政策变化');
  if (/扩产|expansion|new plant|新建.*产能/i.test(text)) rules.push('竞争对手扩产');
  if (/停产|断供|force majeure|供应中断|supply disruption/i.test(text)) rules.push('供应中断');
  if (/并购.*[亿百千万]|acquisition.*[bm]illion/i.test(text)) rules.push('重大并购');
  if (/爆炸|火灾|泄漏|事故|accident|fire|explosion/i.test(text)) rules.push('安全事故');
  if (/环保.*罚|排放.*超标|environmental.*fine/i.test(text)) rules.push('环保处罚');
  return rules.length > 0 ? rules : ['待观察'];
}

function buildAllTags(changeTypes, item) {
  const tags = [];
  changeTypes.forEach(ct => {
    const def = TAG_SYSTEM.change_types.find(d => d.id === ct);
    if (def) tags.push(def.label);
  });
  if (item.signal_level === 'Critical') tags.push('重大');
  if (item.signal_level === 'Priority') tags.push('优先');
  if (item.signal_confidence === 'Confirmed') tags.push('已确认');
  return [...new Set(tags)];
}

// 标签定义（给前端用）
function getTagDefinitions() {
  return TAG_SYSTEM;
}

module.exports = { autoTag, getTagDefinitions, TAG_SYSTEM, ENTITY_DICT };
