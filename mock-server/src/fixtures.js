const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const teachingWeeks = Array.from({ length: 16 }, (_, index) => index + 1);
const dayMs = 86_400_000;
const reliableBuildingIds = new Set(["302", "102", "123", "122", "201", "202", "203", "204"]);
const northCampusBuildingIds = new Set([
  "201",
  "202",
  "203",
  "204",
  "W1348a6d0000WH",
  "W134634f0000WH",
]);

const buildingFixture = (building_id, building_name) => {
  const description = [
    northCampusBuildingIds.has(building_id) ? "北校区" : null,
    reliableBuildingIds.has(building_id) ? null : "可能无法查询到数据",
  ]
    .filter(Boolean)
    .join(" · ");
  return { building_id, building_name, description: description || null };
};

const addCalendarDays = (value, days) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + days * dayMs);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};

const chineseDate = (value) => {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}年${month}月${day}日`;
};

const chineseDateRange = (from, to) => {
  const [fromYear] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const formattedTo = fromYear === toYear ? `${toMonth}月${toDay}日` : chineseDate(to);
  return `${chineseDate(from)}至${formattedTo}`;
};

const createAcademicCalendar = ({
  idBase,
  xn,
  fallStart,
  winterStart,
  springStart,
  summerStart,
  militaryStart,
  militaryEnd,
  springFestival,
}) => {
  const academicYear = `${xn} - ${xn + 1} 学年`;
  const fallEnd = addCalendarDays(fallStart, 18 * 7 - 1);
  const winterEnd = addCalendarDays(winterStart, 5 * 7 - 1);
  const springEnd = addCalendarDays(springStart, 20 * 7 - 1);
  const summerEnd = addCalendarDays(summerStart, 6 * 7 - 1);
  const period = ({ id, name, from, to, prev = [], notes }) => ({
    id,
    name,
    detail: {
      from,
      to,
      name: `${academicYear} ${name}`,
      prev,
      notes,
    },
  });

  return {
    xn: academicYear,
    periods: [
      period({
        id: idBase,
        name: "秋季学期",
        from: fallStart,
        to: fallEnd,
        prev: [
          { index: -2, name: "夏9" },
          { index: -1, name: "夏10" },
        ],
        notes: [
          {
            key: "学期安排",
            value: `${chineseDateRange(fallStart, fallEnd)}，共18周。`,
          },
          {
            key: "期末考试",
            value: "第17、18周，其中第18周为新生期末考试。",
          },
          {
            key: "选课安排",
            value: "全体学生分批选课：夏季学期第9周。",
          },
          {
            key: "开课安排",
            value: `${xn}级新生开课：夏季学期第10周；其他年级学生开课：秋季学期第1周。`,
          },
          {
            key: "新生军训",
            value: `${chineseDateRange(militaryStart, militaryEnd)}。`,
          },
        ],
      }),
      period({
        id: idBase + 1,
        name: "寒假",
        from: winterStart,
        to: winterEnd,
        notes: [
          {
            key: "放假安排",
            value: `${chineseDateRange(winterStart, winterEnd)}为寒假。`,
          },
          {
            key: "春节",
            value: `${chineseDate(springFestival)}。`,
          },
        ],
      }),
      period({
        id: idBase + 2,
        name: "春季学期",
        from: springStart,
        to: springEnd,
        notes: [
          {
            key: "学期安排",
            value: `${chineseDateRange(springStart, springEnd)}，共20周。`,
          },
          {
            key: "期末考试",
            value: "第17、18周。",
          },
          {
            key: "实践教学",
            value: "第19、20周各学院根据专业培养方案自行安排实习、实践类教学任务。",
          },
        ],
      }),
      period({
        id: idBase + 3,
        name: "暑假",
        from: summerStart,
        to: summerEnd,
        notes: [
          {
            key: "放假安排",
            value: `${chineseDateRange(summerStart, summerEnd)}为暑假。`,
          },
        ],
      }),
    ],
  };
};

const examReferenceParts = Object.fromEntries(
  new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(new Date())
    .filter(({ type }) => type !== "literal")
    .map(({ type, value }) => [type, value]),
);
const examReferenceMinute =
  Number(examReferenceParts.hour) * 60 + Number(examReferenceParts.minute);
const examTime = (minute) =>
  `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
