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

请求依赖按数据契约建模：只有后续请求需要前序响应参数、鉴权结果或写操作结果时才使用 `enabled` 或 `await` 串行等待；其余 Query 在组件挂载时并行启动。多请求页面禁止通过 `queries.some(isPending)` 或 `queries.find(isError)` 形成全有或全无的页面门槛。

`QueryState` 统一处理区块级骨架、错误与单请求重试。每个 Query 的状态放在直接消费其数据的最小 `Section` 或摘要区域内；页面标题、筛选器、本地日期和其他已成功区块不随无关请求消失。后台刷新失败且缓存数据仍可用时继续展示缓存内容，并在原区块提供恢复操作。页面级错误只用于页面核心视图确实无法脱离该数据源工作的场景。

`src/components/PullToRefresh.tsx` 由 `AppShell` 挂载在 `#main-content`，为首页、关于页、校历及已登录的数据浏览路由启用。组件在手势开始时解析语义刷新边界：普通页面使用 `PageHeader` 底边，具有顶层 `.segmented` 的页面使用筛选控件底边，具有 `tabpanel` 或显式 `data-pull-to-refresh-panel` 的页面只使用对应内容面板；标题栏、Tab 和面板外筛选器不参与位移。手势从滚动位置 0 开始，经 6px 方向锁定后仅接管向下且纵向位移明显占优的单指触摸；表单控件、弹窗和横向滚动保持原生行为，触点增加或能力被禁用时立即复位。越过阈值后通过 `queryClient.refetchQueries({ type: "active" })` 并行刷新当前页活跃 Query，不触发 Mutation；刷新协调器继续跟踪刷新结果触发的新 active 依赖 Query，对本轮新激活的 Query 即使已有 fresh 缓存也显式刷新一次，直到查询链连续两个任务轮次稳定为空闲，再根据本轮各 Query 的 `errorUpdateCount` 判断整体成功或失败，避免列表更新后详情未刷新、仍在加载或首个失败提前撤掉骨架。请求期间隐藏目标区域旧内容并在相同锚点渲染 `PageSkeleton`，其余页面区域持续可用。服务目录、设置、反馈、成绩排名和空教室保留各自的静态、草稿或显式查询语义，不启用下拉刷新。

通用 `Modal` 将固定标题栏与可滚动正文分层，最大高度受移动视口约束；长内容调用方可通过 `bodyLabel` 将正文声明为带名称、可聚焦的滚动区域，使键盘用户能够使用 `PageDown`、方向键和 `End` 阅读全部内容。遮罩点击统一转发 `onClose`，是否允许退出仍由调用方状态决定，因此进行中的破坏性确认不可关闭。

课程成绩与成绩排名使用独立懒加载路由。`/services/grades` 通过共享的 `src/components/SemesterPicker.tsx` 直接展示 `SemesterTable.items`，将所选 `SemesterItem.xn/xq` 写入 URL 并只创建对应的 `grade` Query；当前学期使用无参数 URL，历史学期保留可分享的查询参数。`xq` 是服务端分配的整数 ID，所有课表、成绩、排名、自定义课程、倒计时和实验成绩契约都与 `SemesterItem.xq` 对齐；界面名称直接使用对应的 `SemesterItem.xq_text`，客户端不得根据 ID 推导或维护季节字符串枚举。`src/utils/grade.ts` 的 `buildGradeTags` 统一完成成绩标识、辅修、课程类型 1、课程类型 2 的优先级排序、去重和语义色映射，`formatGradePoint` 将可空绩点格式化为一位小数。Mock 成绩固定覆盖主修/辅修、空/非空成绩标识、必修/其他课程类型 1，以及五种 primary 与一种普通课程类型 2。`/services/rank` 将 `xn/xq/range/data_source/display` 写入 URL，并以完整筛选参数创建 `rank` Query；可选学年和学期严格来自同一张服务端学期表。学年为“全部”时省略接口的 `xn/xq`，选择具体学年后允许继续选择全部或该学年下服务端可见的学期；旧的 `/services/grades?source=...` 深链在发起请求前重定向到排名页。

