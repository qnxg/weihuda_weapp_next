# 微生活 API Mock Server

基于 Apifox 项目 `8872112` 主分支的 57 个 HTTP 接口生成。服务使用 Node.js
内置模块，无第三方依赖。

## 启动

要求 Node.js 20 或更高版本。

```bash
npm start
```

默认地址为 `http://127.0.0.1:3000`。可通过环境变量修改：

```bash
MOCK_HOST=0.0.0.0 MOCK_PORT=3100 npm start
```

开发模式：

```bash
npm run dev
```

## Mock 控制

- 所有请求默认随机延迟 `500–1000ms`，用于模拟弱网抖动。
- `X-Mock-Status: 503`：强制任意已注册接口返回指定的 4xx/5xx 状态码。
- `X-Mock-Delay: 1500`：覆盖随机值并延迟 1500 毫秒，上限 10 秒；传 `0` 可关闭本次请求的延迟。
- 响应头 `X-Mock-Delay` 会返回本次请求实际应用的延迟毫秒数。
- 除登录、刷新 token、匿名反馈和元数据外，其余接口要求 `Authorization: Bearer <token>`。
- 服务允许跨域请求。
- 设置、自定义课程、自定义考试、反馈、签到和通知已读状态保存在进程内存中，重启后重置。
- `GET /img/{id}` 返回一个有效的 PNG 文件。
- `GET /classtable` 提供周一至周日的连续双节课程；周三覆盖上午、下午和晚间时段，可配合固定浏览器时间验证已结束、开课前 20 分钟、上课中和未开始状态。

## 示例

```bash
curl http://127.0.0.1:3000/me \
  -H 'Authorization: Bearer mock-access-token'

curl -X PUT http://127.0.0.1:3000/me/setting/table \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer mock-access-token' \
  -d '{"version":2,"setting":{"display_not_current_week_courses":false}}'

curl http://127.0.0.1:3000/empty_room \
  --get \
  -H 'Authorization: Bearer mock-access-token' \
  --data-urlencode 'building_id=001' \
  --data-urlencode 'time=1,2' \
  --data-urlencode 'date=2026-09-22'
```

## 测试

```bash
npm test
```
