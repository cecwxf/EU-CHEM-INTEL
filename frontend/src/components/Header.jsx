import React from 'react';

export default function Header({ onScrape, onGenerateReport, searchQuery, onSearchChange, loading, refreshing, status }) {
  const today = new Date().toISOString().split('T')[0];
  const lastUpdate = status?.lastScrape ? new Date(status.lastScrape).toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'}) : '--';
  return (
    <header className="header">
      <div className="header-top">
        <div className="brand">
          <div className="brand-logo">⚗</div>
          <div className="brand-text">
            <h1>EU-CHEM INTEL · 欧洲化工情报系统</h1>
            <span className="subtitle">European Chemical Industry Intelligence</span>
          </div>
        </div>
        <div className="header-info">
          <span className="date">{today}</span>
          <span className="label">中国总部 · 战略情报分发</span>
          <span className="label" style={{color:'#c9a84c'}}>
            🟢 实时监控中 · 上次更新 {lastUpdate} · 每2小时自动抓取
          </span>
        </div>
      </div>
      <div className="header-controls">
        <div className="search-box">
          <span>🔍</span>
          <input
            type="text"
            placeholder="搜索情报、公司、主题..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
          />
        </div>
        <div className="header-btns">
          <button className="btn btn-outline" onClick={onScrape} disabled={refreshing}>
            🔄 {refreshing ? '抓取中...' : '刷新数据'}
          </button>
          <button className="btn btn-white" onClick={() => onGenerateReport('daily')} disabled={loading}>
            📝 生成日报
          </button>
          <button className="btn btn-gold" onClick={() => onGenerateReport('weekly')} disabled={loading}>
            📊 生成周报
          </button>
        </div>
      </div>
    </header>
  );
}