页面底部的静态补充说明统一使用 `src/components/PageFootnotes.tsx`；组件接收已包含中文句号的有序字符串数组，以语义化 note 区域和可见星号渲染，不参与页面请求状态。考试安排页将来源说明与失效说明定义为模块级只读数组，并根据当前 Tab 在对应列表 `Section` 后切换，说明不会随列表加载、失败或空状态隐藏；局部选择器 `.exam-tab-panel > .page-footnotes` 提供 `12px` 上边距，不修改其他页面的共享说明间距。课表页将六条说明定义为模块级只读数组，并放在“无课表课程”列表之后；`GET /course/extra` 成功返回空数组时不挂载整个 `Section`，初始加载和错误恢复仍保持区块级反馈。存在数据时使用 `ul/li` 组织语义列表，每项的原生按钮只读取课程名称、课程性质、校区和教师并将四个字段完整写入无障碍名称，点击后打开消费完整 `ExtraCourse` 本地数据的详情弹窗，不新增请求。详情字段数组仅在 `extra` 为非空字符串时追加备注对象，因此无备注时不会生成标签、分割线或占位文案；非空备注行切换为全宽左对齐布局，其余 `data-row` 之间通过局部高优先级样式恢复分割线。弹窗通过 `bodyLabel` 暴露可聚焦的正文滚动区。Mock 路由使用注入的随机源，以 `[0, 0.5)` 返回两条课程、`[0.5, 1)` 返回空列表；非空数据同时覆盖 `extra: null` 与超过 300 字的备注。

`/services/calendar` 使用 `["academic-calendar-list"]` Query 消费公开 `GET /calendar`，列表按学年分组，每个 `periods[]` 目录项只包含稳定整数 `id` 和中文 `name`，学年项的 `xn` 是服务端展示文本。页面以选中 ID 使用 `["academic-calendar-detail", id]` Query 消费公开 `GET /calendar/{id}`；无 URL 参数时由 `now_id` 决定默认阶段，非当前选择只写入稳定 `?id=`，显式传入当前 ID 时规范化为无参数 URL。正整数 ID 不存在时保留 URL 并展示恢复入口，格式错误或超出安全整数范围的 ID 被移除并回到当前阶段。列表是详情请求的参数依赖，因此首屏允许串行；下拉刷新时协调器会继续刷新列表更新后激活的详情 Query。目录加载成功后，联合选择标题和弹窗始终可用，详情加载、错误与重试只占用日期和说明区域。页面标题在详情成功后直接使用 `name`，副标题格式化 `from/to` 和生成的正式周数；弹层切换学年时只从列表缓存替换右列四个阶段目录，不预取详情，选择阶段后才写入 ID 并激活详情 Query。`src/utils/academicCalendar.ts` 校验非空学年文本、每学年四阶段、全局 ID 唯一性和 `now_id` 指向；详情必须以周日开始、周六结束，`prev.index` 必须是互不重复的负整数。适配器按 UTC 日历日从 `from` 到 `to` 生成每周七天日期和从 1 开始的正式周次，再按负偏移生成前置参考周，并将 `notes.key/value` 映射为展示模型；展示文案不参与阶段身份判断，不根据本地学期或节假日规则改变接口边界和说明。`CalendarDay` 以本地日期的年月标记 `is-outside-current-month`，通过局部 `--calendar-outside-month: #6a7883` 弱化非当前月数字并保持白底 `4.5:1` 对比度；今天状态覆盖该弱化色。白色 `.academic-calendar-grid` 不设置块级 padding，header 与 row 也不设置横向 padding；表头八个单元统一继承 `var(--ink)`。日期与周数共享 `28px + 10px` 两行轨道，第一行中心对齐主数字，第二行承载月份；周数轴通过连续 `1px` 右边框与日期区分隔。前置参考周使用 `surface-muted` 行背景，可见周数不附加“参考”，行的 `aria-label` 保留该状态。非空安排说明区使用 `var(--brand)` 实色背景与 `#fff` 前景色，空 `notes` 不渲染该区域。校历内容使用 `data-pull-to-refresh-panel` 将联合筛选标题排除在刷新位移之外。Mock fixture 直接保存与生产一致的瘦详情，前端测试单独验证日期生成。

