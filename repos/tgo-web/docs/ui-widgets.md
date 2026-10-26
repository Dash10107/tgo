# Pelatis UI Widget 前端集成指南

本文档说明如何在前端解析和渲染 `tgo-ui-widget` 代码块。

## 概述

当 AI Agent 返回结构化数据（订单、产品、物流等）时，会使用特殊的 Markdown 代码块格式：

```markdown
```tgo-ui-widget
{
  "type": "order",
  "order_id": "ORD-2024-001",
  "status": "shipped",
  ...
}
` ` `
```

前端需要：
1. 检测这种特殊代码块
2. 解析 JSON 数据
3. 根据 `type` 字段渲染对应的 UI 组件

## TypeScript 类型定义

```typescript
// types/ui-widget.ts

/**
 * UI Widget 基础接口
 */
export interface UIWidgetBase {
  type: string;
  version?: string;
}

/**
 * 订单状态
 */
export type OrderStatus = 
  | 'pending' 
  | 'paid' 
  | 'processing' 
  | 'shipped' 
  | 'delivered' 
  | 'completed' 
  | 'cancelled' 
  | 'refunded';

/**
 * 订单商品项
 */
export interface OrderItem {
  name: string;
  sku?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  image?: {
    url: string;
    alt?: string;
  };
  attributes?: Record<string, string>;
}

/**
 * 订单 Widget
 */
export interface OrderWidget extends UIWidgetBase {
  type: 'order';
  order_id: string;
  status: OrderStatus;
  status_text?: string;
  created_at?: string;
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  items: OrderItem[];
  subtotal: number;
  shipping_fee?: number;
  discount?: number;
  total: number;
  currency?: string;
  shipping_address?: string;
  receiver_name?: string;
  receiver_phone?: string;
  tracking_number?: string;
  carrier?: string;
  actions?: ActionButton[];
}

/**
 * 物流状态
 */
export type LogisticsStatus = 
  | 'pending' 
  | 'picked_up' 
  | 'in_transit' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'exception' 
  | 'returned';

/**
 * 物流事件
 */
export interface LogisticsEvent {
  time: string;
  status?: LogisticsStatus;
  description: string;
  location?: string;
  operator?: string;
  phone?: string;
}

/**
 * 物流 Widget
 */
export interface LogisticsWidget extends UIWidgetBase {
  type: 'logistics';
  tracking_number: string;
  carrier: string;
  carrier_logo?: string;
  carrier_phone?: string;
  status: LogisticsStatus;
  status_text?: string;
  estimated_delivery?: string;
  receiver?: string;
  receiver_address?: string;
  receiver_phone?: string;
  courier_name?: string;
  courier_phone?: string;
  timeline: LogisticsEvent[];
  order_id?: string;
  actions?: ActionButton[];
}

/**
 * 产品 Widget
 */
export interface ProductWidget extends UIWidgetBase {
  type: 'product';
  product_id: string;
  name: string;
  description?: string;
  brand?: string;
  category?: string;
  thumbnail?: {
    url: string;
    alt?: string;
  };
  price: number;
  original_price?: number;
  currency?: string;
  discount_label?: string;
  in_stock?: boolean;
  stock_quantity?: number;
  specs?: Array<{ name: string; value: string }>;
  rating?: number;
  review_count?: number;
  tags?: string[];
  actions?: ActionButton[];
  url?: string;
}

/**
 * 产品列表 Widget
 */
export interface ProductListWidget extends UIWidgetBase {
  type: 'product_list';
  title?: string;
  subtitle?: string;
  products: Array<{
    product_id: string;
    name: string;
    price: number;
    thumbnail?: string;
    rating?: number;
  }>;
  total_count?: number;
  page?: number;
  page_size?: number;
  has_more?: boolean;
  actions?: ActionButton[];
}

/**
 * 价格对比 Widget
 */
export interface PriceComparisonWidget extends UIWidgetBase {
  type: 'price_comparison';
  title?: string;
  columns: string[];
  items: Array<Record<string, string>>;
  recommended_index?: number;
  recommendation_reason?: string;
  actions?: ActionButton[];
}

/**
 * Action URI 协议类型
 */
export type ActionProtocol = 
  | 'url'     // 外部链接跳转
  | 'msg'     // 发送消息到聊天
  | 'copy';   // 复制到剪贴板

/**
 * 按钮样式
 */
export type ButtonStyle = 'default' | 'primary' | 'danger' | 'link' | 'ghost';

/**
 * 操作按钮
 * 
 * action 字段使用 Action URI 格式: {protocol}://{content}
 */
export interface ActionButton {
  /** 按钮显示文本 */
  label: string;
  /** Action URI，格式: {protocol}://{content} */
  action: string;
  /** 按钮样式 */
  style?: ButtonStyle;
}

/**
 * 解析后的 Action URI
 */
export interface ParsedActionURI {
  protocol: ActionProtocol;
  content: string;
  raw: string;
  isValid: boolean;
}

/**
 * 所有 Widget 类型的联合
 */
export type UIWidget = 
  | OrderWidget 
  | LogisticsWidget 
  | ProductWidget 
  | ProductListWidget 
  | PriceComparisonWidget;

/**
 * 解析结果
 */
export interface ParsedUIBlock {
  type: string;
  data: UIWidget;
  raw: string;
  blockId: string;
  startIndex: number;
  endIndex: number;
}
```

