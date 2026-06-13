import React from 'react';

const cards = [
  { key: 'totalItems', label: '情报总数', desc: '全部情报条目' },
  { key: 'critical', label: '重大预警', desc: '需立即关注', color: '#c0392b', className: 'critical' },
  { key: 'sitesClosed', label: '涉及关停', desc: '停产/关闭/检修', color: '#d4782f', className: 'sites' },
  { key: 'mtCapacity', label: '产能影响(MT)', desc: '受影响的百万吨产能', color: '#5b4a9e', className: 'capacity' }
];

export default function KPICards({ kpi }) {
  return (
    <div className="kpi-row">
      {cards.map(card => (
        <div key={card.key} className={`kpi-card ${card.className || ''}`}>
          <div className="kpi-value">{kpi[card.key] ?? 0}</div>
          <div className="kpi-label">{card.label}</div>
          <div style={{fontSize:'0.68rem',color:'#8896a6',marginTop:2}}>{card.desc}</div>
        </div>
      ))}
    </div>
  );
}
