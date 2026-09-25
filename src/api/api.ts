import { request, requestBlob, toQuery } from "./client";
import type {
  About,
  AuthTokens,
  CaRank,
  CardInfo,
  CardRecords,
  Course,
  CustomCourseRequest,
  CustomExamRequest,
  Dorm,
  EmptyRoom,
  Exam,
  ExchangedGoods,
  ExtraCourse,
  FeedbackList,
  Goods,
  Grade,
  GradeDetail,
  GymAppointment,
  GymGrade,
  IndexCardSetting,
  LabGrade,
  LabSchedule,
  LoginRequest,
  Me,
  Netflow,
  NetflowDetail,
  NetflowOrder,
  NoticeList,
  PointRecords,
  Points,
  Rank,
  Semester,
  Settings,
  TableSetting,
} from "./types";

function encodePassword(password: string) {
  const bytes = new TextEncoder().encode(password);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

export const api = {
  system: {
    health: () => request<{ hello: string }>("/", { auth: false }),
    about: () => request<About>("/about", { auth: false }),
  },
  auth: {
    login: (input: LoginRequest) =>
      request<AuthTokens>("/auth/login", {
        method: "POST",
        auth: false,
        body: { ...input, password: encodePassword(input.password) },
      }),
    refresh: (refreshToken: string) =>
      request<AuthTokens>("/auth/refresh", {
        method: "POST",
        auth: false,
        body: { refresh_token: refreshToken },
      }),
    sendTfa: () => request<void>("/auth/tfa"),
    verifyTfa: (code: string) => request<void>("/auth/tfa", { method: "POST", body: { code } }),
    unbind: () => request<void>("/auth/unbind", { method: "POST" }),
  },
  me: {
    get: () => request<Me>("/me"),
    settings: () => request<Settings>("/me/setting"),
    setting: <T extends IndexCardSetting | TableSetting>(type: "index_card" | "table") =>
      request<T>(`/me/setting/${type}`),
    updateSetting: <T extends IndexCardSetting | TableSetting>(
      type: "index_card" | "table",
      value: T,
    ) => request<T>(`/me/setting/${type}`, { method: "PUT", body: value }),
  },
  card: {
    info: () => request<CardInfo>("/card/info"),
    records: (year: number, month: number, type: "consumption" | "recharge" = "consumption") =>
      request<CardRecords>(`/card/record${toQuery({ year, month, type })}`),
  },
  rank: {
    school: (year: number, term: string) =>
      request<Rank>(
        `/rank${toQuery({ xn: year, xq: term, range: "major", data_source: "total", display: "max" })}`,
      ),
    ca: () => request<CaRank | null>("/rank/ca"),
    refreshCa: () => request<void>("/rank/ca", { method: "PUT" }),
  },
  course: {
    table: (year: number, term: string) =>
      request<Course[]>(`/classtable${toQuery({ xn: year, xq: term })}`),
    extra: (year: number, term: string) =>
      request<ExtraCourse[]>(`/course/extra${toQuery({ xn: year, xq: term })}`),
    create: (year: number, term: string, course: CustomCourseRequest) =>
      request<void>("/course/custom", { method: "POST", body: { xn: year, xq: term, course } }),
    update: (id: number, course: CustomCourseRequest) =>
      request<void>(`/course/custom/${id}`, { method: "PUT", body: course }),
    remove: (id: number) => request<void>(`/course/custom/${id}`, { method: "DELETE" }),
  },
  semester: {
    get: (...args: [] | [year: number, term: string]) => {
      const [year, term] = args;
      return request<Semester>(`/semester${toQuery({ xn: year, xq: term })}`);
    },
  },
  points: {
    summary: () => request<Points>("/jifen"),
    checkIn: () => request<{ delta: number }>("/jifen", { method: "POST" }),
    records: (page = 1, size = 20) =>
      request<PointRecords>(`/jifen/record${toQuery({ page, size })}`),
    description: () => request<{ description: string }>("/jifen/desc"),
    goods: () => request<Goods[]>("/jifen/goods"),
    exchange: (id: number) => request<void>(`/jifen/goods/${id}`, { method: "POST" }),
    exchanged: () => request<ExchangedGoods[]>("/jifen/goods/exchanged"),
  },
  email: {
    unread: () => request<{ count: number }>("/email"),
  },
  dorm: {
    info: () => request<Dorm>("/dorm"),
    refresh: () => request<void>("/dorm", { method: "PUT" }),
    electricity: () => request<{ balance: string }>("/dorm/electricity"),
    refreshElectricity: () => request<void>("/dorm/electricity", { method: "PUT" }),
  },
  grade: {
    list: (year: number, term: string) =>
      request<Grade[]>(`/grade${toQuery({ xn: year, xq: term })}`),
    detail: (id: string) => request<GradeDetail[]>(`/grade/${encodeURIComponent(id)}`),
  },
  network: {
    summary: () => request<Netflow>("/netflow"),
    orders: () => request<NetflowOrder[]>("/netflow/order"),
    detail: (year: number, month: number, day?: number) =>
      request<NetflowDetail>(`/netflow/detail${toQuery({ year, month, day })}`),
  },
  announcement: {
    list: () => request<import("./types").Announcement[]>("/announcement"),
  },
  exam: {
    list: () => request<Exam[]>("/exam"),
    create: (input: CustomExamRequest) => request<void>("/exam", { method: "POST", body: input }),
    update: (id: number, input: CustomExamRequest) =>
      request<void>(`/exam/${id}`, { method: "PUT", body: input }),
    remove: (id: number) => request<void>(`/exam/${id}`, { method: "DELETE" }),
  },
  feedback: {
    list: (page = 1, size = 20) => request<FeedbackList>(`/feedback${toQuery({ page, size })}`),
    create: (input: { contact: string | null; description: string; img: string | null }) =>
      request<void>("/feedback", { method: "POST", body: input }),
    createPublic: (input: { contact: string; description: string; stu_id: string }) =>
      request<void>("/feedback/no_auth", { method: "POST", auth: false, body: input }),
  },
  image: {
    upload: (file: File) => {
      const body = new FormData();
      body.append("img", file);
      return request<{ id: string }>("/img/feedback", { method: "POST", body });
    },
    get: (id: string) => requestBlob(`/img/${encodeURIComponent(id)}`),
  },
  gym: {
    grade: (year: number) => request<GymGrade>(`/gym/grade${toQuery({ xn: year })}`),
    appointments: () => request<GymAppointment[]>("/gym/appointment"),
  },
  lab: {
    bind: (password: string) =>
      request<void>("/lab/bind", { method: "POST", body: new URLSearchParams({ password }) }),
    schedule: () => request<LabSchedule[]>("/lab/schedule"),
    grade: (year: number, term: string) =>
      request<LabGrade>(`/lab/grade${toQuery({ xn: year, xq: term })}`),
  },
  notice: {
    list: (status = "all", page = 1, size = 20) =>
      request<NoticeList>(`/notice${toQuery({ status, page, size })}`),
    read: (id: number) => request<void>(`/notice/${id}`, { method: "PUT" }),
  },
  room: {
    empty: (buildingId: string, time: string, date: string) =>
      request<EmptyRoom[]>(`/empty_room${toQuery({ building_id: buildingId, time, date })}`),
  },
};