排名 mock 以完整数据为数值模板，为全部、必修、核心课程独立随机选择“成绩和排名都有、仅成绩、仅排名、均无”四种存在状态。同一课程类型内三个成绩字段和三个排名字段分别成组出现；生成函数允许注入随机源，自动化测试可稳定覆盖全部状态而不依赖概率。

空教室页挂载时启用 `GET /building` Query 并缓存 30 分钟。当前楼栋通过渲染期派生：优先使用用户手动选择，否则使用 `last_query_at` 最新项，全部为空时回退到接口数组第一项；因此后台刷新只更新元数据，不会覆盖已有手动选择。页面从 `last_query_at` 非空项中按时间倒序取前三个最近查询楼栋，这些快捷项渲染为教学楼字段内部的单行标签，视觉表面与课程成绩属性共同复用 `src/components/ui.tsx` 的 `Tag` 组件。不存在历史时不渲染标签区，少于三个时只渲染实际项目，超长名称在可视表面省略但保留完整无障碍名称。楼栋选择弹窗不提供客户端搜索，只对完整响应稳定排序并将 `favorite: true` 的项目置顶；当前选择行和弹窗列表均不渲染内部楼栋 ID，弹窗使用可空 `description` 展示校区和数据可用性。`PUT /building/{building_id}/favorite` 成功后精确更新 `["buildings"]` 缓存。页面默认选择第 1、2 小节；提交时把 `building_id`、`date` 和升序排列后以逗号连接的 `times` 传给 `GET /empty_room`。接口适配器按 Apifox 当前契约读取单个 `EmptyRoomResult`，仅兼容 `items` 为单对象或数组的响应差异；提交快照继续提供结果区楼栋标题和日期副标题。结果左卡使用六个 `aria-pressed` 按钮管理 `1-2`、`3-4`、`5-6`、`7-8`、`9-11`、`12` 节分组多选，每组在提交前展开为对应的小节次数组，至少保留一组；首次提交后，修改节次会更新 Query key，并以已提交的楼栋和日期重新请求。右卡只展示当前请求结果；请求期间隐藏旧列表并显示局部骨架，失败和空结果也只替换右卡，左侧选择持续可用。成功后通过状态文本播报所选节次和教室总数，同时失效楼栋 Query 以取得服务端刚记录的 `last_query_at`。Mock 中 53 条楼栋 fixture 同时服务列表接口、收藏状态和空教室参数校验；空教室路由校验第 1 至第 12 小节的非空逗号列表，并按所有所选节次求共同空闲教室，选择全部节次时稳定返回空列表。名称不携带北校区括号，描述由稳定查询名单与校区元数据生成，默认最近查询记录使用名称最长的三栋楼以覆盖标签截断，用户偏好保存在进程内存中。

空教室结果副标题通过 `src/utils/format.ts` 的 `formatDateWithWeekday` 格式化已提交的日期；该函数复用 `parseApiDate` 将纯日期按本地日历日解析，再追加中文星期，避免 UTC 解析造成星期偏移。

首页课程在展示前经过 `src/utils/course.ts`：相同课程的连续节次合并为一个会话，再使用节次起止时间计算 `completed / warning / active / upcoming`。`warning` 的边界固定为开课前 20 分钟，`useMinuteClock` 在分钟边界刷新状态并在跨日时重置日期选择；学期范围外不匹配被钳制的首周或末周课程。

首页倒计时由公开的 `GET /countdown` 接口提供，`CountdownOverview` 直接消费后端给出的假期、学期状态与自然日差值，不在客户端重新计算。查询 key 包含 `Asia/Shanghai` 自然日，页面持续打开跨日时会自动请求新数据，并在刷新期间保留上一响应避免布局闪烁。

