# Pelatis Web

Pelatis Web 是一个现代化的 AI 智能客服前端应用，基于 React 19 构建，提供流畅的实时聊天体验和强大的 AI 智能交互能力。

## ✨ 核心特性

### 🤖 AI 智能客服
- **多 AI Agent 支持** - 支持配置多个 AI 智能体，可根据业务场景选择不同的 Agent
- **实时流式响应** - 基于 SSE (Server-Sent Events) 的流式消息传输，即时展示 AI 回复
- **上下文记忆** - 支持历史对话记录，AI 可基于上下文提供连贯的对话体验
- **多模型切换** - 支持接入多种 AI 大模型提供商（OpenAI、Anthropic 等）

### 💬 实时通讯
- **WuKongIM 集成** - 深度集成悟空 IM，提供稳定可靠的即时通讯能力
- **WebSocket 长连接** - 高效的双向通信，支持消息即时推送
- **消息状态同步** - 已读/未读状态、消息送达确认
- **多媒体支持** - 支持文本、图片、文件等多种消息类型

### 🎨 UI Widget 系统
- **结构化数据展示** - AI 返回的订单、商品、物流等信息以精美卡片形式呈现
- **丰富的组件类型** - 订单卡片、物流追踪、商品展示、价格对比等
- **Action URI 协议** - 标准化的交互协议，支持链接跳转、消息发送、内容复制
- **流式解析渲染** - 支持流式内容中 Widget 的实时解析和渲染

### 📚 知识库管理
- **文档知识库** - 支持上传文档构建知识库，增强 AI 回答准确性
- **QA 知识库** - 问答对形式的知识管理，快速扩展 AI 知识
- **网站知识库** - 抓取网站内容构建知识，保持信息同步更新

### 🔧 MCP 工具集成
- **工具商店** - 丰富的 MCP 工具库，按需启用
- **自定义工具** - 支持项目级别的工具配置和管理
- **Tool Schema 解析** - 自动解析 OpenAPI Schema，生成交互表单

### 🌐 平台集成
- **多渠道接入** - 支持 Web、微信公众号、小程序等多种渠道
- **统一管理** - 在同一后台管理所有接入渠道
- **访客管理** - 访客信息收集、会话分配、历史记录

### 🛠️ 开发体验
- **TypeScript 类型安全** - 全量 TypeScript 开发，类型提示完善
- **Zustand 状态管理** - 轻量高效的状态管理方案
- **Tailwind CSS** - 原子化 CSS，快速构建现代 UI
- **国际化支持** - i18next 多语言方案，支持中英文切换

## 🏗️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | React 19 |
| 语言 | TypeScript 5.9 |
| 构建工具 | Vite 7 |
| 状态管理 | Zustand |
| 样式 | Tailwind CSS 4 |
| 路由 | React Router 7 |
| 国际化 | i18next |
| IM 通讯 | WuKongIM SDK |
| Markdown | marked + highlight.js |
| 图标 | Lucide React |

## 📁 项目结构

```
src/
├── components/          # UI 组件
│   ├── ai/             # AI Agent 相关组件
│   ├── chat/           # 聊天功能组件
│   ├── knowledge/      # 知识库组件
│   ├── layout/         # 布局组件
│   ├── platforms/      # 平台管理组件
│   ├── settings/       # 设置页组件
│   ├── ui/             # 基础 UI 组件
│   └── visitor/        # 访客管理组件
├── hooks/              # 自定义 Hooks
├── pages/              # 页面组件
├── services/           # API 服务
├── stores/             # Zustand 状态管理
├── types/              # TypeScript 类型定义
├── utils/              # 工具函数
└── i18n/               # 国际化配置
```

## 🚀 快速开始

### 环境要求

- Node.js >= 18
- Yarn >= 1.22

### 安装依赖

```bash
yarn install
```

### 开发模式

```bash
yarn dev
```

### 生产构建

```bash
yarn build
```

### 代码检查

```bash
# 类型检查
yarn type-check

# ESLint 检查
yarn lint

# 完整检查（类型 + lint + 构建 + 验证）
yarn build:check
```

## 🐳 Docker 部署

```bash
# 构建镜像
docker build -t tgo-web .

# 运行容器
docker run -p 80:80 tgo-web
```

## 📖 相关文档

- [UI Widget 集成指南](./docs/ui-widgets.md) - 前端 UI Widget 解析与渲染
- [API 接口文档](./docs/api.json) - 后端 API 接口定义
- [环境配置说明](./docs/SETUP_STATUS_CHECK.md) - 项目环境配置指南

## 📄 License

Private - All rights reserved

