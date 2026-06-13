# EU-CHEM INTEL 数据库设计

## 存储方案

使用 **JSON 文件存储**（3 个文件，位于 `server/data/`）：

| 文件 | 用途 | 当前大小 |
|------|------|----------|
| `intel_items.json` | 情报条目 | ~589KB (257条) |
| `reports.json` | 研情报告 | ~278KB (14份) |
| `action_tracker.json` | 行动追踪 | ~3KB (12条) |

> `.gitignore` 中排除了 `data/` 目录，原始数据不入库。

---

## 数据模型

### 1. intel_items（情报条目）

```json
{
  "id": "uuid",                        // 唯一标识
  "title": "string",                   // 标题
  "summary": "string",                 // 摘要（200-500字）
  "source_name": "string",             // 来源名称
  "source_url": "string",              // 原文链接
  "published_date": "2026-06-13",      // 发布日期
  "scraped_date": "2026-06-13T...",   // 抓取时间
  "topic_category": "string",          // 主题（兼容老标签）
  "signal_level": "Critical|Priority|High|Monitor",
  "signal_confidence": "Confirmed|Strong Signal|Watch",
  "tags": ["string"],                  // 标签数组
  "raw_content": "string",             // 原始正文
  "metadata": {                        // 完整标签元数据（5维度）
    "change_types": [                  // 维度1: 变化类型
      { "id": "supply_capacity", "label": "供应、产能与装置运行" }
    ],
    "entities": {                      // 维度2: 实体识别
      "companies": ["BASF", "INEOS"],
      "products": ["MDI", "PE"],
      "regions": ["中国", "欧洲"]
    },
    "impact": {                        // 维度3: 影响判断
      "importance": "高|中|低",
      "risk_opportunity": "风险|机会|中性|待观察",
      "direction": "利好|利空|中性|不确定",
      "urgency": "立即关注|持续跟踪|定期观察",
      "suggested_action": "推送预警|纳入周报|形成专题|分派跟进|仅归档",
      "manual_review_needed": "是|否",
      "ai_confidence": "高|中|低"
    },
    "source_credibility": {            // 维度4: 来源可信度
      "type": "政府公告|企业官网|行业媒体|专业数据库|研报|内部文件",
      "name": "string",
      "authority": "高|中|低"
    },
    "report_alert": {                  // 维度5: 报告与预警
      "attribution": "日报|周报|月报|预警报告|专题报告",
      "alert_rules": ["价格异常", "政策变化", "供应中断"]
    }
  }
}
```

### 2. reports（研情分析报告）

```json
{
  "id": "uuid",
  "type": "daily|weekly",
  "title": "EU-CHEM INTEL · 每周研情分析报告 · 2026-06-13",
  "period_start": "2026-06-06",
  "period_end": "2026-06-13",
  "generated_date": "2026-06-13T...",
  "status": "published|draft",
  "content": {
    "aiGenerated": true,               // 是否 AI 生成
    "fullReport": "string"             // AI生成的完整 Markdown 报告
  }
}
```

### 3. action_tracker（行动追踪）

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "priority": "Critical|Priority|High|Monitor",
  "created_date": "2026-06-13",
  "status": "open|closed"
}
```

---

## 标签体系（5维度）

依据附件《标签.pdf》完整实现：

| 维度 | 说明 | 可选值 |
|------|------|--------|
| 1. 变化类型 | 资讯涉及的变化 | 政策法规/价格成本/供应产能/需求市场/企业动态/投资并购/技术应用/安全环保/贸易物流 |
| 2. 实体识别 | 抽取的化工实体 | 企业、产品、地区、产业链环节 |
| 3. 影响判断 | AI 自动评估 | 重要度/风险机会/方向/紧急度/建议动作/AI置信度 |
| 4. 来源可信度 | 来源评估 | 类型/名称/权威等级 |
| 5. 报告预警 | 报告归属 | 日报/周报/预警触发规则 |

---

## API 接口

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/intel` | GET | 情报列表（支持 tag/topic/search/page 筛选） |
| `/api/kpi` | GET | 4 项 KPI 指标 |
| `/api/tags` | GET | 标签定义 |
| `/api/status` | GET | 系统状态（抓取时间/运行时长） |
| `/api/reports` | GET | 报告列表 |
| `/api/reports/:id` | GET | 报告详情 |
| `/api/reports/generate` | POST | AI 生成报告 |
| `/api/reports/download?id=` | GET | 下载报告（HTML） |
| `/api/chat` | POST | AI Agent 对话 |
| `/api/scrape` | POST | 手动触发抓取 |
| `/api/action-tracker` | GET | 行动追踪列表 |
