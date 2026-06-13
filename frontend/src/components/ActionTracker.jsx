import React from 'react';

const PRIORITY_LABELS = { Critical: '重大', Priority: '优先', High: '重要', Monitor: '监控' };
const PRIORITY_COLORS = { Critical: '#c0392b', Priority: '#d4782f', High: '#b8860b', Monitor: '#2c6faa' };

export default function ActionTracker({ actions }) {
  if (!actions || actions.length === 0) {
    return (
      <div className="action-tracker">
        <h2>🎯 行动追踪</h2>
        <div className="empty">暂无待办事项。生成报告后将自动填充追踪条目。</div>
      </div>
    );
  }

  return (
    <div className="action-tracker">
      <h2>🎯 行动追踪</h2>
      <p className="action-desc">需要持续关注的优先监测信号</p>
      <div className="action-list">
        {actions.map(action => (
          <div key={action.id} className="action-card">
            <span className="action-priority" style={{ backgroundColor: PRIORITY_COLORS[action.priority] || '#8896a6' }}>
              {PRIORITY_LABELS[action.priority] || action.priority}
            </span>
            <div>
              <h4>{action.title}</h4>
              {action.description && <p>{action.description}</p>}
              <span className="date">{action.created_date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