首页日期标题始终由本地时钟同步计算，不依赖任何接口。公开且不带参数的 `GET /semester` 返回 `SemesterTable { items, now_xn, now_xq }`；客户端只通过 `now_xn/now_xq` 在 `items` 中查找当前项，并以该项为课表、成绩、排名和实验成绩提供学年学期参数，所有学期名称直接使用该项的 `xq_text`。当前学期是服务端事实，客户端禁止根据当前时间、`start` 或 `weeks` 改选其他项。接口失败时省略副标题并只影响真实依赖区块。倒计时与学期请求并行发起，公告、考试、实验安排、体测预约、邮件、通知、首页设置和校园账户等受保护请求也互不阻塞。`GET /announcement` 返回的数据直接按接口顺序插入整个课程区块之前；公告预览只在区块标题渲染一次图标，逐条格式化 `created_at`，并通过 `white-space: pre-wrap` 完整保留 `content` 换行。公告容器依靠现有标题节点划分表面：标题节点使用 `info-surface`，公告与骨架正文使用 `surface`，相邻项使用 `line` 分隔，正文操作使用高对比文本与 `brand-dark`。`GET /email`、`GET /dorm/electricity`、`GET /card/info` 和 `GET /netflow` 固定由首页“校园账户”消费，不等待 `index_card` 设置。

课表页、首页、课程成绩页、成绩排名页和实验成绩页共享 `["semester"]` Query。`SemesterPicker` 保持 `SemesterTable.items` 的服务端顺序并直接使用每项自带的日期范围，不生成历史学期，也不为每个选项再次请求接口。选择历史学期后将整数 `xn/xq` 写入 URL，并以同一参数并行请求课表和未排课课程；切换学期时清除 `week`，历史学期从首周开始。查看服务端指定的当前学期时，当前日期早于该项 `start` 则显示首周，晚于 `start + weeks` 则显示末周，日期钳制只决定周次，绝不改变当前学期项。

共享 `PageHeader` 通过主内容滚动容器上的 passive 监听器判断页面是否离开顶部，只在该布尔状态变化时更新 React 状态；页面顶部不显示阴影，开始滚动后通过 class 与 CSS transition 显示轻量阴影。组件只接受标题、副标题、返回按钮和左侧 leading 内容，不定义右侧 action API，以结构约束保证标题栏右侧永久留空；业务操作和错误恢复必须下沉到直接消费数据的正文区块。课表星期栏另行判断吸顶边界，并将标题栏实际高度写入局部 CSS 变量以紧贴其下方；星期栏吸顶后接管阴影，同时展开标题栏周次。

`api.exam.list(type, offset)` 对应最新 Apifox `GET /exam`：`type` 为 `recent | end` 且默认 `recent`，`offset` 仅在 `end` 时序列化。考试页并行维护 `["exams", "recent"]` 普通 Query 与 `["exams", "end"]` Infinite Query，不聚合为全页加载或错误状态；结束列表单页达到接口上限 10 条时，以所有已加载页的总长度作为下一页 `offset`。两个 Query 及首页复用的 `["exams", "recent"]` 均每分钟自动刷新，以跟随服务端按时间更新分类；首页直接展示服务端顺序的第一项。任一 Tab 在已有缓存时 refetch 失败继续展示原列表，并在当前面板追加可重试错误，只有无缓存的首次失败才使用初始错误状态。前端不再维护考试分组函数，`src/utils/exam.ts` 只根据可空日期时间和 `invalid` 计算卡片的未开始、考试中、已结束、已失效展示状态。考试页 `PageHeader` 不传 `description`；列表由独立 `ExamCard` 组成，不复用带分割线的通用 `.surface.list` 容器。卡片正文以命名 CSS Grid area 固定日期/状态、课程/考场座位、元信息/时间三行双列位置，课程名与考场座位均以 `align-self: center` 对齐第二行中心；所有状态共享白色 surface，只切换日期文字和状态胶囊，不改变卡片背景或 DOM 结构。新增入口作为未结束列表 CSS Grid 的第一个 `ExamAddCard` 渲染，使用横向 flex 将 `Plus` 图标和“添加”文字作为整体居中，已结束 Tab 不显示；`completed` 与 `invalid` 自定义考试的编辑按钮使用原生 `disabled`，删除操作不受影响。

Mock Server 启动时以 `Asia/Shanghai` 当前分钟构造 3 条未结束和 14 条已结束考试；`GET /exam` 默认与 `type=recent` 等价，`type=end` 按 `offset` 稳定截取最多 10 条，且拒绝非法类型、recent 携带 offset、负数或非整数 offset。Fixture 包含尚未开始和已经结束的有效自定义考试，并覆盖有效/失效、超长课程名、超长考场名以及二者同时超长；新增自定义考试由服务端补充数值 `customize_id` 与 `invalid: false`。

