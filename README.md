# web-frontend �?用户界面

Vue 3 + TypeScript + Vite 构建�?SPA 前端�?

- 端口：`5173`
- 开发服务器：`http://localhost:5173`

## 目录结构

```
web-frontend/
├── src/
�?  ├── components/        # 通用组件 (ChatView, MainLayout, MessageBubble, etc.)
�?  ├── pages/             # 页面级组�?(SceneManagementPage, AgentManagementPage, etc.)
�?  ├── stores/            # Pinia: auth, chat, alert, i18n
�?  ├── router/            # Vue Router（hash 模式，含权限守卫�?
�?  ├── api/               # HTTP + SSE 客户�?
�?  ├── toolCallRegistry.ts # Tool 组件全局注册�?(window.__MH_TOOL_REGISTRY__)
�?  ├── toolComponentLoader.ts # 动态加�?UMD 组件 bundle
�?  ├── toolComponents.config.ts # 组件源配置（multi-source�?
�?  ├── toolContext.ts     # Tool 渲染上下�?(provide/inject key)
�?  ├── config.ts          # 应用配置 (appConfig)
�?  ├── styles/            # 管理后台样式
�?  └── types/             # TypeScript 类型定义
├── component/             # 独立 UMD 工具组件�?(built-in)
└── extra/                 # 独立 UMD 工具组件�?(extra)
```

## 路由

| 路径 | 名称 | 说明 |
|------|------|------|
| `/` | chat | 主聊天界�?(MainLayout) |
| `/components-demo` | components-demo | 组件调试页，无需认证 |
| `/manage/scenes` | scenes | 场景管理 |
| `/manage/agents` | agents | Agent 管理 |
| `/manage/tools` | tools | Tool 管理 |

## 启动

```bash
npm install
npm run dev
```

## 构建

```bash
npx vue-tsc -b              # 类型检�?
npx vite build              # 生产构建
```

### 组件库构�?

```bash
cd component && npx vite build
cd extra && npx vite build
```

组件 bundle 会被复制�?`public/component/` 供动态加载�?

### 纯前端开发（无需后端�?

```bash
bash scripts/dev-frontend.sh           # 构建组件 + 启动 dev server
bash scripts/dev-frontend.sh --watch   # 监听组件变更自动重构�?
```

访问 `http://localhost:5173/components-demo` 即可调试组件�?

## 后端依赖

通过 HTTP/SSE �?[mh-gateway](../packages/mh-gateway/) 通信（端�?`8005`）�?

`mh-gateway` �?`dev_mode` 下内置了 SSO 登录、场�?Agent/Tool 注册与发现、聊�?SSE 流、会话管理、M2M 鉴权等能力；企业部署时通过�?`UserAuthProvider` / `MetadataManager` / `ConfigProvider` / `M2MAuthProvider` 等适配器对接自有系统�?

所�?API 端点�?`mh-gateway` �?OpenAPI 文档（`http://localhost:8005/docs`）定义，前端的端点路径通过 [`src/config.ts`](src/config.ts) 中的 `appConfig` 注入（构建期�?Vite 替换）�?
