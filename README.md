# web-frontend — 用户界面

Vue 3 + TypeScript + Vite 构建的 SPA 前端。

- 端口：`5173`
- 开发服务器：`http://localhost:5173`

## 目录结构

```
web-frontend/
├── src/
│   ├── components/        # 通用组件 (ChatView, MainLayout, MessageBubble, etc.)
│   ├── pages/             # 页面级组件 (SceneManagementPage, AgentManagementPage, etc.)
│   ├── stores/            # Pinia: auth, chat, alert, eval, i18n
│   ├── router/            # Vue Router（hash 模式，含权限守卫）
│   ├── api/               # HTTP + SSE 客户端
│   ├── toolCallRegistry.ts # Tool 组件全局注册表 (window.__MH_TOOL_REGISTRY__)
│   ├── toolComponentLoader.ts # 动态加载 UMD 组件 bundle
│   ├── toolComponents.config.ts # 组件源配置（multi-source）
│   ├── toolContext.ts     # Tool 渲染上下文 (provide/inject key)
│   ├── config.ts          # 应用配置 (appConfig)
│   ├── styles/            # 管理后台样式
│   └── types/             # TypeScript 类型定义
├── component/             # 独立 UMD 工具组件库 (built-in)
└── extra/                 # 独立 UMD 工具组件库 (extra)
```

## 路由

| 路径 | 名称 | 说明 |
|------|------|------|
| `/` | chat | 主聊天界面 (MainLayout) |
| `/components-demo` | components-demo | 组件调试页，无需认证 |
| `/manage/scenes` | scenes | 场景管理 |
| `/manage/agents` | agents | Agent 管理 |
| `/manage/tools` | tools | Tool 管理 |
| `/manage/eval` | eval | 评测管理（需 appConfig.enableEval=true） |

## 启动

```bash
npm install
npm run dev
```

## 构建

```bash
npx vue-tsc -b              # 类型检查
npx vite build              # 生产构建
```

### 组件库构建

```bash
cd component && npx vite build
cd extra && npx vite build
```

组件 bundle 会被复制到 `public/component/` 供动态加载。

### 纯前端开发（无需后端）

```bash
bash scripts/dev-frontend.sh           # 构建组件 + 启动 dev server
bash scripts/dev-frontend.sh --watch   # 监听组件变更自动重构建
```

访问 `http://localhost:5173/components-demo` 即可调试组件。

## 后端依赖

通过 HTTP/SSE 与以下服务通信：

- [auth-service](../packages/auth-service/) — 登录/权限
- [registry-service](../packages/registry-service/) — 场景/Agent/Tool 管理
- [orchestration-service](../packages/orchestration-service/) — 聊天/会话
