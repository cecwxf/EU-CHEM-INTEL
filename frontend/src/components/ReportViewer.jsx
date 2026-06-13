import React, { useState } from 'react';

export default function ReportViewer({ reports, onGenerate, loading }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [subTab, setSubTab] = useState('weekly'); // 日报 or 周报

  if (selectedReport) {
    return <ReportDetail report={selectedReport} onBack={() => setSelectedReport(null)} />;
  }

  const dailyReports = reports.filter(r => r.type === 'daily');
  const weeklyReports = reports.filter(r => r.type === 'weekly');
  const showReports = subTab === 'daily' ? dailyReports : weeklyReports;

  return (
    <div className="report-viewer">
      <div className="section-header">
        <h2>📊 研情分析报告</h2>
        <div style={{display:'flex',gap:8}}>
          <button className="btn" onClick={() => onGenerate('daily')} disabled={loading}
            style={{background: loading ? '#8896a6' : '#2c6faa',color:'white',border:'none'}}>
            🤖 AI 生成日报
          </button>
          <button className="btn btn-gold" onClick={() => onGenerate('weekly')} disabled={loading}>
            🤖 AI 生成周报
          </button>
        </div>
      </div>

      {/* 日报/周报子Tab */}
      <div style={{display:'flex',gap:0,marginBottom:16,background:'white',borderRadius:4,overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
        <button onClick={() => setSubTab('weekly')}
          style={{flex:1,padding:'10px',border:'none',cursor:'pointer',fontWeight:600,fontSize:14,
            background: subTab==='weekly'?'#1a3a5c':'white',color:subTab==='weekly'?'white':'#4a5568'}}>
          📊 周报 ({weeklyReports.length})
        </button>
        <button onClick={() => setSubTab('daily')}
          style={{flex:1,padding:'10px',border:'none',cursor:'pointer',fontWeight:600,fontSize:14,
            background: subTab==='daily'?'#2c6faa':'white',color:subTab==='daily'?'white':'#4a5568'}}>
          📝 日报 ({dailyReports.length})
        </button>
      </div>

      {showReports.length === 0 ? (
        <div className="report-empty">
          <p>暂无{subTab === 'daily' ? '日报' : '周报'}。点击上方「AI 生成{subTab === 'daily' ? '日报' : '周报'}」使用 DeepSeek 自动生成。</p>
        </div>
      ) : (
        <div className="report-list">
          {showReports.map(report => (
            <div key={report.id} className="report-card" onClick={() => setSelectedReport(report)}>
              <span className={`report-type-badge ${report.type}`}>
                {report.type === 'daily' ? '日报' : '周报'}
              </span>
              <span className="report-title">
                {report.period_start} ~ {report.period_end}
              </span>
              {report.content?.aiGenerated && <span style={{background:'#c9a84c',color:'#1a3a5c',fontSize:10,fontWeight:700,padding:'2px 6px',borderRadius:3}}>AI生成</span>}
              <span className="report-date">{report.generated_date?.split('T')[0]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ReportDetail({ report, onBack }) {
  const content = report.content || {};

  return (
    <div className="report-detail">
      <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
        <button className="btn btn-outline" onClick={onBack}>◀ 返回报告列表</button>
        <a href={`/api/reports/download?id=${report.id}`} download
          style={{display:'inline-flex',alignItems:'center',gap:6,padding:'8px 18px',background:'#1a3a5c',color:'white',border:'none',borderRadius:4,cursor:'pointer',fontSize:'0.85rem',fontWeight:600,textDecoration:'none'}}>
          📥 下载报告 (HTML)
        </a>
        {content.aiGenerated && <span style={{padding:'6px 12px',background:'#fef3c7',color:'#92400e',borderRadius:4,fontSize:13,fontWeight:600}}>🤖 本报告由 DeepSeek AI 自动生成</span>}
      </div>
      <h2>{report.type === 'daily' ? '每日研情分析报告' : '每周研情分析报告'}</h2>
      <div className="report-meta">
        <span>周期：{report.period_start} – {report.period_end}</span>
        <span>类型：{report.type === 'daily' ? '日报' : '周报'}</span>
        <span>状态：{report.status === 'published' ? '已发布' : report.status}</span>
      </div>

      {content.aiGenerated ? (
        <div className="report-section">
          <div style={{whiteSpace:'pre-wrap',lineHeight:1.9,fontSize:15}}>
            <MarkdownReport text={content.fullReport || '生成中...'} />
          </div>
        </div>
      ) : (
        <div>
          {['overview','developments','regulatory','companies','products','implications','actions'].map(secId => {
            const c = content[secId];
            if (!c) return null;
            const titles = { overview:'一、行业概览',developments:'二、重点动态',regulatory:'三、法规监测',companies:'四、企业追踪',products:'五、产品与技术',implications:'六、战略启示',actions:'七、行动建议' };
            return (
              <div key={secId} className="report-section">
                <h3>{titles[secId]}</h3>
                {secId === 'developments' && c.items ? (
                  <div>{c.items.map((item,i) => <div key={i} className="dev-item"><h4>{item.title}</h4><p>{item.summary}</p><div className="dev-meta"><span>📰 {item.source}</span>📅 {item.date}</div></div>)}</div>
                ) : secId === 'actions' && c.actions ? (
                  <div>{c.actions.map((a,i) => <div key={i} className="action-summary"><span className="action-dot" style={{backgroundColor:a.priority==='Critical'?'#c0392b':'#2c6faa'}}></span>{a.title}</div>)}</div>
                ) : (
                  <p>{c.text || '暂无内容'}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MarkdownReport({ text }) {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    if (!line.trim()) return <div key={i} style={{height:10}}></div>;
    if (line.startsWith('## 一')) return <h2 key={i} style={{fontSize:20,color:'#1a3a5c',borderBottom:'2px solid #c9a84c',paddingBottom:8,margin:'24px 0 12px'}}>{line.replace('## ','')}</h2>;
    if (line.startsWith('## 二')) return <h2 key={i} style={{fontSize:20,color:'#1a3a5c',borderBottom:'2px solid #c9a84c',paddingBottom:8,margin:'24px 0 12px'}}>{line.replace('## ','')}</h2>;
    if (line.startsWith('## 三')) return <h2 key={i} style={{fontSize:20,color:'#1a3a5c',borderBottom:'2px solid #c9a84c',paddingBottom:8,margin:'24px 0 12px'}}>{line.replace('## ','')}</h2>;
    if (line.startsWith('## 四')) return <h2 key={i} style={{fontSize:20,color:'#1a3a5c',borderBottom:'2px solid #c9a84c',paddingBottom:8,margin:'24px 0 12px'}}>{line.replace('## ','')}</h2>;
    if (line.startsWith('## 五')) return <h2 key={i} style={{fontSize:20,color:'#1a3a5c',borderBottom:'2px solid #c9a84c',paddingBottom:8,margin:'24px 0 12px'}}>{line.replace('## ','')}</h2>;
    if (line.startsWith('## 六')) return <h2 key={i} style={{fontSize:20,color:'#1a3a5c',borderBottom:'2px solid #c9a84c',paddingBottom:8,margin:'24px 0 12px'}}>{line.replace('## ','')}</h2>;
    if (line.startsWith('## 七')) return <h2 key={i} style={{fontSize:20,color:'#1a3a5c',borderBottom:'2px solid #c9a84c',paddingBottom:8,margin:'24px 0 12px'}}>{line.replace('## ','')}</h2>;
    if (line.startsWith('### ')) return <h3 key={i} style={{fontSize:17,color:'#1a3a5c',margin:'16px 0 8px',fontWeight:700}}>{line.replace('### ','')}</h3>;
    if (line.startsWith('**') && line.includes('**')) {
      const parts = line.split(/(\*\*.*?\*\*)/g);
      return <p key={i} style={{margin:'4px 0',lineHeight:1.8}}>{parts.map((p,j) => p.startsWith('**') ? <strong key={j}>{p.replace(/\*\*/g,'')}</strong> : <span key={j}>{p}</span>)}</p>;
    }
    if (line.match(/^(\d+\.|[-•>])\s/)) return <p key={i} style={{margin:'4px 0 4px 16px',lineHeight:1.8}}>{line}</p>;
    return <p key={i} style={{margin:'4px 0',lineHeight:1.8}}>{line}</p>;
  });
}
