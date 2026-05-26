# web-frontend — 用户界面

Vue 3 + TypeScript + Vite 构建的 SPA 前端。

- 端口：`5173`
- 开发服务器：`http://localhost:5173`

## 目录结构

```
web-frontend/
├── src/
│   ├── views/             # LoginView, ChatView
│   ├── stores/            # Pinia: auth, chat
│   ├── router/            # Vue Router（含路由守卫）
│   ├── api/               # HTTP + SSE 客户端
│   ├── components/        # 通用组件
│   ├── composables/       # 组合式函数
│   ├── toolComponents/    # Tool 渲染组件
│   └── types/             # TypeScript 类型定义
└── component/             # 独立 UMD 工具组件库
```

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
```

组件 bundle 会被复制到 `public/component/` 供动态加载。

## 后端依赖

通过 HTTP/SSE 与以下服务通信：

- [auth-service](../packages/auth-service/) — 登录/权限
- [orchestration-service](../packages/orchestration-service/) — 聊天/会话
