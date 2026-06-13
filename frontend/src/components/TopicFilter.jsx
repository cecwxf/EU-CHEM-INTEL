import React from 'react';

// 来自标签.pdf：主题分类 = 9种变化类型
const TOPICS = [
  { id: 'All', label: '全部' },
  { id: 'policy', label: '政策法规' },
  { id: 'price_cost', label: '价格成本' },
  { id: 'supply_capacity', label: '供应产能' },
  { id: 'demand_market', label: '需求市场' },
  { id: 'competitor', label: '企业动态' },
  { id: 'ma_investment', label: '投资并购' },
  { id: 'technology', label: '技术应用' },
  { id: 'safety_incident', label: '安全环保' },
  { id: 'trade_logistics', label: '贸易物流' }
];

export default function TopicFilter({ selected, onSelect }) {
  return (
    <div className="topic-row">
      <span className="filter-label">变化类型</span>
      {TOPICS.map(t => (
        <button
          key={t.id}
          className={`topic-btn ${selected === t.id ? 'active' : ''}`}
          onClick={() => onSelect(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
