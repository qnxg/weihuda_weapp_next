export interface ApiEnvelope<T = undefined> {
  code: string;
  data?: T;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginRequest {
  code: string;
  stu_id: string;
  password: string;
}

export type LoginCredentials = Omit<LoginRequest, "code">;

export interface Me {
  class: string;
  name: string;
  major: string;
  enter: number;
  college: string;
  sex: string;
  xz: number | null;
  stu_id: string;
}

export type IndexCardKey =
  "jifen" | "course" | "tasks" | "electricity" | "campus" | "count_down" | "grade" | "email";

export interface IndexCardSetting {
  version: number;
  setting: { cards: IndexCardKey[] };
}

export interface TableSetting {
  version: number;
  setting: { display_not_current_week_courses: boolean };
}

export interface Settings {
  index_card_setting: IndexCardSetting;
  table_setting: TableSetting;
}

export interface CardInfo {
  id: number;
  balance: number;
}

export interface CardRecord {
  amount: number;
  date_time: string;
  id: number;
  journal_time: string;
  location: string | null;
  name: string;
  now_balance: number;
  status: string;
}

export interface CardRecords {
  total: number;
  count: number;
  records: CardRecord[];
}

export interface RankDetail {
  arithmetic: string | null;
  arithmetic_rank: string | null;
  weighted: string | null;
  weighted_rank: string | null;
  gpa: string | null;
  gpa_rank: string | null;
}

export interface Rank {
  all: RankDetail | null;
  compulsory: RankDetail | null;
  core: RankDetail | null;
}

export interface CaRank {
  updated_at: string;
  rank: Rank;
}

export interface Course {
  course_name: string;
  course_id: string | null;
  class_name: string | null;
  course_type: string | null;
  credit: number | null;
  weeks: number[];
  day: number;
  time: number;
  extra: string | null;
  area: string | null;
  place: string | null;
  people: number | null;
  teacher: string | null;
  customize_id: number | null;
}

export interface ExtraCourse {
  course_name: string;
  course_id: string;
  class_name: string;
  course_type: string;
  credit: number;
  extra: string | null;
  area: string;
  people: number;
  teacher: string;
}

export interface CustomCourseRequest {
  course_name: string;
  weeks: number[];
  day: number;
  times: number[];
  place: string | null;
  teacher: string | null;
}

export interface Semester {
  xn: number;
  xq: "spring" | "autumn" | string;
  start: string;
  weeks: number;
  from_zero: boolean;
}

export interface Points {
  jifen: number;
  combo: number;
  is_checked: boolean;
}

export interface PointRecord {
  id: number;
  jifen: number;
  description: string;
  created_at: string;
}

export interface PointRecords {
  total: number;
  records: PointRecord[];
}

export interface Goods {
  id: number;
  name: string;
  cover: string;
  count: number;
  price: number;
  description: string | null;
}

export interface ExchangedGoods {
  id: number;
  goods_name: string;
  goods_cover: string;
  goods_description: string;
  created_at: string;
  receive_time: string | null;
}

export interface Dorm {
  park: string;
  build: string;
  room: string;
}

export interface Grade {
  course_id: string;
  course_name: string;
  credit: number;
  gpa: number | null;
  score: number;
  course_type1: string | null;
  course_type2: string;
  grade_tag: string | null;
  grade_type: string;
  jx0404id: string | null;
}

export interface GradeDetail {
  name: string;
  score: string;
  percentage: string;
}

export interface Netflow {
  overdue_payment: number;
  total: string;
  upload: string;
  download: string;
  base_amount: string;
  base_usage: number;
  base_percentage: number;
  extend_usage: number;
  is_locked: boolean;
}

export interface NetflowOrder {
  year: number;
  month: number;
  download: string;
  upload: string;
  over: string;
  amount: number;
  updated_at: string;
}

export interface NetflowDetailItem {
  app: string;
  total: string;
  download: string;
  upload: string;
  percentage: number;
}

export interface NetflowDetail {
  total: string;
  upload: string;
  download: string;
  items: NetflowDetailItem[];
}

export interface Announcement {
  id: number;
  title: string;
  url: string | null;
  content: string;
  created_at: string;
}

export interface Exam {
  course_id: string | null;
  course_name: string;
  area: string | null;
  classroom: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  seat: string | null;
  customize_id: number;
}

export interface CustomExamRequest {
  course_name: string;
  area: string;
  classroom: string;
  seat: string;
  date: string;
  start_time: string;
  end_time: string;
}

export interface FeedbackReply {
  msg: string;
  created_at: string;
  stu_id: string;
}

export interface Feedback {
  id: number;
  contact: string | null;
  description: string;
  img: string | null;
  created_at: string;
  updated_at: string;
  status: string;
  replies: FeedbackReply[];
}

export interface FeedbackList {
  total: number;
  items: Feedback[];
}

export interface GymMetric {
  color: string;
  rank: string;
  grade: string;
  score: number;
}

export interface EyeValue {
  value: string;
  description: string;
}

export interface EyeGradeDetail {
  left: EyeValue;
  right: EyeValue;
}

export interface GymGrade {
  grade: string;
  score: number;
  report_description: string;
  report_status: string;
  report_type: string;
  eye: {
    sight: EyeGradeDetail;
    mirror: EyeGradeDetail;
    ametropia: EyeGradeDetail;
  };
  short_run: GymMetric;
  bmi: GymMetric;
  jump: GymMetric;
  pull_and_sit: GymMetric;
  run: GymMetric;
  sit_and_reach: GymMetric;
  vc: GymMetric;
}

export interface GymAppointment {
  name: string;
  description: string;
  show_date: string;
  time: string;
  test_type: string;
  status: string;
}

export interface LabSchedule {
  seat: string;
  name: string;
  course: string;
  teacher: string;
  week: number;
  day: number;
  date_time: string;
  place: string;
  phone: string | null;
  email: string | null;
}

export interface LabGradeDetail {
  name: string;
  score: number | null;
}

export interface LabGradeItem {
  lab_name: string;
  score: string;
  attendance: string | null;
  details: LabGradeDetail[];
}

export interface LabGrade {
  course_name: string;
  course_score: string | null;
  labs: LabGradeItem[];
}

export interface Notice {
  id: number;
  content: string;
  status: string;
  url: string | null;
  created_at: string;
}

export interface NoticeList {
  count: number;
  notices: Notice[];
}

export interface EmptyRoom {
  room_name: string;
  room_type: string;
  seat_count: number;
  exam_seat_count: number;
}

export interface About {
  home: string;
  join: string;
  version: string;
  slogans: string[];
}