## 解析器实现

```typescript
// utils/ui-widget-parser.ts

import type { ParsedUIBlock, UIWidget } from '../types/ui-widget';

/**
 * UI Widget 代码块正则表达式
 */
const UI_WIDGET_REGEX = /```tgo-ui-widget\s*\n([\s\S]*?)\n?```/gi;

/**
 * 生成唯一 ID
 */
function generateBlockId(): string {
  return `ui-block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 解析 Markdown 内容中的所有 UI Widget 块
 */
export function parseUIWidgets(content: string): ParsedUIBlock[] {
  const blocks: ParsedUIBlock[] = [];
  let match: RegExpExecArray | null;

  // Reset regex lastIndex
  UI_WIDGET_REGEX.lastIndex = 0;

  while ((match = UI_WIDGET_REGEX.exec(content)) !== null) {
    const rawJson = match[1].trim();
    
    try {
      const data = JSON.parse(rawJson) as UIWidget;
      
      if (!data.type) {
        console.warn('UI Widget missing type field:', rawJson);
        continue;
      }

      blocks.push({
        type: data.type,
        data,
        raw: rawJson,
        blockId: generateBlockId(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    } catch (e) {
      console.error('Failed to parse UI Widget JSON:', e);
    }
  }

  return blocks;
}

/**
 * 替换 Markdown 内容中的 UI Widget 块为占位符
 * 返回处理后的内容和块映射
 */
export function replaceUIWidgetsWithPlaceholders(
  content: string
): {
  content: string;
  blocks: Map<string, ParsedUIBlock>;
} {
  const blocks = new Map<string, ParsedUIBlock>();
  
  const processedContent = content.replace(
    UI_WIDGET_REGEX,
    (match, jsonContent) => {
      try {
        const data = JSON.parse(jsonContent.trim()) as UIWidget;
        const blockId = generateBlockId();
        
        blocks.set(blockId, {
          type: data.type,
          data,
          raw: jsonContent.trim(),
          blockId,
          startIndex: 0, // Will be recalculated if needed
          endIndex: 0,
        });

        // Return a placeholder that can be replaced with the rendered component
        return `<!--ui-widget:${blockId}-->`;
      } catch (e) {
        // If parsing fails, return original content
        return match;
      }
    }
  );

  return { content: processedContent, blocks };
}

/**
 * 检查内容是否包含 UI Widget
 */
export function hasUIWidgets(content: string): boolean {
  UI_WIDGET_REGEX.lastIndex = 0;
  return UI_WIDGET_REGEX.test(content);
}

/**
 * 流式解析器类 - 用于处理流式内容
 */
export class StreamingUIWidgetParser {
  private buffer = '';
  private inBlock = false;
  private blockContent = '';
  private blockStartIndex = 0;

  /**
   * 喂入一个 chunk
   * @returns 解析出的完整块（如果有）
   */
  feed(chunk: string): {
    nonWidgetContent: string;
    completedBlocks: ParsedUIBlock[];
  } {
    this.buffer += chunk;
    const completedBlocks: ParsedUIBlock[] = [];
    let nonWidgetContent = '';

    while (this.buffer.length > 0) {
      if (!this.inBlock) {
        // 查找块开始
        const startMatch = this.buffer.match(/```tgo-ui-widget\s*\n?/i);
        
        if (startMatch && startMatch.index !== undefined) {
          // 输出块开始前的内容
          nonWidgetContent += this.buffer.slice(0, startMatch.index);
          this.buffer = this.buffer.slice(startMatch.index + startMatch[0].length);
          this.inBlock = true;
          this.blockContent = '';
          this.blockStartIndex = startMatch.index;
        } else {
          // 检查是否可能是部分匹配
          const potentialStart = this.buffer.lastIndexOf('```');
          if (potentialStart >= 0 && potentialStart > this.buffer.length - 20) {
            nonWidgetContent += this.buffer.slice(0, potentialStart);
            this.buffer = this.buffer.slice(potentialStart);
          } else {
            nonWidgetContent += this.buffer;
            this.buffer = '';
          }
          break;
        }
      } else {
        // 在块内，查找结束
        const endIndex = this.buffer.indexOf('\n```');
        
        if (endIndex >= 0) {
          // 找到结束
          this.blockContent += this.buffer.slice(0, endIndex);
          this.buffer = this.buffer.slice(endIndex + 4); // Skip \n```
          this.inBlock = false;

          // 解析块
          try {
            const data = JSON.parse(this.blockContent.trim()) as UIWidget;
            completedBlocks.push({
              type: data.type,
              data,
              raw: this.blockContent.trim(),
              blockId: generateBlockId(),
              startIndex: this.blockStartIndex,
              endIndex: this.blockStartIndex + this.blockContent.length,
            });
          } catch (e) {
            console.error('Failed to parse streaming UI Widget:', e);
          }
        } else {
          // 还没找到结束，保持缓冲
          // 但要检查是否可能是部分结束标记
          if (this.buffer.length > 3) {
            this.blockContent += this.buffer.slice(0, -3);
            this.buffer = this.buffer.slice(-3);
          }
          break;
        }
      }
    }

    return { nonWidgetContent, completedBlocks };
  }

  /**
   * 刷新缓冲区
   */
  flush(): string {
    const remaining = this.buffer;
    this.buffer = '';
    this.inBlock = false;
    this.blockContent = '';
    return remaining;
  }

  /**
   * 是否在块内
   */
  get isInBlock(): boolean {
    return this.inBlock;
  }
}
```

## React 组件示例

```tsx
// components/UIWidgetRenderer.tsx

import React from 'react';
import type { UIWidget, OrderWidget, LogisticsWidget, ProductWidget } from '../types/ui-widget';

interface UIWidgetRendererProps {
  widget: UIWidget;
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
}

/**
 * UI Widget 渲染器 - 根据 type 分发到对应组件
 */
export const UIWidgetRenderer: React.FC<UIWidgetRendererProps> = ({ 
  widget, 
  onAction 
}) => {
  switch (widget.type) {
    case 'order':
      return <OrderCard data={widget} onAction={onAction} />;
    case 'logistics':
      return <LogisticsCard data={widget} onAction={onAction} />;
    case 'product':
      return <ProductCard data={widget} onAction={onAction} />;
    case 'product_list':
      return <ProductList data={widget} onAction={onAction} />;
    case 'price_comparison':
      return <PriceComparison data={widget} onAction={onAction} />;
    default:
      return <UnknownWidget type={(widget as any).type} />;
  }
};

/**
 * 订单卡片组件
 */
const OrderCard: React.FC<{
  data: OrderWidget;
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    paid: 'bg-blue-100 text-blue-800',
    shipped: 'bg-purple-100 text-purple-800',
    delivered: 'bg-green-100 text-green-800',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-gray-100 text-gray-800',
    refunded: 'bg-red-100 text-red-800',
  };

  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      {/* 头部 */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <span className="text-gray-500 text-sm">订单号</span>
          <p className="font-mono font-medium">{data.order_id}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-sm ${statusColors[data.status] || 'bg-gray-100'}`}>
          {data.status_text || data.status}
        </span>
      </div>

      {/* 商品列表 */}
      <div className="border-t border-b py-3 my-3">
        {data.items.map((item, index) => (
          <div key={index} className="flex justify-between items-center py-2">
            <div className="flex items-center gap-3">
              {item.image && (
                <img 
                  src={item.image.url} 
                  alt={item.image.alt || item.name}
                  className="w-12 h-12 object-cover rounded"
                />
              )}
              <div>
                <p className="font-medium">{item.name}</p>
                {item.attributes && (
                  <p className="text-sm text-gray-500">
                    {Object.entries(item.attributes).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p>×{item.quantity}</p>
              <p className="text-gray-600">¥{item.total_price.toFixed(2)}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 金额信息 */}
      <div className="space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">商品小计</span>
          <span>¥{data.subtotal.toFixed(2)}</span>
        </div>
        {data.shipping_fee !== undefined && data.shipping_fee > 0 && (
          <div className="flex justify-between">
            <span className="text-gray-500">运费</span>
            <span>¥{data.shipping_fee.toFixed(2)}</span>
          </div>
        )}
        {data.discount !== undefined && data.discount > 0 && (
          <div className="flex justify-between text-red-500">
            <span>优惠</span>
            <span>-¥{data.discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-medium text-lg pt-2 border-t">
          <span>合计</span>
          <span className="text-red-500">¥{data.total.toFixed(2)}</span>
        </div>
      </div>

      {/* 收货信息 */}
      {data.shipping_address && (
        <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
          <p className="font-medium">{data.receiver_name} {data.receiver_phone}</p>
          <p className="text-gray-600">{data.shipping_address}</p>
        </div>
      )}

      {/* 物流信息 */}
      {data.tracking_number && (
        <div className="mt-3 text-sm text-gray-600">
          <span>物流: {data.carrier} </span>
          <span className="font-mono">{data.tracking_number}</span>
        </div>
      )}

      {/* 操作按钮 */}
      {data.actions && data.actions.length > 0 && (
        <div className="mt-4 flex gap-2">
          {data.actions.map((action, index) => (
            <button
              key={index}
              onClick={() => onAction?.(action.action, action.payload)}
              className={`px-4 py-2 rounded text-sm ${
                action.style === 'primary' 
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : action.style === 'danger'
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'border hover:bg-gray-50'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 物流卡片组件
 */
const LogisticsCard: React.FC<{
  data: LogisticsWidget;
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  return (
    <div className="border rounded-lg p-4 shadow-sm bg-white">
      {/* 头部 */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-medium">{data.carrier}</h3>
          <p className="text-sm text-gray-500 font-mono">{data.tracking_number}</p>
        </div>
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
          {data.status_text || data.status}
        </span>
      </div>

      {/* 预计送达 */}
      {data.estimated_delivery && (
        <p className="text-sm text-green-600 mb-4">
          预计送达: {data.estimated_delivery}
        </p>
      )}

      {/* 配送员信息 */}
      {data.courier_name && (
        <div className="p-3 bg-gray-50 rounded mb-4">
          <p className="text-sm">
            配送员: {data.courier_name}
            {data.courier_phone && (
              <a href={`tel:${data.courier_phone}`} className="ml-2 text-blue-500">
                {data.courier_phone}
              </a>
            )}
          </p>
        </div>
      )}

      {/* 时间线 */}
      <div className="space-y-4">
        {data.timeline.map((event, index) => (
          <div key={index} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full ${
                index === 0 ? 'bg-blue-500' : 'bg-gray-300'
              }`} />
              {index < data.timeline.length - 1 && (
                <div className="w-0.5 h-full bg-gray-200 my-1" />
              )}
            </div>
            <div className="flex-1 pb-4">
              <p className="text-sm text-gray-500">{event.time}</p>
              <p className={index === 0 ? 'font-medium' : ''}>{event.description}</p>
              {event.location && (
                <p className="text-sm text-gray-500">{event.location}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 操作按钮 */}
      {data.actions && data.actions.length > 0 && (
        <div className="mt-4 flex gap-2">
          {data.actions.map((action, index) => (
            <button
              key={index}
              onClick={() => onAction?.(action.action, action.payload)}
              className={`px-4 py-2 rounded text-sm ${
                action.style === 'primary' 
                  ? 'bg-blue-500 text-white'
                  : 'border hover:bg-gray-50'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 产品卡片组件
 */
const ProductCard: React.FC<{
  data: ProductWidget;
  onAction?: (action: string, payload?: Record<string, unknown>) => void;
}> = ({ data, onAction }) => {
  return (
    <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
      {/* 图片 */}
      {data.thumbnail && (
        <img 
          src={data.thumbnail.url}
          alt={data.thumbnail.alt || data.name}
          className="w-full h-48 object-cover"
        />
      )}
      
      <div className="p-4">
        {/* 标签 */}
        {data.tags && data.tags.length > 0 && (
          <div className="flex gap-1 mb-2">
            {data.tags.slice(0, 3).map((tag, index) => (
              <span key={index} className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* 名称 */}
        <h3 className="font-medium text-lg">{data.name}</h3>
        
        {/* 品牌 */}
        {data.brand && (
          <p className="text-sm text-gray-500">{data.brand}</p>
        )}

        {/* 价格 */}
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl text-red-500 font-medium">
            ¥{data.price.toFixed(2)}
          </span>
          {data.original_price && data.original_price > data.price && (
            <span className="text-sm text-gray-400 line-through">
              ¥{data.original_price.toFixed(2)}
            </span>
          )}
          {data.discount_label && (
            <span className="text-xs text-red-500">{data.discount_label}</span>
          )}
        </div>

        {/* 评分 */}
        {data.rating !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-sm">
            <span className="text-yellow-500">★</span>
            <span>{data.rating.toFixed(1)}</span>
            {data.review_count !== undefined && (
              <span className="text-gray-400">({data.review_count}条评价)</span>
            )}
          </div>
        )}

        {/* 库存状态 */}
        <p className={`mt-2 text-sm ${data.in_stock ? 'text-green-600' : 'text-red-500'}`}>
          {data.in_stock ? (data.stock_status || '有货') : '暂时缺货'}
        </p>

        {/* 操作按钮 */}
        {data.actions && data.actions.length > 0 && (
          <div className="mt-4 flex gap-2">
            {data.actions.map((action, index) => (
              <button
                key={index}
                onClick={() => onAction?.(action.action, action.payload)}
                className={`flex-1 px-4 py-2 rounded text-sm ${
                  action.style === 'primary' 
                    ? 'bg-red-500 text-white'
                    : 'border hover:bg-gray-50'
                }`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// 其他组件实现类似...

const ProductList: React.FC<any> = ({ data, onAction }) => (
  <div className="space-y-4">
    {data.title && <h3 className="font-medium text-lg">{data.title}</h3>}
    <div className="grid grid-cols-2 gap-4">
      {data.products?.map((product: any, index: number) => (
        <div key={index} className="border rounded p-3">
          <p className="font-medium truncate">{product.name}</p>
          <p className="text-red-500">¥{product.price}</p>
        </div>
      ))}
    </div>
  </div>
);

const PriceComparison: React.FC<any> = ({ data }) => (
  <div className="overflow-x-auto">
    {data.title && <h3 className="font-medium text-lg mb-2">{data.title}</h3>}
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {data.columns?.map((col: string, i: number) => (
            <th key={i} className="border p-2 bg-gray-50">{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.items?.map((item: any, i: number) => (
          <tr key={i} className={i === data.recommended_index ? 'bg-green-50' : ''}>
            {data.columns?.map((col: string, j: number) => (
              <td key={j} className="border p-2">{item[col]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
    {data.recommendation_reason && (
      <p className="mt-2 text-sm text-green-600">💡 {data.recommendation_reason}</p>
    )}
  </div>
);

const UnknownWidget: React.FC<{ type: string }> = ({ type }) => (
  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
    <p className="text-yellow-800">未知的 UI 组件类型: {type}</p>
  </div>
);
```

## 在聊天组件中使用

```tsx
// components/ChatMessage.tsx

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { parseUIWidgets, replaceUIWidgetsWithPlaceholders } from '../utils/ui-widget-parser';
import { UIWidgetRenderer } from './UIWidgetRenderer';

interface ChatMessageProps {
  content: string;
  onWidgetAction?: (action: string, payload?: Record<string, unknown>) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ 
  content, 
  onWidgetAction 
}) => {
  // 解析内容
  const { processedContent, widgets } = useMemo(() => {
    const { content: processed, blocks } = replaceUIWidgetsWithPlaceholders(content);
    return { processedContent: processed, widgets: blocks };
  }, [content]);

  // 渲染组件
  const components = useMemo(() => ({
    // 自定义渲染器来处理 UI Widget 占位符
    p: ({ children, ...props }: any) => {
      const text = String(children);
      const match = text.match(/<!--ui-widget:([^>]+)-->/);
      
      if (match) {
        const blockId = match[1];
        const widget = widgets.get(blockId);
        
        if (widget) {
          return (
            <div className="my-4">
              <UIWidgetRenderer 
                widget={widget.data} 
                onAction={onWidgetAction}
              />
            </div>
          );
        }
      }
      
      return <p {...props}>{children}</p>;
    },
  }), [widgets, onWidgetAction]);

  return (
    <div className="chat-message prose prose-sm max-w-none">
      <ReactMarkdown components={components}>
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};
```

## SSE 流式处理

```typescript
// hooks/useStreamingChat.ts

import { useState, useCallback } from 'react';
import { StreamingUIWidgetParser } from '../utils/ui-widget-parser';
import type { ParsedUIBlock } from '../types/ui-widget';

export function useStreamingChat() {
  const [content, setContent] = useState('');
  const [widgets, setWidgets] = useState<ParsedUIBlock[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = useCallback(async (url: string, body: any) => {
    setIsStreaming(true);
    setContent('');
    setWidgets([]);

    const parser = new StreamingUIWidgetParser();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        
        // 解析 SSE 事件
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.content) {
              const { nonWidgetContent, completedBlocks } = parser.feed(data.content);
              
              setContent(prev => prev + nonWidgetContent);
              
              if (completedBlocks.length > 0) {
                setWidgets(prev => [...prev, ...completedBlocks]);
              }
            }
          }
        }
      }

      // 刷新解析器
      const remaining = parser.flush();
      if (remaining) {
        setContent(prev => prev + remaining);
      }

    } finally {
      setIsStreaming(false);
    }
  }, []);

  return {
    content,
    widgets,
    isStreaming,
    startStream,
  };
}
```

## Action URI 规范

ActionButton 的 `action` 字段使用标准化的 URI 格式，让前端能够明确解析和执行各类操作。

### URI 格式

```
{protocol}://{content}
```

### 支持的协议

| 协议 | 说明 | 示例 |
|------|------|------|
| `url://` | 打开外部链接 | `url://https://example.com/product/123` |
| `msg://` | 发送消息到聊天 | `msg://帮我查询这个订单的物流信息` |
| `copy://` | 复制到剪贴板 | `copy://SF1234567890` |

### Action URI 解析器

```typescript
// utils/action-uri.ts

export interface ParsedActionURI {
  protocol: string;
  content: string;
  raw: string;
  isValid: boolean;
}

const ACTION_URI_REGEX = /^([a-z]+):\/\/(.*)$/i;
const VALID_PROTOCOLS = ['url', 'msg', 'copy'];

/**
 * 解析 Action URI
 */
export function parseActionURI(uri: string): ParsedActionURI {
  const match = uri.match(ACTION_URI_REGEX);
  
  if (!match) {
    return { protocol: '', content: '', raw: uri, isValid: false };
  }

  const [, protocol, content] = match;

  return {
    protocol: protocol.toLowerCase(),
    content: content || '',
    raw: uri,
    isValid: VALID_PROTOCOLS.includes(protocol.toLowerCase()),
  };
}

/**
 * 构建 Action URI
 */
export function buildActionURI(protocol: string, content: string): string {
  return `${protocol}://${content}`;
}
```

### Action 处理器

```typescript
// hooks/useActionHandler.ts

import { useCallback } from 'react';
import { parseActionURI } from '../utils/action-uri';

interface ActionHandlerOptions {
  onMessage?: (message: string) => void;
}

export function useActionHandler(options: ActionHandlerOptions = {}) {
  const handleAction = useCallback(async (actionUri: string) => {
    const parsed = parseActionURI(actionUri);
    
    if (!parsed.isValid) {
      console.warn('Invalid action URI:', actionUri);
      return;
    }

    switch (parsed.protocol) {
      case 'url':
        // 打开外部链接
        window.open(parsed.content, '_blank', 'noopener,noreferrer');
        break;

      case 'msg':
        // 发送消息到聊天
        options.onMessage?.(decodeURIComponent(parsed.content));
        break;

      case 'copy':
        // 复制到剪贴板
        try {
          await navigator.clipboard.writeText(decodeURIComponent(parsed.content));
          // 可以显示复制成功的提示
          console.log('Copied:', parsed.content);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
        break;

      default:
        console.warn('Unknown protocol:', parsed.protocol);
    }
  }, [options]);

  return { handleAction };
}
```

### 在组件中使用

```tsx
// components/ActionButtons.tsx

import React from 'react';
import { useActionHandler } from '../hooks/useActionHandler';
import type { ActionButton } from '../types/ui-widget';

interface ActionButtonsProps {
  actions: ActionButton[];
  onMessage?: (message: string) => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({ 
  actions,
  onMessage,
}) => {
  const { handleAction } = useActionHandler({ onMessage });

  const getButtonClassName = (style?: string) => {
    const base = 'px-4 py-2 rounded text-sm font-medium transition-colors';
    switch (style) {
      case 'primary':
        return `${base} bg-blue-500 text-white hover:bg-blue-600`;
      case 'danger':
        return `${base} bg-red-500 text-white hover:bg-red-600`;
      case 'link':
        return `${base} text-blue-500 hover:underline`;
      case 'ghost':
        return `${base} text-gray-600 hover:bg-gray-100`;
      default:
        return `${base} border border-gray-300 hover:bg-gray-50`;
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <button
          key={index}
          onClick={() => handleAction(action.action)}
          className={getButtonClassName(action.style)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};
```

### Action URI 示例

```json
{
  "type": "order",
  "order_id": "ORD-2024-001",
  "actions": [
    {
      "label": "查看详情",
      "action": "url://https://example.com/order/ORD-2024-001",
      "style": "primary"
    },
    {
      "label": "联系客服",
      "action": "msg://我想咨询订单 ORD-2024-001 的问题",
      "style": "default"
    },
    {
      "label": "复制单号",
      "action": "copy://SF1234567890",
      "style": "link"
    }
  ]
}
```

## 注意事项

1. **类型安全**: 使用 TypeScript 类型定义确保数据结构正确
2. **错误处理**: JSON 解析可能失败，需要妥善处理
3. **性能**: 对于长内容，考虑使用虚拟滚动
4. **样式**: 示例使用 Tailwind CSS，可根据项目调整
5. **无障碍**: 确保组件有适当的 ARIA 属性
6. **Action URI 验证**: 前端应验证 Action URI 格式，对无效 URI 进行降级处理

## 模板类型速查

| type | 描述 | 主要字段 |
|------|------|----------|
| `order` | 订单详情 | order_id, status, items, total |
| `logistics` | 物流追踪 | tracking_number, carrier, timeline |
| `product` | 产品卡片 | product_id, name, price, thumbnail |
| `product_list` | 产品列表 | title, products, has_more |
| `price_comparison` | 价格对比 | columns, items, recommended_index |

## Action URI 协议速查

| 协议 | 用途 | 示例 |
|------|------|------|
| `url://` | 打开外部链接 | `url://https://example.com/product/123` |
| `msg://` | 发送聊天消息 | `msg://帮我查询这个订单的物流` |
| `copy://` | 复制文本 | `copy://SF1234567890` |
