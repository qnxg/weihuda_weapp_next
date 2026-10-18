# 微生活 API Mock Server

面向 Apifox 项目 `8872112` 主分支维护 62 个本地 HTTP 契约。服务使用 Node.js
内置模块，无第三方依赖。

## 启动

要求 Node.js 20 或更高版本。

```bash
npm start
```

默认地址为 `http://127.0.0.1:3100`。可通过环境变量修改：

```bash
MOCK_HOST=0.0.0.0 MOCK_PORT=3200 npm start
```

开发模式：

```bash
npm run dev
```

## Mock 控制

- 所有请求默认随机延迟 `500–1000ms`，用于模拟弱网抖动。
- `X-Mock-Status: 503`：在执行路由处理器前短路，强制任意已注册接口返回指定的 4xx/5xx 状态码，不产生写操作或最近查询等状态变更。
- `X-Mock-Delay: 1500`：覆盖随机值并延迟 1500 毫秒，上限 10 秒；传 `0` 可关闭本次请求的延迟。
- `X-Mock-Date: 2026-09-23`：仅为 `GET /countdown` 固定计算日期，便于验证状态边界。
- 响应头 `X-Mock-Delay` 会返回本次请求实际应用的延迟毫秒数。
- 除登录、刷新 token、匿名反馈、元数据、倒计时、学期信息和校历外，其余接口要求 `Authorization: Bearer <token>`。
- 服务允许跨域请求。
- `GET /semester` 返回完整 `SemesterTable`；`items` 是可见学期目录，`now_xn/now_xq` 指定当前项。课表、成绩、排名、自定义课程、倒计时和实验成绩使用整数 `xq`，并与对应 `SemesterItem.xq` 一致；界面显示名称来自 `SemesterItem.xq_text`，`GET /countdown` 会透传该字段；`GET /lab/grade` 在有效学期没有成绩时可返回 `null`。
- `GET /calendar` 公开返回按学年分组的 `xn`、仅含 `id/name` 的阶段目录和 `now_id`；`GET /calendar/{id}` 公开返回对应阶段的 `from/to/name/prev/notes`。Mock 不返回预生成周次或逐日日期，客户端按起止日期生成正式周，并按 `prev.index/name` 生成前置参考周。
- 设置、自定义课程、自定义考试、反馈、签到、通知已读、楼栋收藏和最近查询状态保存在进程内存中，重启后重置。
- `GET /img/{id}` 返回一个有效的 PNG 文件。
- `GET /classtable` 保持周一至周日均有课程，并覆盖三节连续课、单节课、三节课中途换教室、按周次换教室后由新课程接替、同周同时间课程冲突、同一课程每周跨两个星期上课六类组合场景；中途换教室的连续课程因字段不完全一致而保持为两个课程块。
- `GET /course/extra` 每次请求以 50% 概率返回空列表，另 50% 返回“工程实践”和“学术写作专题”两门无课表课程；前者使用 `extra: null`，后者包含超过 300 字的备注，用于验证区块隐藏、无备注行省略、列表数量、完整字段、详情分割线和弹窗长内容滚动。
- 课表数据额外包含一节高和两节高的超长课程名、超长地点样例，用于验证课程格的独立多行省略与地点可见性。
- 周日的设计思维与数字媒体基础、周三的编译原理与程序设计方法分别使用单双周共用同一时段，用于验证异周课程栈不显示冲突数量；周四的数据库系统与数据库系统实验在同周同时间上课，用于验证左下角 `+N` 冲突标记。周五的离散数学仅在单周上课，可继续验证当前周优先级、非本周状态、课程栈折角和详情卡长内容滚动。
- `GET /exam` 按服务启动时的 `Asia/Shanghai` 当前分钟生成 3 条 `recent` 和 14 条 `end` 数据；默认返回 `recent`，`type=end` 支持以 `offset` 每次稳定获取最多 10 条。数据覆盖有效/失效、尚未开始/正在进行/已结束、自定义考试、超长课程名、超长考场名以及两者同时超长；新增自定义考试会补充 `invalid: false`。
- `GET /grade` 提供 6 门课程，覆盖主修隐藏、辅修、空/非空成绩标识、必修/非必修课程类型 1，以及专业课、专业基础、学类核心、学门核心、专业核心和普通课程类型 2。
- `GET /rank` 与 `GET /rank/ca` 会为全部、必修、核心课程分别随机返回“成绩和排名都有、仅成绩、仅排名、均无”之一；同一课程类型内三个指标的成绩字段和排名字段分别保持整体存在或整体缺失。
- `GET /building` 返回上游教务系统的 53 条教学楼映射，并附带可空的 `description`、当前 Mock 用户的 `favorite` 与 `last_query_at`；收藏项优先排列。稳定查询名单中的 8 栋楼不显示可用性警告，其中北校区 4 栋使用 `description: "北校区"`；其余楼栋描述包含“可能无法查询到数据”，名称不携带北校区括号。默认最近查询记录分配给名称最长的三栋楼，用于持续验证标签截断。`PUT /building/{building_id}/favorite` 幂等更新收藏状态。`GET /empty_room` 校验楼栋 ID、日期及必填的 `times` 小节次逗号列表，返回同时满足全部所选节次的单个 `time/items` 结果；选择全部 12 节时覆盖空结果，成功后记录该楼栋最近查询时间。

## 示例

```bash
curl http://127.0.0.1:3100/me \
  -H 'Authorization: Bearer mock-access-token'

curl http://127.0.0.1:3100/countdown \
  -H 'X-Mock-Date: 2026-09-23'

curl http://127.0.0.1:3100/building \
  -H 'Authorization: Bearer mock-access-token'

curl -X PUT http://127.0.0.1:3100/building/106/favorite \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer mock-access-token' \
  -d '{"favorite":true}'

curl -X PUT http://127.0.0.1:3100/me/setting/table \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer mock-access-token' \
  -d '{"version":2,"setting":{"display_not_current_week_courses":false}}'

curl http://127.0.0.1:3100/empty_room \
  --get \
  -H 'Authorization: Bearer mock-access-token' \
  --data-urlencode 'building_id=106' \
  --data-urlencode 'date=2026-09-22' \
  --data-urlencode 'times=1,2,3'
```

## 测试

```bash
npm test
```
