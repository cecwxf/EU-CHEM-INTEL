import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import KPICards from './components/KPICards';
import TagFilter from './components/TagFilter';
import TopicFilter from './components/TopicFilter';
import IntelFeed from './components/IntelFeed';
import ReportViewer from './components/ReportViewer';
import ActionTracker from './components/ActionTracker';
import Footer from './components/Footer';

const API_BASE = '/api';

// 左侧功能栏
const NAV_ITEMS = [
  { id: 'agent', label: 'AI Agent 对话', icon: '🤖' },
  { id: 'intel', label: '情报流', icon: '📡' },
  { id: 'reports', label: '研情分析报告', icon: '📊' },
  { id: 'actions', label: '行动追踪', icon: '🎯' }
];

// ====== AI Agent 聊天面板 ======
function AgentPanel({ kpi }) {
  const [messages, setMessages] = useState([
    { role: 'agent', text: `您好！我是 EU-CHEM INTEL 的 AI 情报分析助手。\n\n当前数据库中共有 **${kpi.totalItems||0}** 条化工行业情报，其中 **${kpi.critical||0}** 条重大预警。\n\n您可以问我任何关于化工行业的问题，我会基于实时情报数据进行分析。` }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: messages.slice(-6).map(m => ({ role: m.role, content: m.text })) })
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'agent', text: data.reply || '抱歉，分析失败。' }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: 'agent', text: '请求失败：' + e.message }]);
    }
    setLoading(false);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 500 }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px', background: '#f8fafc', borderRadius: 8, marginBottom: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            marginBottom: 14,
            display: 'flex', flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            <div style={{
              maxWidth: '85%', padding: '12px 18px', borderRadius: 12,
              fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap',
              background: msg.role === 'user' ? '#1a3a5c' : 'white',
              color: msg.role === 'user' ? 'white' : '#1a2332',
              border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)'
            }}>
              {msg.role === 'agent' ? <Markdown text={msg.text} /> : msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ textAlign: 'center', color: '#8896a6', padding: 12, fontSize: 13 }}>
            🤔 AI 正在分析情报数据...
          </div>
        )}
        <div ref={messagesEnd} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="输入问题，AI 将基于情报数据进行分析..."
          disabled={loading}
          style={{
            flex: 1, border: '1px solid #d5dce6', borderRadius: 8,
            padding: '12px 16px', fontSize: 14, outline: 'none'
          }}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{
            background: loading ? '#8896a6' : '#1a3a5c', color: 'white', border: 'none',
            borderRadius: 8, padding: '12px 24px', cursor: 'pointer',
            fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap'
          }}>
          {loading ? '分析中...' : '发送'}
        </button>
      </div>
    </div>
  );
}

function Markdown({ text }) {
  const lines = text.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{ height: 6 }}></div>;
        if (line.startsWith('### ')) return <div key={i} style={{ fontWeight: 700, fontSize: 15, color: '#1a3a5c', margin: '10px 0 4px' }}>{line.replace('### ', '')}</div>;
        if (line.startsWith('## ')) return <div key={i} style={{ fontWeight: 700, fontSize: 16, color: '#1a3a5c', margin: '12px 0 6px' }}>{line.replace('## ', '')}</div>;
        if (line.startsWith('**') && line.includes('**')) {
          const parts = line.split(/(\*\*.*?\*\*)/g);
          return <div key={i} style={{ margin: 2 }}>{parts.map((p, j) => p.startsWith('**') ? <strong key={j} style={{ color: '#1a3a5c' }}>{p.replace(/\*\*/g, '')}</strong> : <span key={j}>{p}</span>)}</div>;
        }
        if (line.match(/^(\d+\.|[-•>])\s/)) return <div key={i} style={{ paddingLeft: 8, color: '#4a5568', fontSize: 13 }}>{line}</div>;
        return <div key={i} style={{ margin: 2 }}>{line}</div>;
      })}
    </div>
  );
}

