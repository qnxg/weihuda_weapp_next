import { getSession, getSessionVersion, setSession } from "../auth/session";
import { getTfaChallenge, setTfaChallenge } from "../auth/tfa";
import type { ApiEnvelope, AuthTokens } from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");
let refreshPromise: Promise<AuthTokens> | null = null;
let refreshVersion: number | null = null;

const errorMessages: Record<string, string> = {
  AUTH_TOKEN_INVALID: "登录已过期，请重新登录。",
  ACCESS_TOKEN_INVALID: "登录已过期，请重新登录。",
  TOKEN_INVALID: "登录凭证无效，请重新登录。",
  TOKEN_REUSED: "登录凭证已失效，请重新登录。",
  KICK_OFF: "当前账号已在其他设备登录。",
  PASSWORD_ERROR: "学号或密码不正确，请重新输入。",
  PASSWORD_SHOULD_CHANGE: "统一身份认证要求先修改密码。",
  ACCOUNT_FROZEN: "账号暂时冻结，请 10 分钟后重试。",
  SMS_CODE_ERROR: "验证码不正确，请检查后重试。",
  TFA_EXPIRED: "验证码已过期，请重新获取。",
  VALID: "上次验证码仍在有效期内，请继续使用。",
  REPEATED_CHECK: "今天已经签到。",
  GOODS_NOT_FOUND: "奖品已下架，请刷新后重试。",
  GOODS_COUNT_NOT_ENOUGH: "奖品库存不足，请选择其他奖品。",
  JIFEN_NOT_ENOUGH: "积分不足，暂时无法兑换。",
  COURSE_NOT_FOUND: "课程不存在，列表可能已更新。",
  EXAM_SCHEDULE_NOT_FOUND: "考试安排不存在，列表可能已更新。",
  SETTING_NOT_FOUND: "未找到这项设置。",
  SETTING_CONTENT_INVALID: "设置内容不符合要求，请检查后重试。",
  NOTICE_NOT_FOUND: "通知不存在或已被删除。",
  DORM_NOT_FOUND: "未找到宿舍信息，请核对学籍信息。",
  LAB_LOGIN_FAILED: "实验平台账号或密码不正确。",
  LAB_UNAUTHORIZED: "实验平台绑定已失效，请重新绑定。",
  EMAIL_FETCH_FAILED: "暂时无法读取校内邮箱，请检查绑定状态。",
  INVALID_REQUEST: "提交的数据格式不正确。",
};

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly details?: unknown,
  ) {
    const detailMessage =
      typeof details === "string"
        ? details
        : details && typeof details === "object" && "info" in details
          ? String(details.info || "")
          : "";
    const tfaPhone =
      code === "TFA" && details && typeof details === "object" && "phone" in details
        ? `需要短信验证，验证码将发送至 ${String(details.phone)}。`
        : "";
    super(
      tfaPhone ||
        errorMessages[code] ||
        detailMessage ||
        (status >= 500 ? "服务暂时不可用，请稍后重试。" : "请求未完成，请检查后重试。"),
    );
    this.name = "ApiError";
  }
}

interface RequestOptions extends Omit<RequestInit, "body"> {
  auth?: boolean;
  body?: unknown;
  retryAuth?: boolean;
}

function createHeaders(options: RequestOptions) {
  const headers = new Headers(options.headers);
  const session = getSession();
  if (options.body instanceof URLSearchParams) {
    headers.set("Content-Type", "application/x-www-form-urlencoded");
  } else if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.auth !== false && session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return headers;
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new ApiError("INVALID_RESPONSE", response.status);
  }
  if (!value || typeof value !== "object" || !("code" in value) || typeof value.code !== "string") {
    throw new ApiError("INVALID_RESPONSE", response.status);
  }
  const payload = value as ApiEnvelope<T>;
  if (!response.ok || payload.code !== "OK") {
    throw new ApiError(payload.code || "REQUEST_FAILED", response.status, payload.data);
  }
  return payload.data as T;
}

async function refreshTokens(): Promise<AuthTokens> {
  const version = getSessionVersion();
  if (refreshPromise && refreshVersion === version) return refreshPromise;
  const session = getSession();
  if (!session?.refresh_token) throw new ApiError("TOKEN_INVALID", 401);
  const refreshToken = session.refresh_token;

  const run = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })
    .then((response) => parseEnvelope<AuthTokens>(response))
    .then((tokens) => {
      if (getSessionVersion() !== version || getSession()?.refresh_token !== refreshToken) {
        throw new ApiError("STALE_SESSION", 409);
      }
      setSession(tokens);
      return tokens;
    })
    .catch((error: unknown) => {
      if (getSessionVersion() === version && getSession()?.refresh_token === refreshToken) {
        setTfaChallenge(null);
        setSession(null);
      }
      throw error;
    })
    .finally(() => {
      if (refreshPromise === run) {
        refreshPromise = null;
        refreshVersion = null;
      }
    });

  refreshPromise = run;
  refreshVersion = version;
  return run;
}

function handleTfa(payload: ApiEnvelope<unknown>, status: number): never {
  const phone =
    payload.data && typeof payload.data === "object" && "phone" in payload.data
      ? String(payload.data.phone)
      : "绑定手机";
  if (!getTfaChallenge()) {
    setTfaChallenge({
      phone,
      returnTo:
        typeof window === "undefined"
          ? "/"
          : `${window.location.pathname}${window.location.search}`,
    });
  }
  throw new ApiError("TFA", status, payload.data);
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: createHeaders(options),
    body:
      options.body === undefined ||
      options.body instanceof FormData ||
      options.body instanceof URLSearchParams
        ? options.body
        : JSON.stringify(options.body),
  });

  const excludesRefresh = path === "/auth/login" || path === "/auth/refresh";
  if (response.status === 401 && options.auth !== false && !excludesRefresh) {
    const payload = (await response
      .clone()
      .json()
      .catch(() => null)) as ApiEnvelope<unknown> | null;
    if (payload?.code === "TFA") {
      handleTfa(payload, response.status);
    }
    if (options.retryAuth !== false) {
      await refreshTokens();
      return request<T>(path, { ...options, retryAuth: false });
    }
  }
  return parseEnvelope<T>(response);
}

export async function requestBlob(path: string, retryAuth = true): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: createHeaders({}) });
  if (!response.ok) {
    let code = "REQUEST_FAILED";
    let details: unknown;
    try {
      const payload = (await response.clone().json()) as ApiEnvelope<unknown>;
      code = payload.code;
      details = payload.data;
    } catch {
      // Binary endpoints may not return a JSON error body.
    }
    if (response.status === 401 && code === "TFA") {
      handleTfa({ code, data: details }, response.status);
    }
    if (response.status === 401 && retryAuth) {
      await refreshTokens();
      return requestBlob(path, false);
    }
    throw new ApiError(code, response.status, details);
  }
  return response.blob();
}

export function toQuery(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}
