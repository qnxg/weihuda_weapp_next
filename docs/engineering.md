# 工程设计

## 技术栈

- React 19 + TypeScript + Vite
- React Router：路由、深链接与登录返回地址
- TanStack Query：请求缓存、并行加载、失效与重试
- Lucide React：统一图标
- SCSS：设计令牌、组件样式和少量原子类
- Vitest + Testing Library：数据适配、组件和关键交互测试
- Playwright：移动端端到端与截图验收

## 目录

```text
src/
  api/          类型、统一请求器、领域 API
  app/          Provider、路由、应用壳层
  auth/         会话存储、登录与鉴权门禁
  components/   通用状态、布局、表单和数据展示
  pages/        按路由拆分的页面
  styles/       令牌、基础样式、原子类和组件样式
  test/         测试工具
docs/           产品、设计与工程约束
mock-server/    独立本地接口服务
e2e/            Playwright 场景
```

## 数据流

1. 页面调用领域化 API Hook，不直接调用 `fetch`。
2. 请求器附加访问令牌并解析 `{ code, data }` 响应。
3. 非 `OK` code 或非 2xx 响应统一转换为 `ApiError`。
4. 401 时仅触发一次刷新；并发请求共享刷新 Promise。
5. 刷新成功后重放原请求，失败则清理会话并广播登出。
6. Mutation 成功后精确失效相关 Query Key，不做全局刷新。

首页课程在展示前经过 `src/utils/course.ts`：相同课程的连续节次合并为一个会话，再使用节次起止时间计算 `completed / warning / active / upcoming`。`warning` 的边界固定为开课前 20 分钟，`useMinuteClock` 在分钟边界刷新状态并在跨日时重置日期选择；学期范围外不匹配被钳制的首周或末周课程。

## 鉴权

- `access_token` 与 `refresh_token` 使用带版本号的本地存储结构。
- 登录所需的微信临时 `code` 通过 `window.WeihudaPlatform.login()` 适配器获取；普通浏览器草稿环境生成一次性 mock code。
- 受保护接口返回 `TFA` 时记录脱敏手机号和原访问地址，统一进入 `/tfa` 完成短信验证。
- 路由门禁只保护个人数据页；应用壳层和服务目录始终可进入。
- 登录使用 `returnTo` 查询参数返回原页面。
- mock server 暂不验证 token，但客户端仍完整实现真实后端所需流程。
- 会话切换会清空用户级 Query 缓存；刷新请求通过 session version 防止旧响应恢复已退出账号。

## 接口可追踪性

- `src/api/endpoints.ts` 是 57 个接口的唯一客户端清单。
- 每项包含 method、path 和鉴权属性，领域函数基于该清单发起请求。
- 覆盖测试对比客户端清单和 mock server 路由，防止接口遗漏。
- UI 映射维护在 `docs/product.md`。

## 样式组织

- `_tokens.scss` 仅定义颜色、尺寸、层级与断点。
- `_utilities.scss` 提供有限的布局、间距、文本和显示原子类。
- 页面与复杂组件使用同名 SCSS 模块，避免深层选择器。
- 禁止运行时拼接任意样式值；课程颜色通过有限状态类映射。

## 测试策略

- 单元测试：首页日期标题、周次计算、连续课程合并、课程时间状态、响应解析与格式化。
- 组件测试：今日/明日切换、默认明日、课程状态卡、骨架、错误重试、空状态、鉴权门禁和表单校验。
- 接口覆盖测试：客户端 57 项与 mock server 57 项逐一匹配。
- E2E：匿名访问、登录、首页课程状态与切换、课表查看、服务查询、错误恢复和窄屏无溢出。
- 视觉检查：`375x812`、`390x844`，同时检查底部安全区与键盘焦点。

## 本地开发

```bash
npm install
npm run dev
```

根脚本并行启动前端与 mock server。默认地址：

- 前端：`http://127.0.0.1:5173`
- Mock API：`http://127.0.0.1:3000`

## 约定

- 日期与数字通过 `Intl` 格式化。
- 异步页面不返回纯白屏。
- 表单提交期间禁用重复提交，错误显示在对应字段或页面中。
- 新增接口时必须同步更新 endpoint 清单、领域 API、UI 映射和覆盖测试。