首页“校园账户”中的校园网、宿舍电量和校园卡分别与详情页共享 `["network"]`、`["dorm", "electricity"]`、`["card", "info"]` Query Key；四个摘要请求并行且状态限制在各自卡片。三张并列摘要卡使用 `aspect-ratio: 1` 派生首选高度，再由 `min-height: 96px` 和 `max-height: 120px` 约束实际高度。

首页“近期事项”复用详情页的 `["exams", "recent"]`、`["lab", "schedule"]` 和 `["gym", "appointments"]` Query。`daysUntilDate` 将 ISO 日期、API 日期时间和中文预约日期统一转换为本地自然日差；三个完整数组分别过滤出全部 `0–6` 天记录，映射为统一 `RecentMatterItem` 后按时间戳升序合并，不限制条数。`formatMonthDayWithWeekday` 将三种日期格式统一为无年份的中文月日星期，`recentMatterDetail` 再按日期、规范化时间段、地点的顺序过滤空值并用 `｜` 连接。`RecentMatterRow` 根据日差映射 `warning / success / neutral` 状态条和行背景；来源 Query 未完成或失败时只追加对应状态行，全部成功且结果为空时才显示整体空状态。`["notices", "unread"]` 只驱动通知链接无障碍名称和数字角标，不生成列表行；大于 `99` 的可见数量压缩为 `99+`。

首页不再渲染由 `index_card` 动态拼装的“校园速览”，因此不为积分、校园动态、考试倒计时或最新成绩创建摘要行。固定的 `SemesterGradesOverview` 复用课程成绩页 `["grades", now_xn, now_xq]` Query，只在服务端当前学期确定后启用；组件不截断或排序接口结果，而是将全部成绩映射为原生横向自由滚动列表中的独立课程链接，每项只消费 `course_name/score` 并统一进入 `/services/grades`。轨道不声明任何 scroll-snap 属性，使用对称负外边距抵消页面容器横向 padding，避免创建页面级横向溢出，再在滚动容器内部恢复首尾 `16px` padding。学期仅保留在轨道无障碍名称中，不作为可见副标题；学期目录与成绩请求的加载、失败和重试分别限制在成绩分区。

Mock 的月度与单日流量明细均固定返回基础协议、视频服务、云服务、学习平台和其他流量五项，且各项上传、下载与总量分别加总到响应摘要；单日响应使用 MB，月度响应使用 GB，便于同时验证长列表、日期切换和单位展示。

`src/components/ProgressBar.tsx` 封装原生 `progress` 的数值钳制、无障碍名称、固定尺寸和 `primary/success/warning` tone；`NetworkUsageSummary` 与流量明细页共同复用，前者直接消费接口的 `base_percentage` 计算百分比和 50%/90% 两级颜色阈值，后者固定使用 primary。首页按需追加 `extend_usage` 超额流量，校园网页指标网格依次将 `upload/download/base_amount/extend_usage` 映射为“上传流量 / 下载流量、免费流量 / 超出流量”，并在无可见分区标题的下方列表卡独立展示 `overdue_payment/is_locked`。流量明细分类只在展示层移除接口 `app` 最前方的一个 `/`，原值继续作为列表 key；后续 `/` 由带 `line-strong` 色和水平间距的装饰 span 渲染，标题通过 `aria-label` 保留完整路径读法，列表继续使用共享内边距和分割线。客户端不根据格式化后的流量字符串反推数值；两个无标题区域通过原生 `section[aria-label]` 保留可访问分区语义。

服务目录保持纯静态，只提供学习与校园生活查询入口，不再请求邮件或展示公告、积分、反馈、关于入口。`GET /announcement` 只由首页公告区消费；旧 `index_card.campus` 保留接口兼容但不生成首页摘要。不注册独立公告页面、标题映射或下拉刷新路由。积分中心沿用 `/services/points` 深链以保持兼容，但唯一目录入口位于“我的”；“我的”的 `GET /me` 只消费姓名、学院与学号作为可见身份信息，不渲染接口返回的其他学籍字段，账号请求失败不会遮蔽积分、反馈和关于等独立入口。

