# 微生活移动端 Web

面向湖南大学学生的窄屏校园应用草稿。课表是核心入口，并完整接入 Apifox 项目 `8872112` 的 58 个 HTTP 接口。

## 启动

要求 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

默认地址：

- Web：`http://127.0.0.1:5173`
- Mock API：`http://127.0.0.1:3100`

端口被占用时：

```bash
MOCK_PORT=3200 MOCK_URL=http://127.0.0.1:3200 npm run dev
```

mock 登录接受任意非空学号和密码。示例学号：`202208010101`。

## 验证

```bash
npm run check
npm run test:e2e
```

`test:e2e` 使用 `375x812` 和 `390x844` 两个移动端视口，并验证匿名门禁、课表、服务页、错误恢复和横向溢出。

## 文档

- [产品与接口映射](docs/product.md)
- [移动端设计系统](docs/design-system.md)
- [工程设计](docs/engineering.md)
- [Agent 开发约束](agents.md)
