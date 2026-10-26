---
id: intro
title: Introduction
sidebar_position: 1
---

# Introduction to Pelatis

**Pelatis** is an open-source AI agent customer service platform. We are dedicated to helping enterprises build smarter and more efficient customer service systems through the **Multi-Agents** collaboration model.

Unlike traditional chatbots, Pelatis emphasizes collaboration between agents. You can assemble a team composed of agents with different capabilities to collaboratively handle complex customer inquiries, after-sales support, and business lead generation.

## Key Highlights

- 🤖 **Multi-Agent Orchestration**: Flexibly create and orchestrate multiple AI agents, allowing them to perform their respective duties and work together.
- 📚 **Knowledge Base Enhancement (RAG)**: Built-in high-performance RAG system supporting PDF, Docx uploads, web crawling, etc., making AI understand your business.
- 🛠️ **MCP Tool Extension**: Supports Model Context Protocol, easily connecting to external APIs, databases, and business tools.
- 🌐 **Omnichannel Access**: One system supporting Web, API, WeChat, Lark, DingTalk, and other mainstream channels.
- 🤝 **Human-AI Collaboration**: Agents handle repetitive inquiries and seamlessly transfer to human agents at critical moments to improve customer satisfaction.

## Technical Architecture

Pelatis adopts a modern microservices architecture to ensure system stability and scalability.

![Pelatis Architecture](/img/architecture_en.svg)

| Service | Description |
| :--- | :--- |
| **tgo-api** | Core business service, handling logic for accounts, conversations, permissions, etc. |
| **tgo-ai** | Agent orchestration center, responsible for LLM calls and agent scheduling. |
| **tgo-rag** | Knowledge base retrieval service, handling document vectorization and semantic search. |
| **tgo-platform** | External platform integration service, responsible for connecting to DingTalk, Lark, WeChat Work, etc. |
| **tgo-web** | Customer service management console, a modern dashboard built with React. |
| **tgo-widget** | Lightweight visitor-side component, can be integrated into any webpage in minutes. |
| **WuKongIM** | High-performance real-time messaging system, ensuring real-time message delivery. |

## System Requirements

Before deploying Pelatis, please ensure your environment meets the following requirements:

| Item | Minimum | Recommended |
| :--- | :--- | :--- |
| **CPU** | 2 Core | 4 Core+ |
| **Memory** | 8 GiB | 16 GiB+ |
| **OS** | Linux / macOS / WSL2 | Ubuntu 22.04 LTS |
| **Environment** | Docker 20.10+ | Docker Compose v2.0+ |

## Next Steps

- [🚀 Quick Start](/en/quick-start/deploy) - Complete system deployment in 5 minutes
- [🔧 Environment Variables](/en/config/env-vars) - Deeply customize your Pelatis
- [👨‍💻 Developer Guide](/en/development/source-deploy) - Learn how to perform secondary development