体测成绩、体测预约与体测标准使用独立懒加载路由。`/services/gym/grade` 复用 `["semester"]` Query，从 `SemesterTable.items` 按接口顺序去重得到学年选项，并以 `now_xn` 作为无参数 URL 的默认学年；合法历史 `xn` 写入 URL 后挂载 `["gym", "grade", xn]` 并消费 `GET /gym/grade?xn=...`，无效值回退到服务端当前学年并从 URL 移除。学年目录是成绩请求的参数依赖，因此成绩 Query 在学年确定后启用；学年目录和成绩分别保留局部加载、错误与重试，目录后台刷新失败时继续展示缓存内容并提供重试。总评摘要纸片只消费响应中的 `score/grade`；七个 `GymMetric` 与 `eye.sight` 摘要共同形成带一层阴影的八项网格卡片；网格后方的独立 `dl` 列表纸片再以“成绩状态、成绩类型、成绩描述”三行消费 `report_status/report_type/report_description`，其中状态直接进入普通 `data-row__value`，不生成 `badge`，避免报告字段在总评中重复。单项主值直接使用 `GymMetric.grade`，次要行显示 `GymMetric.score` 分与由项目定义提供的固定占比；`GymMetric.rank` 只作为等级标签文字并统一增加 `4px` 上外边距，`GymMetric.color` 经大小写归一化后将 `green` 映射为 `badge--success`、`red` 映射为 `badge--danger`，其他值使用中性 `badge`。Mock 的 `rank/color` 按等级文字与语义色返回，不承载项目权重。点击视力项只使用当前 Query 缓存中的完整 `eye` 数据打开详情弹窗，不新增请求。Mock 校验 `xn` 必填且必须来自可见学年目录，并为各学年返回可区分的总评摘要。`/services/gym/appointment` 只挂载 `["gym", "appointments"]` 并消费 `GET /gym/appointment`，任一远端体测页面的刷新不会触发另一项体测业务请求。`/services/gym/standard` 是无需登录、无需 Query 且不启用下拉刷新的静态页面；总分构成固定为标准分满分 `100` 分、附加分满分 `20` 分和总分满分 `120` 分，公式 DOM 固定使用“数值、名称”的顺序并通过命名 `group` 暴露完整无障碍说明，“总分构成”与“等级划分”标题行共享相同的 `52px` 布局尺寸。毕业成绩规则同样作为静态规则直接定义在页面中，通过第二个命名 `group` 暴露“毕业当年学年总分 × 50% + 其他学年总分平均得分 × 50%”的完整计算语义，并在结果区明确毕业等级按毕业成绩评定；该规则与项目阈值数据解耦。性别、年级和项目 Tab 共用一个标题为“项目评分标准”的筛选分区，标题行不传入附加操作；性别和年级保留在普通筛选卡中，每个字段行固定为 `52px`，每组选项使用受控原生 radio，选项 label 继续提供 `44px` 点击范围。项目 Tab 位于独立的内容宽度白色卡片，卡片与 tablist 均不设置内边距，卡片 DOM 只包含 tablist，按钮只渲染图标与项目名，外层滚动容器负责整卡横向滚动；卡片不再设置额外 `min-width`，由七个 Tab 与六个间距自然撑开。选中 Tab 继续由 `aria-selected` 表达语义，视觉状态则由品牌色文字与 `::after` 底部横线共同表达，不切换填充背景。`src/pages/services/gymStandards.ts` 集中定义男、女生评分表中的完整标准分档，每个项目保留稳定的 `weight/unit`，并由构造函数校验分值与两个年级组阈值数量一致；常规项目使用 20 档分值，男生引体向上保留原表独立的 15 档序列。页面按 `audience/gradeGroup/project` 派生当前项目名称、占比、单位和标准表格；占比只传给当前标准 Section 的 `description`，Section 不传 `action`，单位插入“成绩要求（单位）”列标题。

毕业成绩卡标题行的 DOM 只包含标题元素；完整计算语义继续由下方命名 `group` 提供，不依赖重复的可见辅助文案。“等级划分”标题行的辅助说明通过自动左外边距占据剩余空间并右对齐。成绩排名与体测标准的二选一条件统一由 `components/ui.tsx` 导出的受控 `RadioGroup` 渲染；体测页面只通过行级 class 覆盖紧凑高度和内边距，不重复实现 Radio DOM 与状态逻辑。标准表通过 `:is(thead th, tbody td):last-child` 让等级表头与正文最后一列共享右对齐规则，分值行头只渲染数值节点。

