# EU-CHEM INTEL · 欧洲化工行业智能情报系统

基于 AI 的实时化工情报抓取、多维度标签标注、研情分析报告自动生成平台。

## 功能

- **多源实时抓取** — Google News RSS + 行业门户 + 政府公告 + 企业官网（20+数据源）
- **5维度标签体系** — 变化类型 / 实体识别 / 影响判断 / 来源可信度 / 报告预警
- **AI Agent 对话** — DeepSeek 驱动，基于实时情报数据的智能问答
- **AI 研情报告** — 日报/周报自动生成，7章节固定格式
- **化工行业风格** — 苯环分子背景、工业安全色系
- **移动端适配** — 响应式布局，手机/平板/桌面

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 + Vite 5 |
| 后端 | Node.js (HTTP Server) |
| 数据库 | SQLite (sql.js) |
| AI | DeepSeek API |
| 爬虫 | axios + cheerio + Google News RSS |

## 目录结构

```
eu-chem-intel/
├── server/                      # 后端
│   ├── quick.js                 # 主服务 (API + 静态文件)
│   ├── package.json
│   └── services/
│       ├── database.js          # SQLite 数据库
│       ├── scraper.js           # 多源爬虫
│       ├── tagger.js            # 5维标签引擎
│       ├── report-generator.js  # AI 报告生成
│       └── seed-data.js         # 种子数据
├── frontend/                    # 前端
│   ├── src/
│   │   ├── App.jsx              # 主应用 (侧边栏布局)
│   │   ├── components/          # React 组件
│   │   └── styles/              # CSS
│   ├── package.json
│   └── vite.config.js
├── docs/SCHEMA.md               # 数据库设计文档
└── README.md
```

## 快速部署

### 前提

- Node.js ≥ 18
- DeepSeek API Key（用于 AI 对话和报告生成）

### 1. 克隆项目

```bash
git clone https://github.com/cecwxf/EU-CHEM-INTEL.git
cd EU-CHEM-INTEL
```

### 2. 安装依赖

```bash
cd server && npm install
cd ../frontend && npm install
cd ..
```

### 3. 配置 API Key

在 `server/` 目录下创建 `apiconfig.json`：

```json
{
  "DEEPSEEK_API_KEY": "sk-your-deepseek-api-key"
}
```

> 如果不配置，系统使用内置分析引擎，AI 对话和报告生成功能不可用。

### 4. 构建前端

```bash
cd frontend
npx vite build
cd ..
```

### 5. 启动服务

```bash
cd server
node quick.js
```

服务启动在 `http://localhost:5173`。

### 6. 生产部署 (PM2)

```bash
npm install -g pm2
cd server
pm2 start quick.js --name eu-chem-intel
pm2 save
```

### 7. Nginx 反向代理（可选）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 数据库

使用 **SQLite** (sql.js)，单文件 `server/data/eu_chem_intel.db`。

首次启动自动创建表并填充种子数据（18条化工行业情报）。详细表结构见 `docs/SCHEMA.md`。

### 数据库迁移

如果已有 JSON 数据文件（`server/data/*.json`），系统首次启动会自动迁移到 SQLite。也可手动迁移：

```bash
cd server
node -e "
const db = require('./services/database');
db.initialize().then(() => console.log('Migration done'));
"
```

## API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/intel?tag=&topic=&search=&page=` | GET | 情报列表 |
| `/api/kpi` | GET | KPI 指标 |
| `/api/tags` | GET | 标签定义 |
| `/api/status` | GET | 系统状态 |
| `/api/reports?type=daily\|weekly` | GET | 报告列表 |
| `/api/reports/generate` | POST | AI 生成报告 `{type:"weekly"}` |
| `/api/reports/download?id=` | GET | 下载报告 HTML |
| `/api/chat` | POST | AI 对话 `{message:"..."}` |
| `/api/scrape` | POST | 手动触发抓取 |
| `/api/action-tracker` | GET | 行动追踪 |

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 服务端口 | 5173 |

## License

MIT
