# EU-CHEM INTEL 数据库设计

## 存储方案

使用 **SQLite** 数据库（sql.js 纯 JS 实现，无需编译），单文件存储：

| 文件 | 用途 | 大小 |
|------|------|------|
| `server/data/eu_chem_intel.db` | SQLite 数据库 | ~760KB |

包含 3 张表。

---

## 表结构

### 1. intel_items（情报条目）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 标题 |
| summary | TEXT | 摘要 (200-500字) |
| source_name | TEXT | 来源名称 |
| source_url | TEXT | 原文链接 |
| published_date | TEXT | 发布日期 |
| scraped_date | TEXT | 抓取时间 |
| topic_category | TEXT | 主题分类 |
| signal_level | TEXT | Critical/Priority/High/Monitor |
| signal_confidence | TEXT | Confirmed/Strong Signal/Watch |
| tags | TEXT(JSON) | 标签数组 |
| raw_content | TEXT | 原始正文 |
| metadata | TEXT(JSON) | 完整5维度标签元数据 |

metadata JSON 结构详见 `server/services/tagger.js` 中的 TAG_SYSTEM 定义。

### 2. reports（研情报告）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| type | TEXT | daily/weekly |
| title | TEXT | 报告标题 |
| period_start | TEXT | 起始日期 |
| period_end | TEXT | 结束日期 |
| content | TEXT(JSON) | `{aiGenerated:bool, fullReport:string}` |
| generated_date | TEXT | 生成时间 |
| status | TEXT | published/draft |

### 3. action_tracker（行动追踪）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT PK | UUID |
| title | TEXT | 行动标题 |
| description | TEXT | 描述 |
| priority | TEXT | Critical/Priority/High/Monitor |
| created_date | TEXT | 创建日期 |
| status | TEXT | open/closed |

---

## API 接口 (12个)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/intel` | GET | 情报列表 (支持 tag/topic/search/page) |
| `/api/intel/:id/tags` | PUT | 更新标签 |
| `/api/kpi` | GET | 4项KPI指标 |
| `/api/tags` | GET | 标签定义 |
| `/api/status` | GET | 系统状态 |
| `/api/reports` | GET | 报告列表 |
| `/api/reports/:id` | GET | 报告详情 |
| `/api/reports/generate` | POST | AI生成报告 (DeepSeek) |
| `/api/reports/download?id=` | GET | 下载报告HTML |
| `/api/chat` | POST | AI Agent对话 (DeepSeek) |
| `/api/scrape` | POST | 手动触发抓取 |
| `/api/action-tracker` | GET | 行动追踪列表 |

## 架构

```
浏览器 → React SPA → HTTP → Node.js (quick.js)
                              ├── SQLite (sql.js)
                              ├── Scraper (14源 + 6 RSS)
                              ├── Tagger (5维标签引擎)
                              └── DeepSeek API
```