`StandardRow.kind` 区分 `standard` 与 `bonus`，可选 `category` 承载 BMI 的“正常、低体重、超重、肥胖”分类，使两个 80 分行拥有独立身份和阈值。其他标准行直接展示原表分值和绝对阈值；耐力跑与力量项目的十条附加分行在数据模块中保存各性别、年级组换算后的绝对时间或次数门槛。页面按 `kind` 拆分数据：标准行进入三列表格；附加分行按既有 `+10` 至 `+1` 顺序切成两个 5 条数组，在同一 `tabpanel` 内进入并列的两张独立两列表格，并以不同 caption 区分前 5 档和后 5 档。附加分表格把每张卡片的外侧单元格 padding 固定为 `14px`，与标准分表格对齐，并相应收紧中线侧 padding 以维持窄屏可用列宽。数据测试校验项目 ID、权重合计、标准分序列、BMI 分类、附加分序列、双年级绝对阈值和关键边界值。

实验安排与实验成绩使用独立懒加载路由。`/services/lab/schedule` 只挂载 `["lab", "schedule"]` 并消费 `GET /lab/schedule`，账号绑定表单通过 `POST /lab/bind` 保留在同页；`/services/lab/grade` 复用共享 `["semester"]` Query 与 `SemesterPicker`，以 `now_xn/now_xq` 作为无参数 URL 的默认学期，历史选择将整数 `xn/xq` 写入 URL，再挂载 `["lab", "grade", xn, xq]` 并消费 `GET /lab/grade`。`course_name/course_score` 在课程总评纸片中展示，`labs[]` 按接口顺序形成可点击列表并使用 `details.length` 生成评分项数量；详情弹窗只消费当前选择项缓存的 `details`，不新增请求。`null`、空列表和空评分组成分别使用明确的空状态，缺失总评、单项分数和出勤时显示“待发布”或“出勤未记录”。任一实验页面加载或下拉刷新都不会触发另一页面的业务 Query。

匿名首页保持与登录态相同的页面骨架，但所有受保护 Query 均通过 `enabled: false` 保持静默。日期、学期周次和倒计时直接展示，其余区域在原位置渲染 `AuthPrompt`；课程日期复用登录态的 `CourseDayTabs` 交互，仅在本地切换门禁文案，不触发课表或校园网请求。公开请求使用局部加载或降级文案，不阻塞其他匿名内容。

mock server 按 `Asia/Shanghai` 当前日期生成倒计时；自动化测试通过仅限 mock 的 `X-Mock-Date: YYYY-MM-DD` 请求头固定日期，生产接口不接收该控制参数。

## 鉴权

- `access_token` 与 `refresh_token` 使用带版本号的本地存储结构。
- 登录所需的微信临时 `code` 通过 `window.WeihudaPlatform.login()` 适配器获取；普通浏览器草稿环境生成一次性 mock code。
- 受保护接口返回 `TFA` 时记录脱敏手机号和原访问地址，统一进入 `/tfa` 完成短信验证。
- 路由门禁只保护个人数据页；应用壳层和服务目录始终可进入。
- 登录使用 `returnTo` 查询参数返回原页面。
- mock server 暂不验证 token，但客户端仍完整实现真实后端所需流程。
- 会话切换会清空用户级 Query 缓存；刷新请求通过 session version 防止旧响应恢复已退出账号。

## 接口可追踪性

- `src/api/endpoints.ts` 是 62 个接口的唯一客户端清单。
- 每项包含 method、path 和鉴权属性，领域函数基于该清单发起请求。
- 覆盖测试对比客户端清单和 mock server 路由，防止接口遗漏。
- UI 映射维护在 `docs/product.md`。

## 样式组织

- `_tokens.scss` 仅定义颜色、尺寸、层级与断点。
- `_utilities.scss` 提供有限的布局、间距、文本和显示原子类。
- 页面与复杂组件使用同名 SCSS 模块，避免深层选择器。
- 禁止运行时拼接任意样式值；课程颜色通过有限状态类映射。

## 代码风格

- 格式化由 Prettier 负责。