// ====== 主应用 ======
export default function App() {
  const [activeNav, setActiveNav] = useState('intel');
  const [kpi, setKpi] = useState({ totalItems: 0, critical: 0, sitesClosed: 0, mtCapacity: 0 });
  const [intelData, setIntelData] = useState({ items: [], total: 0, page: 1, totalPages: 1 });
  const [reports, setReports] = useState([]);
  const [actions, setActions] = useState([]);
  const [selectedTag, setSelectedTag] = useState('All');
  const [selectedTopic, setSelectedTopic] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);
  const [status, setStatus] = useState(null);

  useEffect(() => { fetchKPI(); fetchIntel(); fetchActions(); fetchReports(); fetchStatus(); }, []);
  useEffect(() => { if (activeNav === 'intel') fetchIntel(); }, [selectedTag, selectedTopic, searchQuery]);
  useEffect(() => {
    const t = setInterval(() => { fetchKPI(); fetchStatus(); fetchActions(); }, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  async function fetchKPI() { try { setKpi(await (await fetch(`${API_BASE}/kpi`)).json()); } catch(e) {} }
  async function fetchIntel(page = 1) {
    if (firstLoad) setLoading(true);
    try {
      const p = new URLSearchParams({ page, limit: 50 });
      if (selectedTag !== 'All') p.set('tag', selectedTag);
      if (selectedTopic !== 'All') p.set('topic', selectedTopic);
      if (searchQuery) p.set('search', searchQuery);
      setIntelData(await (await fetch(`${API_BASE}/intel?${p}`)).json());
    } catch(e) {}
    setLoading(false);
    setFirstLoad(false);
  }
  async function fetchReports() { try { const d = await (await fetch(`${API_BASE}/reports`)).json(); setReports(Array.isArray(d) ? d : []); } catch(e) {} }
  async function fetchActions() { try { const d = await (await fetch(`${API_BASE}/action-tracker`)).json(); setActions(Array.isArray(d) ? d : []); } catch(e) {} }
  async function fetchStatus() { try { setStatus(await (await fetch(`${API_BASE}/status`)).json()); } catch(e) {} }

  const [refreshing, setRefreshing] = useState(false);

  async function triggerScrape() {
    setRefreshing(true);
    try {
      const d = await (await fetch(`${API_BASE}/scrape`, { method: 'POST' })).json();
      await fetchKPI();
      if (activeNav === 'intel') await fetchIntel();
      setRefreshing(false);
    } catch(e) { setRefreshing(false); }
  }

  async function generateReport(type) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/reports/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, period: 'all_data' })
      });
      const data = await res.json();
      if (data.success) { alert(`报告生成成功`); fetchReports(); setActiveNav('reports'); }
    } catch(e) { alert('生成失败：' + e.message); }
    setLoading(false);
  }

  return (
    <div className="app">
      <Header
        onScrape={triggerScrape}
        onGenerateReport={generateReport}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        loading={loading}
        refreshing={refreshing}
        status={status}
      />
      <div className="app-layout">
        {/* 左侧功能栏 */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-title">
            <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.45)', marginBottom: 4 }}>功能导航</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>Function Navigation</div>
          </div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`sidebar-nav-btn ${activeNav === item.id ? 'active' : ''}`}
            >
              <span style={{ fontSize: 18 }}>{item.icon}</span>
              <span>{item.label}</span>
              {item.id === 'agent' && <span style={{ marginLeft: 'auto', background: '#c9a84c', color: '#1a3a5c', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3 }}>AI</span>}
            </button>
          ))}

          <div className="sidebar-status">
            <div style={{ marginBottom: 4 }}>数据状态</div>
            <div>情报：{kpi.totalItems} 条</div>
            <div>预警：{kpi.critical} 条</div>
            <div style={{ marginTop: 4 }}>
              {status?.lastScrape ? new Date(status.lastScrape).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : '--'} 更新
            </div>
          </div>
        </nav>

        {/* 右侧主内容区 */}
        <main style={{ flex: 1, padding: '20px 24px', overflow: 'auto' }} className="main-area">
          <KPICards kpi={kpi} />

          {activeNav === 'agent' && <AgentPanel kpi={kpi} />}

          {activeNav === 'intel' && (
            <>
              <TagFilter selected={selectedTag} onSelect={setSelectedTag} />
              <TopicFilter selected={selectedTopic} onSelect={setSelectedTopic} />
              <IntelFeed data={intelData} loading={loading} refreshing={refreshing} isFirstLoad={firstLoad} onPageChange={p => fetchIntel(p)} />
            </>
          )}

          {activeNav === 'reports' && (
            <ReportViewer reports={reports} onGenerate={generateReport} loading={loading} />
          )}

          {activeNav === 'actions' && <ActionTracker actions={actions} />}
        </main>
      </div>
      <Footer />
    </div>
  );
}
