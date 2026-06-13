import React from 'react';

const SIGNAL_COLORS = {
  Critical: '#c0392b', Priority: '#d4782f', High: '#b8860b', Monitor: '#2c6faa'
};
const SIGNAL_LABELS = {
  Critical: '重大', Priority: '优先', High: '重要', Monitor: '监控'
};
const CONFIDENCE_LABELS = {
  Confirmed: '已确认', 'Strong Signal': '强信号', Watch: '观察中'
};
const TOPIC_LABELS = {
  'M&A': '并购整合', 'Capacity': '产能变化', 'Policy': '政策法规',
  'Cost Structure': '成本结构', 'Technology': '技术发展',
  'Market': '市场动态', 'Reality vs Narrative Analysis': '深度分析',
  'General': '综合'
};

function IntelCard({ item }) {
  const [expanded, setExpanded] = React.useState(true);
  const cardClass = item.signal_level === 'Critical' ? 'critical' :
    item.signal_level === 'Priority' ? 'priority' :
    item.signal_level === 'High' ? 'high' : '';

  return (
    <div className={`intel-card ${cardClass}`}>
      <div className="intel-header">
        <span className="signal-badge" style={{ backgroundColor: SIGNAL_COLORS[item.signal_level] || '#8896a6' }}>
          {SIGNAL_LABELS[item.signal_level] || item.signal_level}
        </span>
        <span className="confidence-badge" style={{ borderColor: '#8896a6', color: '#4a5568' }}>
          {CONFIDENCE_LABELS[item.signal_confidence] || item.signal_confidence}
        </span>
        <span className="topic-cat">
          {TOPIC_LABELS[item.topic_category] || item.topic_category}
        </span>
        <span className="intel-date">{item.published_date}</span>
      </div>
      <h3 className="intel-title" onClick={() => setExpanded(!expanded)}>
        {item.title}
        <span style={{fontSize:'0.7rem',color:'#8896a6',marginLeft:6}}>{expanded ? '收起 ▴' : '展开 ▾'}</span>
      </h3>
      {expanded && (
        <div className="intel-body">
          <p className="intel-summary">{item.summary || '暂无详细内容'}</p>

          {/* 变化类型标签 */}
          {item.tags && item.tags.length > 0 && (
            <div className="intel-tags" style={{marginBottom:8}}>
              {item.tags.map((tag, i) => (
                <span key={i} className="tag-chip">{tag}</span>
              ))}
            </div>
          )}

          {/* 来源与可信度 */}
          <div className="intel-meta">
            <span>📰 {item.source_name}</span>
            <span title={item.tags?.includes('政府公告')?'权威来源':item.tags?.includes('企业官网')?'官方来源':'普通来源'}>
              {item.metadata?.source_credibility?.type && `🏷️ ${item.metadata?.source_credibility?.type}`}
            </span>
            {item.source_url && (
              <a href={item.source_url} target="_blank" rel="noopener noreferrer">
                🔗 查看原文
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function IntelFeed({ data, loading, onPageChange, isFirstLoad, refreshing }) {
  const { items, total, page, totalPages } = data;

  // 首次无数据→全屏加载
  if (loading && isFirstLoad && (!items || items.length === 0)) {
    return (
      <div className="loading">
        <div style={{fontSize:32,marginBottom:12}}>📡</div>
        <div>正在加载情报数据...</div>
      </div>
    );
  }
  if (!items || items.length === 0) {
    return <div className="empty">未找到匹配的情报。请调整筛选条件或刷新数据。</div>;
  }

  return (
    <div className="intel-feed">
      <div className="feed-header">
        <span>共 {total} 条情报</span>
        {refreshing && <span style={{color:'#c9a84c',fontSize:12,fontWeight:600}}> 🔄 正在刷新实时数据...</span>}
      </div>
      {items.map(item => (
        <IntelCard key={item.id} item={item} />
      ))}
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => onPageChange(page - 1)}>◀ 上一页</button>
          <span>第 {page} / {totalPages} 页</span>
          <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>下一页 ▶</button>
        </div>
      )}
    </div>
  );
}