## 测试策略

- 单元测试：首页日期标题、周次计算、连续课程合并、课程时间状态、倒计时接口调用、响应解析与格式化。
- 组件测试：今日/明日切换、默认明日、课程状态卡、后端倒计时各状态、校园网正常/锁定/欠费组合、区块级骨架与错误重试、缓存数据保留、下拉刷新阈值与手势避让、鉴权门禁和表单校验。
- 接口覆盖测试：客户端 62 项与 mock server 62 项逐一匹配。
- E2E：匿名首页同构布局与零受保护请求、公开校历完整日期网格、登录、首页课程状态与切换、下拉刷新、独立接口失败隔离、周课表网格与课程详情、服务查询、错误恢复和窄屏无溢出。
- 课表页先用 `groupCourseSessions` 按除节次 `time` 外的全部课程字段建立身份，只有身份一致且节次连续的记录才合并为跨行网格块；地点、教师、周次或其他字段变化都会拆分。随后用 `stackCourseSessions` 按星期和起止节次聚合同位置课程，并以当前查看周是否上课作为主课程排序依据。课程栈只统计 `weeks` 包含当前查看周的会话，并在实际冲突时用“在上课程数减一”得到左下角无背景 `+N` 标记；右下角折角仍表示该位置存在课程栈，完整课程总数继续写入按钮无障碍名称。课表颜色映射基于完整学期课程集合构建：非自定义课程名去重排序在前，自定义课程名去重排序在后，再按索引循环使用调色板，因此切周不改变颜色且同名课程始终同色。课表区域用触摸起止坐标识别横向手势，位移超过 `48px` 且横向位移至少为纵向的 `1.25` 倍时按方向切周；首末周复用按钮边界，识别到多指时取消本次手势，识别到有效滑动后抑制随后的课程点击。容器存在横向溢出时不启用切周手势，交由原生滚动处理。详情弹窗使用不带关闭按钮的 `course-detail` Modal 变体和横向 scroll-snap 卡片轨道，轨道透明空白点击转发 `onClose`，Esc 沿用原生 `cancel` 路径，纵向内边距为卡片阴影保留安全空间。卡片自身通过 `overflow-y: auto` 容纳完整长备注，同时定义标准与 WebKit 细滚动条，并通过 `background-attachment: local/scroll` 实现随滚动位置变化的边缘阴影。非本周详情使用等 RGB 分量的 `$course-detail-inactive-background`，视觉正文不重复状态文案，`aria-label` 继续提供周次状态。页面测试固定校验星期列、跨节定位、切周横滑与竖滑排除、冲突课程优先级、`+N` 数量与左下角定位、异周课程不显示 `+N`、字段不一致时不合并、折角、非本周状态、详情卡尺寸与紧凑间距、真实纵向触摸滚动、滚动指示、横向吸附、焦点进入与恢复、阴影留白、遮罩关闭及下一张露出，避免视觉调整破坏课程语义。
- 课程格通过固定 `74px` 网格行和按跨度确定的卡片高度承载文本；课程名固定为 `11px`，地点、“非本周”和冲突数量固定为 `9px`。单节与多节课程格使用相同的纵向内边距和字段间距，单节课程名称最多两行、地点一行，单节非本周卡将名称收紧为一行以继续容纳状态文字，多节卡名称最多五行、地点最多两行。名称与地点均使用独立的 overflow/ellipsis；课程文字与底色对比度不得低于 `4.5:1`。E2E 必须验证字号、两种高度的顶部基线一致、真实 `scrollHeight > clientHeight`、行数边界、颜色对比度、无文本重叠及双移动视口截图。
- 视觉检查：`375x812`、`390x844`，同时检查底部安全区与键盘焦点。

## 本地开发

```bash
npm install
npm run dev
```

根脚本并行启动前端与 mock server。默认地址：

- 前端：`http://127.0.0.1:5173`
- Mock API：`http://127.0.0.1:3100`

## 约定

- 日期与数字通过 `Intl` 格式化。
- 异步页面不返回纯白屏。
- 表单提交期间禁用重复提交，错误显示在对应字段或页面中。
- 新增接口时必须同步更新 endpoint 清单、领域 API、UI 映射和覆盖测试。
