import React from 'react';

// 来自标签.pdf：信号等级 = 重要程度 + 紧急程度
const SIGNAL_GROUPS = [
  {
    label: '按重要程度',
    tags: [
      { id: '高', label: '🔴 高', group: 'importance' },
      { id: '中', label: '🟡 中', group: 'importance' },
      { id: '低', label: '🔵 低', group: 'importance' },
    ]
  },
  {
    label: '按紧急程度',
    tags: [
      { id: '立即关注', label: '⚠️ 立即关注', group: 'urgency' },
      { id: '持续跟踪', label: '📌 持续跟踪', group: 'urgency' },
      { id: '定期观察', label: '👁 定期观察', group: 'urgency' },
    ]
  },
  {
    label: '按风险/机会',
    tags: [
      { id: '风险', label: '📉 风险', group: 'risk_opportunity' },
      { id: '机会', label: '📈 机会', group: 'risk_opportunity' },
      { id: '中性', label: '➡️ 中性', group: 'risk_opportunity' },
    ]
  }
];

export default function TagFilter({ selected, onSelect }) {
  return (
    <div>
      {SIGNAL_GROUPS.map(group => (
        <div key={group.label} className="filter-row">
          <span className="filter-label">{group.label}</span>
          <button
            className={`filter-tag ${selected === `__all_${group.tags[0].group}__` ? 'active' : ''}`}
            onClick={() => onSelect(`__all_${group.tags[0].group}__`)}
            style={{background:'transparent',color:'#4a5568',fontWeight:400}}
          >
            全部
          </button>
          {group.tags.map(tag => (
            <button
              key={tag.id}
              className={`filter-tag ${selected === tag.id ? 'active' : ''}`}
              onClick={() => onSelect(tag.id)}
            >
              {tag.label}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