const examDate = (dayOffset) => {
  const date = new Date(
    Date.UTC(
      Number(examReferenceParts.year),
      Number(examReferenceParts.month) - 1,
      Number(examReferenceParts.day) + dayOffset,
    ),
  );
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
};
const activeExamStart = examTime(Math.max(0, examReferenceMinute - 30));
const activeExamEnd = examTime(Math.min(23 * 60 + 59, examReferenceMinute + 90));

const courseSession = ({ periods, ...course }) =>
  periods.map((time) => ({
    class_name: "计科2201",
    course_type: "专业核心",
    credit: 3,
    weeks: teachingWeeks,
    extra: null,
    area: "南校区",
    people: 40,
    customize_id: null,
    ...course,
    time,
  }));

export const ok = (data) => (data === undefined ? { code: "OK" } : { code: "OK", data });

export const state = {
  settings: {
    index_card: {
      version: 1,
      setting: { cards: ["jifen", "course", "tasks", "electricity", "campus", "email"] },
    },
    table: { version: 1, setting: { display_not_current_week_courses: true } },
  },
  customCourses: [],
  buildingPreferences: {
    105: { favorite: false, last_query_at: "2026-10-05T18:10:00+08:00" },
    106: { favorite: true, last_query_at: null },
    302: { favorite: false, last_query_at: null },
    W13415380000WI: { favorite: false, last_query_at: "2026-10-04T14:35:00+08:00" },
    W1343cab0000WH: { favorite: false, last_query_at: "2026-10-03T09:20:00+08:00" },
    W134b2a60000WH: { favorite: true, last_query_at: null },
  },
  exams: [
    {
      course_id: "COMP1001",
      course_name: "数据结构",
      area: "南校区（天马）",
      classroom: "综101",
      date: examDate(-2),
      start_time: "09:00",
      end_time: "11:00",
      seat: "42",
      customize_id: null,
      invalid: false,
    },
    {
      course_id: null,
      course_name: "专业能力模拟考试",
      area: "南校区",
      classroom: "综合楼203",
      date: examDate(-3),
      start_time: "14:00",
      end_time: "16:00",
      seat: "12",
      customize_id: 91,
      invalid: false,
    },
    {
      course_id: "COMP3013",
      course_name: "编译原理",
      area: "南校区",
      classroom: "信息科学与工程学院实验中心东区综合楼208",
      date: examDate(-5),
      start_time: "09:00",
      end_time: "11:00",
      seat: "26",
      customize_id: null,
      invalid: false,
    },
    {
      course_id: "COMP3012",
      course_name: "人工智能导论与机器学习模型设计综合考试",
      area: "南校区",
      classroom: "综合楼210",
      date: examDate(-4),
      start_time: "14:00",
      end_time: "16:00",
      seat: "35",
      customize_id: null,
      invalid: false,
    },
    ...Array.from({ length: 7 }, (_, index) => ({
      course_id: `HISTORY${String(index + 1).padStart(2, "0")}`,
      course_name: `历史考试安排 ${index + 1}`,
      area: index % 2 === 0 ? "南校区" : "北校区",
      classroom: `综合楼${220 + index}`,
      date: examDate(-(6 + index)),
      start_time: index % 2 === 0 ? "09:00" : "14:00",
      end_time: index % 2 === 0 ? "11:00" : "16:00",
      seat: String(40 + index),
      customize_id: null,
      invalid: false,
    })),
    {
      course_id: "COMP2001",
      course_name: "操作系统",
      area: "南校区（天马）",
      classroom: "综212",
      date: examDate(-1),
      start_time: "14:00",
      end_time: "16:00",
      seat: "18",
      customize_id: null,
      invalid: true,
    },
    {
      course_id: "COMP2003",
      course_name: "计算机网络",
      area: "南校区",
      classroom: "研究生楼B301",
      date: examDate(0),
      start_time: activeExamStart,
      end_time: activeExamEnd,
      seat: "07",
      customize_id: null,
      invalid: false,
    },
    {
      course_id: "COMP2004",
      course_name: "数据库系统",
      area: "南校区",
      classroom: "综合楼205",
      date: examDate(0),
      start_time: activeExamStart,
      end_time: activeExamEnd,
      seat: "31",
      customize_id: null,
      invalid: true,
    },
    {
      course_id: null,
      course_name: "竞赛选拔模拟考试",
      area: "南校区",
      classroom: "综合楼205",
      date: examDate(1),
      start_time: "14:30",
      end_time: "16:30",
      seat: "08",
      customize_id: 92,
      invalid: false,
    },
    {
      course_id: "MATH2001",
      course_name: "离散数学",
      area: "南校区",
      classroom: "复临舍201",
      date: examDate(2),
      start_time: "19:00",
      end_time: "21:00",
      seat: "56",
      customize_id: null,
      invalid: false,
    },
    {
      course_id: "COMP2010",
      course_name: "跨平台软件工程与云原生分布式系统设计综合考试",
      area: "北校区",
      classroom: "新校区第二教学实验综合楼北区302考场",
      date: examDate(3),
      start_time: "09:00",
      end_time: "11:00",
      seat: "24",
      customize_id: null,
      invalid: true,
    },
  ],
  feedback: [
    {
      id: 81,
      contact: "student@example.edu.cn",
      description: "课表中的教学楼名称显示不完整，希望详情中保留完整地址。",
      img: "feedback-demo",
      status: "resolved",
      replies: [
        {
          msg: "已优化长地点名称的换行显示，请刷新后查看。",
          created_at: "2026-09-21 16:30:00",
          stu_id: "系统支持",
        },
      ],
      created_at: "2026-09-21 10:20:00",
      updated_at: "2026-09-21 16:30:00",
    },
  ],
  exchangedGoods: [
    {
      id: 1,
      goods_name: "校园文创笔记本",
      goods_cover: "https://placehold.co/50",
      goods_description: "微生活纪念品",
      created_at: "2026-09-20 12:00:00",
      receive_time: null,
    },
  ],
  notices: [
    {
      id: 1,
      content: "欢迎使用微生活。",
      status: "unread",
      url: null,
      created_at: now(),
    },
    {
      id: 2,
      content: "本周五晚校园网将进行例行维护。",
      status: "read",
      url: "https://qnxg.cn",
      created_at: "2026-09-20 18:00:00",
    },
  ],
  checkedIn: false,
  points: 860,
  nextId: 100,
};

