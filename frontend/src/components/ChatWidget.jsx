import React, { useState, useRef, useEffect } from 'react';

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'agent', text: '您好！我是 EU-CHEM INTEL 情报分析助手。您可以向我提问关于化工行业情报的任何问题，例如：\n\n• 最近有哪些重大的并购交易？\n• BASF 近期有什么动态？\n• 欧盟出台了哪些新法规？\n• 分析一下产能关停的趋势' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEnd = useRef(null);

  useEffect(() => {
    if (messagesEnd.current) messagesEnd.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();

      let reply = data.reply || '抱歉，暂时无法回答这个问题。';
      if (data.results && data.results.length > 0) {
        reply += '\n\n';
        data.results.forEach((r, i) => {
          const signal = r.signal_level === 'Critical' ? '🔴' : r.signal_level === 'Priority' ? '🟠' : r.signal_level === 'High' ? '🟡' : '🔵';
          reply += `${signal} **${r.title}**\n`;
          reply += `   ${r.summary.substring(0, 120)}...\n`;
          reply += `   📰 ${r.source} | 📅 ${r.date}\n\n`;
        });
      }

      setMessages(prev => [...prev, { role: 'agent', text: reply }]);
    } catch(e) {
      setMessages(prev => [...prev, { role: 'agent', text: '抱歉，请求失败：' + e.message }]);
    }
    setLoading(false);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* 浮动按钮 */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
          width: 56, height: 56, borderRadius: '50%',
          background: open ? '#c0392b' : '#1a3a5c',
          color: 'white', border: 'none', cursor: 'pointer',
          fontSize: 24, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s'
        }}
        title="情报分析助手"
      >
        {open ? '✕' : '💬'}
      </button>

      {/* 聊天窗口 */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 92, right: 24, zIndex: 9999,
          width: 400, height: 560, background: 'white',
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          border: '1px solid #e2e8f0'
        }}>
          {/* 头部 */}
          <div style={{
            background: 'linear-gradient(135deg, #1a3a5c, #2d5f8a)',
            color: 'white', padding: '14px 18px', fontWeight: 700,
            fontSize: 15, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span>🤖</span> EU-CHEM INTEL 情报助手
            <span style={{fontSize:11,opacity:0.7,marginLeft:'auto'}}>AI Agent</span>
          </div>

          {/* 消息区 */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '12px 16px',
            background: '#f8fafc'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                marginBottom: 12,
                display: 'flex', flexDirection: 'column',
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '90%', padding: '10px 14px', borderRadius: 12,
                  fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  background: msg.role === 'user' ? '#1a3a5c' : 'white',
                  color: msg.role === 'user' ? 'white' : '#1a2332',
                  border: msg.role === 'user' ? 'none' : '1px solid #e2e8f0',
                  borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                  borderBottomLeftRadius: msg.role === 'agent' ? 4 : 12
                }}>
                  {msg.role === 'agent' ? (
                    <ChatMessage text={msg.text} />
                  ) : (
                    msg.text
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{textAlign:'center',color:'#8896a6',fontSize:13,padding:8}}>
                🤔 正在分析情报数据...
              </div>
            )}
            <div ref={messagesEnd} />
          </div>

          {/* 输入区 */}
          <div style={{
            padding: '10px 14px', borderTop: '1px solid #e2e8f0',
            display: 'flex', gap: 8, background: 'white'
          }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，分析情报..."
              disabled={loading}
              style={{
                flex: 1, border: '1px solid #e2e8f0', borderRadius: 20,
                padding: '8px 16px', fontSize: 13, outline: 'none'
              }}
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              style={{
                background: '#1a3a5c', color: 'white', border: 'none',
                borderRadius: 20, padding: '8px 16px', cursor: 'pointer',
                fontWeight: 600, fontSize: 13, opacity: loading ? 0.5 : 1
              }}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 渲染聊天消息（支持Markdown格式）
function ChatMessage({ text }) {
  // 处理markdown: ### 标题, **粗体**, - 列表, 编号列表
  const parts = text.split(/(### .+|\*\*.+?\*\*|🔴|🟠|🟡|🔵)/g);
  const lines = text.split('\n');
  return (
    <div>
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} style={{height:6}}></div>;
        // 标题
        if (line.startsWith('### ')) {
          return <div key={i} style={{fontWeight:700,fontSize:14,color:'#1a3a5c',margin:'8px 0 4px',borderBottom:'1px solid #e2e8f0',paddingBottom:4}}>{line.replace('### ','')}</div>;
        }
        if (line.startsWith('## ')) {
          return <div key={i} style={{fontWeight:700,fontSize:15,color:'#1a3a5c',margin:'10px 0 6px'}}>{line.replace('## ','')}</div>;
        }
        // 粗体处理
        let content = line;
        const boldParts = content.split(/(\*\*.*?\*\*)/g);
        if (boldParts.length > 1) {
          return (
            <div key={i} style={{margin:2}}>
              {boldParts.map((p, j) => {
                if (p.startsWith('**') && p.endsWith('**')) {
                  return <strong key={j} style={{color:'#1a3a5c'}}>{p.replace(/\*\*/g,'')}</strong>;
                }
                return <span key={j}>{p}</span>;
              })}
            </div>
          );
        }
        // 列表项
        if (line.match(/^(\d+\.|[-•])\s/)) {
          return <div key={i} style={{paddingLeft:8,color:'#4a5568',fontSize:13}}>{line}</div>;
        }
        // 缩进行
        if (line.startsWith('   ') || line.startsWith('\t')) {
          return <div key={i} style={{paddingLeft:16,fontSize:12,color:'#8896a6'}}>{line.trim()}</div>;
        }
        return <div key={i} style={{margin:2}}>{line}</div>;
      })}
    </div>
  );
}
