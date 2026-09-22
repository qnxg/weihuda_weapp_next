const now = () => new Date().toISOString().replace("T", " ").slice(0, 19);

export const ok = (data) => (data === undefined ? { code: "OK" } : { code: "OK", data });

export const state = {
  settings: {
    index_card: {
      version: 1,
      setting: { cards: ["jifen", "course", "tasks", "electricity", "campus"] },
    },
    table: { version: 1, setting: { display_not_current_week_courses: true } },
  },
  customCourses: [],
  exams: [
    {
      course_id: "COMP1001",
      course_name: "数据结构",
      area: "南校区（天马）",
      classroom: "综101",
      date: "2026-10-12",
      start_time: "09:00",
      end_time: "11:00",
      seat: "42",
      customize_id: -1,
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
      goods_cover: "https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=Minimal%20product%20photograph%20of%20a%20red%20and%20white%20university%20campus%20notebook%20on%20a%20clean%20light%20gray%20surface%2C%20realistic%20studio%20lighting%2C%20no%20text%2C%20square%20catalog%20image&image_size=square",
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
    all: { arithmetic: "88.20", arithmetic_rank: "8/120", weighted: "89.10", weighted_rank: "6/120", gpa: "3.8", gpa_rank: "5/120" },
    compulsory: { arithmetic: "89.40", arithmetic_rank: "5/120", weighted: "90.10", weighted_rank: "4/120", gpa: "3.9", gpa_rank: "3/120" },
    core: { arithmetic: "90.00", arithmetic_rank: "3/120", weighted: "91.20", weighted_rank: "2/120", gpa: "4.0", gpa_rank: "2/120" },
  },
  courses: [
    {
      course_name: "数据结构",
      course_id: "COMP1001",
      class_name: "计科2201",
      course_type: "专业核心",
      credit: 3,
      weeks: [1, 2, 3, 4, 5, 6, 7, 8],
      day: 1,
      time: 1,
      extra: null,
      area: "南校区",
      place: "综101",
      people: 40,
      teacher: "李老师",
      customize_id: null,
    },
    {
      course_name: "计算机网络",
      course_id: "COMP2003",
      class_name: "计科2201",
      course_type: "专业核心",
      credit: 3,
      weeks: [1, 2, 3, 4, 5, 6, 7, 8],
      day: 2,
      time: 2,
      extra: "携带实验手册",
      area: "南校区",
      place: "信科楼 201",
      people: 42,
      teacher: "陈老师",
      customize_id: null,
    },
    {
      course_name: "软件工程",
      course_id: "COMP2010",
      class_name: "计科2201",
      course_type: "专业必修",
      credit: 2.5,
      weeks: [2, 3, 4, 5, 6, 7, 8, 9],
      day: 2,
      time: 4,
      extra: null,
      area: "南校区",
      place: "复临舍 305",
      people: 38,
      teacher: "刘老师",
      customize_id: null,
    },
    {
      course_name: "人工智能导论",
      course_id: "COMP3012",
      class_name: "计科2201",
      course_type: "专业选修",
      credit: 2,
      weeks: [2, 4, 6, 8, 10, 12],
      day: 3,
      time: 3,
      extra: "双周上课",
      area: "南校区",
      place: "综合楼 402",
      people: 56,
      teacher: "周老师",
      customize_id: null,
    },
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
  ],
  goods: [
    { id: 1, name: "校园文创笔记本", cover: "https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=Minimal%20product%20photograph%20of%20a%20red%20and%20white%20university%20campus%20notebook%20on%20a%20clean%20light%20gray%20surface%2C%20realistic%20studio%20lighting%2C%20no%20text%2C%20square%20catalog%20image&image_size=square", count: 20, price: 200, description: "微生活纪念品" },
    { id: 2, name: "校园主题帆布袋", cover: "https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=Realistic%20studio%20product%20photograph%20of%20a%20white%20canvas%20tote%20bag%20with%20a%20small%20deep%20red%20university%20building%20motif%2C%20clean%20light%20gray%20background%2C%20no%20words%2C%20square%20catalog%20image&image_size=square", count: 8, price: 500, description: "轻便耐用的校园主题帆布袋" },
  ],
  pointRecords: [
    { id: 1, jifen: 10, description: "签到", created_at: "2026-09-22 08:00:00" },
    { id: 2, jifen: -200, description: "兑换奖品", created_at: "2026-09-20 12:00:00" },
  ],
  grades: [
    { course_id: "COMP1001", course_name: "数据结构", credit: 3, gpa: 4, score: 95, course_type1: "必修", course_type2: "专业核心", grade_tag: null, grade_type: "主修", jx0404id: "GRADE001" },
    { course_id: "MATH1002", course_name: "高等数学", credit: 5, gpa: 3.7, score: 88, course_type1: "必修", course_type2: "公共基础", grade_tag: null, grade_type: "主修", jx0404id: "GRADE002" },
  ],
  announcements: [
    { id: 1, title: "服务通知", url: null, content: "微生活服务正常运行。", created_at: "2026-09-22 08:00:00" },
    { id: 2, title: "校园网维护安排", url: "https://qnxg.cn", content: "本周五 23:00 至次日 02:00 将进行校园网例行维护。", created_at: "2026-09-20 18:00:00" },
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
    short_run: { color: "优秀", rank: "前 18%", grade: "7.1 秒", score: 90 },
    bmi: { color: "正常", rank: "正常范围", grade: "21.2", score: 100 },
    jump: { color: "良好", rank: "前 30%", grade: "2.35 米", score: 85 },
    pull_and_sit: { color: "良好", rank: "前 35%", grade: "12 次", score: 82 },
    run: { color: "及格", rank: "前 58%", grade: "4 分 05 秒", score: 72 },
    sit_and_reach: { color: "优秀", rank: "前 15%", grade: "18.6 厘米", score: 92 },
    vc: { color: "良好", rank: "前 26%", grade: "4200 毫升", score: 86 },
  },
};

export function nextId() {
  state.nextId += 1;
  return state.nextId;
}

export function timestamp() {
  return now();
}