export const fixtures = {
  semesterTable: {
    items: [
      {
        xn: 2026,
        xq: 1,
        xq_text: "秋季学期",
        start: "2026-09-13",
        weeks: 16,
        from_zero: false,
      },
      {
        xn: 2025,
        xq: 4,
        xq_text: "夏季学期",
        start: "2026-06-28",
        weeks: 8,
        from_zero: false,
      },
      {
        xn: 2025,
        xq: 3,
        xq_text: "春季学期",
        start: "2026-02-22",
        weeks: 16,
        from_zero: false,
      },
      {
        xn: 2025,
        xq: 2,
        xq_text: "冬季学期",
        start: "2026-01-04",
        weeks: 6,
        from_zero: false,
      },
      {
        xn: 2025,
        xq: 1,
        xq_text: "秋季学期",
        start: "2025-09-14",
        weeks: 16,
        from_zero: false,
      },
      {
        xn: 2024,
        xq: 4,
        xq_text: "夏季学期",
        start: "2025-06-29",
        weeks: 8,
        from_zero: false,
      },
    ],
    now_xn: 2026,
    now_xq: 1,
  },
  academicCalendars: [
    createAcademicCalendar({
      idBase: 1,
      xn: 2026,
      fallStart: "2026-09-13",
      winterStart: "2027-01-17",
      springStart: "2027-02-21",
      summerStart: "2027-07-11",
      militaryStart: "2026-10-12",
      militaryEnd: "2026-10-25",
      springFestival: "2027-02-06",
    }),
    createAcademicCalendar({
      idBase: 5,
      xn: 2025,
      fallStart: "2025-09-14",
      winterStart: "2026-01-18",
      springStart: "2026-02-22",
      summerStart: "2026-07-12",
      militaryStart: "2025-10-13",
      militaryEnd: "2025-10-26",
      springFestival: "2026-02-17",
    }),
  ],
  buildings: [
    buildingFixture("106", "综合楼"),
    buildingFixture("302", "研究生楼"),
    buildingFixture("102", "复临舍"),
    buildingFixture("123", "中楼"),
    buildingFixture("122", "东楼"),
    buildingFixture("201", "梯教"),
    buildingFixture("202", "二教楼"),
    buildingFixture("203", "电子楼"),
    buildingFixture("204", "水上教学楼"),
    buildingFixture("W134b2a60000WH", "综合楼机房"),
    buildingFixture("117", "南楼"),
    buildingFixture("121", "北楼"),
    buildingFixture("W13463510000WH", "二院"),
    buildingFixture("W1343d740000WH", "天马园区排练厅"),
    buildingFixture("W134153a0000WJ", "物理院楼"),
    buildingFixture("W134153a0000WK", "数学院楼"),
    buildingFixture("W13463550000WH", "生物院楼"),
    buildingFixture("132", "工训中心"),
    buildingFixture("W1343be60000WH", "工训中心B栋"),
    buildingFixture("W1343cb40000WH", "工训中心C栋"),
    buildingFixture("W1343dd90000WJ", "工训中心D栋"),
    buildingFixture("W1343dd90000WH", "工训中心E栋"),
    buildingFixture("W1343dd90000WI", "工训中心F栋"),
    buildingFixture("115", "工管院院楼"),
    buildingFixture("105", "信科院院楼(软件大楼)"),
    buildingFixture("125", "法学楼"),
    buildingFixture("129", "机械院院楼"),
    buildingFixture("130", "电气院院楼"),
    buildingFixture("131", "建筑学院"),
    buildingFixture("W134153a0000WH", "生物院U型楼"),
    buildingFixture("W134153a0000WI", "岳麓书院"),
    buildingFixture("W134153a0000WL", "材料院楼"),
    buildingFixture("W134153a0000WM", "外语院楼"),
    buildingFixture("W134153a0000WN", "土木院楼"),
    buildingFixture("W1348a680000WH", "公共管理学院楼"),
    buildingFixture("W1348ab90000WH", "马院院楼"),
    buildingFixture("W13415380000WH", "环境馆"),
    buildingFixture("W13415380000WI", "培训小楼(文学院)"),
    buildingFixture("127", "继教综合楼"),
    buildingFixture("128", "工程实验大楼"),
    buildingFixture("133", "逸夫楼"),
    buildingFixture("W13416c50000WH", "化学实验中心"),
    buildingFixture("101", "办公楼"),
    buildingFixture("134", "南校区图书馆"),
    buildingFixture("135", "桃子湖教学区"),
    buildingFixture("W13414dd0000WH", "四合院子"),
    buildingFixture("W1343be60000WI", "麓谷湖大科技园"),
    buildingFixture("W1343cab0000WH", "校外实验实践场所"),
    buildingFixture("W1348a6d0000WH", "经贸大楼"),
    buildingFixture("W134634f0000WH", "财院校区排练厅"),
    buildingFixture("W13463550000WI", "中四栋"),
    buildingFixture("W13417fe0000WH", "艺术教育中心"),
    buildingFixture("126", "南校区体育馆"),
  ],
  holidays: [
    { name: "元旦", start: "2026-01-01", end: "2026-01-03" },
    { name: "春节", start: "2026-02-15", end: "2026-02-23" },
    { name: "清明节", start: "2026-04-04", end: "2026-04-06" },
    { name: "劳动节", start: "2026-05-01", end: "2026-05-05" },
    { name: "端午节", start: "2026-06-19", end: "2026-06-21" },
    { name: "中秋节", start: "2026-09-25", end: "2026-09-27" },
    { name: "国庆节", start: "2026-10-01", end: "2026-10-07" },
  ],
  me: {
    class: "计算机2201班",
    name: "张同学",
    major: "计算机科学与技术",
    enter: 2022,
    college: "信息科学与工程学院",
    sex: "男",
    xz: 4,
    stu_id: "202208010101",
  },
  cardInfo: { id: 123456, balance: 86.5 },
  cardRecords: {
    total: -21.5,
    count: 2,
    records: [
      {
        amount: -14.5,
        date_time: "2026-09-21 12:08:00",
        id: 100001,
        journal_time: "2026-09-21 12:08:02",
        location: "天马学生食堂",
        name: "食堂消费",
        now_balance: 86.5,
        status: "正常",
      },
      {
        amount: -7,
        date_time: "2026-09-20 18:16:00",
        id: 100002,
        journal_time: "2026-09-20 18:16:01",
        location: "校园超市",
        name: "超市消费",
        now_balance: 101,
        status: "正常",
      },
    ],
  },
  rank: {
    all: {
      arithmetic: "88.20",
      arithmetic_rank: "8/120",
      weighted: "89.10",
      weighted_rank: "6/120",
      gpa: "3.8",
      gpa_rank: "5/120",
    },
    compulsory: {
      arithmetic: "89.40",
      arithmetic_rank: "5/120",
      weighted: "90.10",
      weighted_rank: "4/120",
      gpa: "3.9",
      gpa_rank: "3/120",
    },
    core: {
      arithmetic: "90.00",
      arithmetic_rank: "3/120",
      weighted: "91.20",
      weighted_rank: "2/120",
      gpa: "4.0",
      gpa_rank: "2/120",
    },
  },
  courses: [
    ...courseSession({
      course_name: "设计思维",
      course_id: "GENERAL1001",
      course_type: "通识选修",
      credit: 2,
      day: 0,
      periods: [9, 10],
      place: "综301",
      teacher: "周老师",
      weeks: [2, 4, 6, 8, 10, 12, 14, 16],
    }),
    ...courseSession({
      course_name: "数字媒体基础",
      course_id: "GENERAL1002",
      course_type: "通识选修",
      credit: 2,
      day: 0,
      periods: [9, 10],
      place: "综302",
      teacher: "袁老师",
      weeks: [1, 3, 5, 7, 9, 11, 13, 15],
    }),
    ...courseSession({
      course_name: "数据结构",
      course_id: "COMP1001",
      day: 1,
      periods: [1, 2, 3],
      place: "综101",
      teacher: "李老师",
    }),
    ...courseSession({
      course_name: "分布式系统",
      course_id: "COMP3101",
      course_type: "专业核心",
      day: 1,
      periods: [5, 6],
      place: "综101",
      teacher: "何老师",
      weeks: [1, 2],
    }),
    ...courseSession({
      course_name: "分布式系统",
      course_id: "COMP3101",
      course_type: "专业核心",
      day: 1,
      periods: [5, 6],
      place: "综102",
      teacher: "何老师",
      weeks: [3, 4],
    }),
    ...courseSession({
      course_name: "云原生系统实践",
      course_id: "COMP3102",
      course_type: "实践课程",
      credit: 2,
      day: 1,
      periods: [5, 6],
      place: "综103",
      teacher: "吴老师",
      weeks: [5, 6],
    }),
    ...courseSession({
      course_name: "计算机网络",
      course_id: "COMP2003",
      day: 2,
      periods: [1, 2],
      extra: "携带实验手册",
      place: "信科楼 201",
      people: 42,
      teacher: "陈老师",
    }),
    ...courseSession({
      course_name: "软件工程",
      course_id: "COMP2010",
      course_type: "专业必修",
      credit: 2.5,
      day: 2,
      periods: [5],
      place: "复临舍 305",
      people: 38,
      teacher: "刘老师",
    }),
    ...courseSession({
      course_name: "跨学科软件工程综合创新实践与复杂系统设计",
      course_id: "LONG1001",
      course_type: "综合实践",
      credit: 1,
      day: 2,
      periods: [11],
      place: "信息科学与工程学院实验中心东区超长名称教学机房A204",
      teacher: "测试老师",
      weeks: [2],
    }),
    ...courseSession({
      course_name: "算法设计与分析",
      course_id: "COMP3011",
      day: 3,
      periods: [1, 2],
      place: "综213",
      teacher: "陈长建",
    }),
    ...courseSession({
      course_name: "编译原理",
      course_id: "COMP3013",
      day: 3,
      periods: [3, 4],
      weeks: [1, 3, 5, 7, 9, 11, 13, 15],
      place: "综212",
      teacher: "蒋老师",
    }),
    ...courseSession({
      course_name: "程序设计方法",
      course_id: "COMP3014",
      day: 3,
      periods: [3, 4],
      extra: [
        "请在课前完成课程平台中的预习任务，并携带已经安装好开发环境的笔记本电脑、充电器和实验记录本。",
        "课堂将连续完成需求分析、结对编程、代码评审和测试复盘，中途需要根据教师反馈多次修改提交内容。",
        "课程结束前请将源代码、运行截图、测试报告和个人总结统一上传到指定目录，文件名必须包含学号、姓名和班级。",
        "如需请假或设备无法正常使用，请至少提前一天联系助教说明情况，并在下一次上课前补齐全部课堂任务。",
      ].join(""),
      weeks: [2, 4, 6, 8, 10, 12, 14, 16],
      place: "综214",
      teacher: "郑老师",
    }),
    ...courseSession({
      course_name: "操作系统",
      course_id: "COMP2001",
      day: 3,
      periods: [5, 6],
      place: "中202",
      teacher: "陈浩",
    }),
    ...courseSession({
      course_name: "移动应用开发实践",
      course_id: "COMP3020",
      day: 3,
      periods: [7, 8],
      place: "信息科学与工程学院实验中心 A204",
      teacher: "王老师",
    }),
    ...courseSession({
      course_name: "人工智能导论",
      course_id: "COMP3012",
      course_type: "专业选修",
      credit: 2,
      day: 3,
      periods: [9, 10],
      extra: "每周三、周五上课",
      place: "综合楼 402",
      people: 56,
      teacher: "周老师",
    }),
    ...courseSession({
      course_name: "面向复杂业务场景的软件架构设计与工程实践",
      course_id: "LONG1002",
      course_type: "综合实践",
      credit: 2,
      day: 5,
      periods: [11, 12],
      place: "综合教学楼南栋智慧教室与远程协作实验中心B区405",
      teacher: "测试老师",
    }),
    ...courseSession({
      course_name: "数据库系统",
      course_id: "COMP2004",
      day: 4,
      periods: [3, 4],
      place: "综105",
      teacher: "唐老师",
    }),
    ...courseSession({
      course_name: "数据库系统实验",
      course_id: "COMP2006",
      course_type: "实践课程",
      credit: 1,
      day: 4,
      periods: [3, 4],
      place: "实验楼205",
      teacher: "唐老师",
      weeks: [2, 4, 6, 8, 10, 12, 14, 16],
    }),
    ...courseSession({
      course_name: "计算机组成原理",
      course_id: "COMP2005",
      day: 4,
      periods: [7, 8],
      place: "中楼201",
      teacher: "赵老师",
    }),
    ...courseSession({
      course_name: "离散数学",
      course_id: "MATH2001",
      course_type: "学科基础",
      day: 5,
      periods: [1, 2],
      place: "研楼B103",
      teacher: "孙老师",
      weeks: [1, 3, 5, 7, 9, 11, 13, 15],
    }),
    ...courseSession({
      course_name: "人工智能导论",
      course_id: "COMP3012",
      course_type: "专业选修",
      credit: 2,
      day: 5,
      periods: [9, 10],
      extra: "每周三、周五上课",
      place: "综合楼 402",
      people: 56,
      teacher: "周老师",
    }),
    ...courseSession({
      course_name: "创新创业实践",
      course_id: "INNO1001",
      course_type: "实践课程",
      credit: 1,
      day: 6,
      periods: [3, 4],
      extra: "前两节理论，第三节实践",
      place: "综203",
      teacher: "何老师",
    }),
    ...courseSession({
      course_name: "创新创业实践",
      course_id: "INNO1001",
      course_type: "实践课程",
      credit: 1,
      day: 6,
      periods: [5],
      extra: "前两节理论，第三节实践",
      place: "综405",
      teacher: "何老师",
    }),
  ],
  extraCourses: [
    {
      course_id: "COMP2002",
      course_name: "工程实践",
      class_name: "计科2201",
      course_type: "专业选修",
      credit: 1,
      extra: null,
      area: "南校区",
      people: 30,
      teacher: "王老师",
    },
    {
      course_id: "GENERAL2003",
      course_name: "学术写作专题",
      class_name: "全校选修班",
      course_type: "通识选修",
      credit: 2,
      extra:
        "本课程暂无固定上课时间，请加入课程通知群并持续关注课程平台公告。任课教师会根据专题进度安排线上阅读、分组讨论、资料检索、校外访谈和集中研讨，具体日期、教室、参与方式及所需材料将至少提前三天通知。每次活动前请完成指定文献阅读并提交问题清单，活动结束后还需在规定时间内上传讨论记录、阶段报告和个人反思。如遇时间或地点临时调整，请以课程平台最新公告为准；未收到通知时不要自行前往教室，并及时联系任课教师确认后续安排。课程平台会保留历史通知，但请不要只依赖截图或同学转发的消息，以免遗漏后续修订内容。若因课程冲突无法参加集中研讨，应提前提交请假说明，并按照教师要求完成替代任务；多次未查看公告或未按时反馈可能影响过程性评价，请合理安排学习时间。",
      area: "南校区",
      people: 45,
      teacher: "赵老师",
    },
  ],
  goods: [
    {
      id: 1,
      name: "校园文创笔记本",
      cover: "https://placehold.co/50",
      count: 20,
      price: 200,
      description: "微生活纪念品",
    },
    {
      id: 2,
      name: "校园主题帆布袋",
      cover: "https://placehold.co/50",
      count: 8,
      price: 500,
      description: "轻便耐用的校园主题帆布袋",
    },
  ],
  pointRecords: [
    { id: 1, jifen: 10, description: "签到", created_at: "2026-09-22 08:00:00" },
    { id: 2, jifen: -200, description: "兑换奖品", created_at: "2026-09-20 12:00:00" },
  ],
  grades: [
    {
      course_id: "COMP1001",
      course_name: "数据结构",
      credit: 3,
      gpa: 4,
      score: 95,
      course_type1: "必修",
      course_type2: "专业核心",
      grade_tag: null,
      grade_type: "主修",
      jx0404id: "GRADE001",
    },
    {
      course_id: "MATH1002",
      course_name: "高等数学",
      credit: 5,
      gpa: 3.7,
      score: 88,
      course_type1: "选修",
      course_type2: "公共基础",
      grade_tag: null,
      grade_type: "辅修",
      jx0404id: "GRADE002",
    },
    {
      course_id: "PHYS1001",
      course_name: "大学物理",
      credit: 4,
      gpa: 3.3,
      score: 84,
      course_type1: "必修",
      course_type2: "专业基础",
      grade_tag: "补考",
      grade_type: "主修",
      jx0404id: "GRADE003",
    },
    {
      course_id: "MATH2001",
      course_name: "离散数学",
      credit: 3,
      gpa: 3.9,
      score: 92,
      course_type1: "选修",
      course_type2: "专业课",
      grade_tag: "重修",
      grade_type: "辅修",
      jx0404id: "GRADE004",
    },
    {
      course_id: "COMP1000",
      course_name: "计算机导论",
      credit: 2,
      gpa: 3.6,
      score: 87,
      course_type1: "限选",
      course_type2: "学类核心",
      grade_tag: null,
      grade_type: "主修",
      jx0404id: "GRADE005",
    },
    {
      course_id: "ETHI1001",
      course_name: "工程伦理",
      credit: 1,
      gpa: 4,
      score: 96,
      course_type1: null,
      course_type2: "学门核心",
      grade_tag: null,
      grade_type: "主修",
      jx0404id: "GRADE006",
    },
  ],
  announcements: [
    {
      id: 1,
      title: "服务通知",
      url: null,
      content: "微生活服务正常运行。",
      created_at: "2026-09-22 08:00:00",
    },
    {
      id: 2,
      title: "校园网维护安排",
      url: "https://qnxg.cn",
      content:
        "本周五 23:00 至次日 02:00 将进行校园网例行维护。\n维护期间校园网可能短暂中断。\n请提前保存在线任务并合理安排使用。",
      created_at: "2026-09-20 18:00:00",
    },
    {
      id: 3,
      title: "使用指南",
      url: "https://qnxg.cn/guide",
      content: "查看详情。",
      created_at: "2026-09-18 10:00:00",
    },
  ],
  gymGrade: {
    grade: "良好",
    score: 88,
    report_description: "本学年体质测试已完成，耐力项目仍有提升空间。",
    report_status: "已完成",
    report_type: "年度体质健康测试",
    eye: {
      sight: {
        left: { value: "4.9", description: "正常" },
        right: { value: "5.0", description: "正常" },
      },
      mirror: {
        left: { value: "5.0", description: "矫正正常" },
        right: { value: "5.0", description: "矫正正常" },
      },
      ametropia: {
        left: { value: "-1.25D", description: "轻度近视" },
        right: { value: "-1.00D", description: "轻度近视" },
      },
    },
    short_run: { color: "green", rank: "优秀", grade: "7.1 秒", score: 90 },
    bmi: { color: "green", rank: "正常", grade: "21.2", score: 100 },
    jump: { color: "green", rank: "良好", grade: "2.35 米", score: 85 },
    pull_and_sit: { color: "green", rank: "良好", grade: "12 次", score: 82 },
    run: { color: "red", rank: "及格", grade: "4 分 05 秒", score: 72 },
    sit_and_reach: { color: "green", rank: "优秀", grade: "18.6 厘米", score: 92 },
    vc: { color: "green", rank: "良好", grade: "4200 毫升", score: 86 },
  },
  gymGradeByYear: {
    2026: {
      grade: "良好",
      score: 88,
      report_description: "本学年体质测试已完成，耐力项目仍有提升空间。",
    },
    2025: {
      grade: "良好",
      score: 85,
      report_description: "该学年体质测试已完成，力量项目仍有提升空间。",
    },
    2024: {
      grade: "及格",
      score: 78,
      report_description: "该学年体质测试已完成，建议继续保持规律锻炼。",
    },
  },
};

const rankGroupKeys = ["all", "compulsory", "core"];

export function createRandomRank(random = Math.random) {
  return Object.fromEntries(
    rankGroupKeys.map((key) => {
      const source = fixtures.rank[key];
      const mode = Math.min(3, Math.floor(random() * 4));

      if (mode === 3) return [key, null];

      return [
        key,
        {
          arithmetic: mode === 2 ? null : source.arithmetic,
          arithmetic_rank: mode === 1 ? null : source.arithmetic_rank,
          weighted: mode === 2 ? null : source.weighted,
          weighted_rank: mode === 1 ? null : source.weighted_rank,
          gpa: mode === 2 ? null : source.gpa,
          gpa_rank: mode === 1 ? null : source.gpa_rank,
        },
      ];
    }),
  );
}

export function nextId() {
  state.nextId += 1;
  return state.nextId;
}

export function timestamp() {
  return now();
}
