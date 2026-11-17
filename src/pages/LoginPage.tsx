import { ChevronLeft, Hash, LockKeyhole } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { StatusMessage } from "../components/ui";

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({ stuId: "", password: "" });
  const returnTo = searchParams.get("returnTo") || "/";

  useEffect(() => {
    document.title = "登录 - 微生活";
    const heading = document.querySelector<HTMLHeadingElement>(".login-shell h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, []);

  if (isAuthenticated) {
    return <Navigate replace to={returnTo} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const stuId = String(data.get("stu_id") || "").trim();
    const password = String(data.get("password") || "");
    const nextErrors = {
      stuId: stuId ? "" : "请输入学号。",
      password: password ? "" : "请输入密码。",
    };
    setFieldErrors(nextErrors);
    if (!stuId || !password) {
      window.requestAnimationFrame(() => {
        document.getElementById(stuId ? "password" : "stu-id")?.focus();
      });
      return;
    }

    setPending(true);
    setError("");
    try {
      await login({ stu_id: stuId, password });
      navigate(returnTo, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请稍后重试。");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="login-shell login-shell--login">
      <div className="login-content">
        <div className="login-topbar">
          <Link className="login-back" to="/" aria-label="返回应用">
            <ChevronLeft aria-hidden="true" />
          </Link>
        </div>

        <div className="login-title">
          <h1>登录校园账号</h1>
          <p className="muted">用于读取课表、成绩和其他个人校园数据。</p>
        </div>

        <form className="form" onSubmit={handleSubmit} noValidate>
          <div className="field login-field">
            <label className="sr-only" htmlFor="stu-id">
              学号
            </label>
            <div className="login-input">
              <span className="login-input__icon" aria-hidden="true">
                <Hash />
              </span>
              <input
                id="stu-id"
                name="stu_id"
                inputMode="numeric"
                autoComplete="username"
                spellCheck={false}
                placeholder="学号"
                aria-invalid={Boolean(fieldErrors.stuId)}
                aria-describedby={fieldErrors.stuId ? "stu-id-error" : undefined}
                onChange={() => setFieldErrors((value) => ({ ...value, stuId: "" }))}
              />
            </div>
            {fieldErrors.stuId ? (
              <p className="field-error" id="stu-id-error">
                {fieldErrors.stuId}
              </p>
            ) : null}
          </div>
          <div className="field login-field">
            <label className="sr-only" htmlFor="password">
              密码
            </label>
            <div className="login-input">
              <span className="login-input__icon" aria-hidden="true">
                <LockKeyhole />
              </span>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                placeholder="密码"
                aria-invalid={Boolean(fieldErrors.password)}
                aria-describedby={fieldErrors.password ? "password-error" : undefined}
                onChange={() => setFieldErrors((value) => ({ ...value, password: "" }))}
              />
            </div>
            {fieldErrors.password ? (
              <p className="field-error" id="password-error">
                {fieldErrors.password}
              </p>
            ) : null}
          </div>
          {error ? <StatusMessage tone="danger">{error}</StatusMessage> : null}
          <button className="button button--primary button--block" type="submit" disabled={pending}>
            {pending ? "正在登录…" : "登录"}
          </button>
        </form>
      </div>
    </main>
  );
}
