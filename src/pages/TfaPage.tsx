import { useMutation } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { api } from "../api/api";
import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { getTfaChallenge, setTfaChallenge, subscribeTfaChallenge } from "../auth/tfa";
import { PageHeader, StatusMessage } from "../components/ui";

export default function TfaPage() {
  const challenge = useSyncExternalStore(subscribeTfaChallenge, getTfaChallenge, () => null);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [codeSent, setCodeSent] = useState(false);
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const send = useMutation({
    mutationFn: api.auth.sendTfa,
    onSuccess: () => {
      setCodeSent(true);
      setInfo("验证码已发送，请查看绑定手机。");
      setError("");
    },
    onError: (reason) => {
      if (reason instanceof ApiError && reason.code === "VALID") {
        setCodeSent(true);
        setInfo(reason.message);
        setError("");
      } else {
        setError(reason instanceof Error ? reason.message : "验证码发送失败。");
      }
    },
  });
  const verify = useMutation({
    mutationFn: api.auth.verifyTfa,
    onSuccess: () => {
      const returnTo = challenge?.returnTo || "/";
      setTfaChallenge(null);
      navigate(returnTo, { replace: true });
    },
    onError: (reason) => {
      if (reason instanceof ApiError && reason.code === "TFA_EXPIRED") {
        setTfaChallenge(null);
        logout();
        navigate("/login", { replace: true });
      } else {
        setError(reason instanceof Error ? reason.message : "验证码校验失败。");
      }
    },
  });

  useEffect(() => {
    document.title = "短信验证 - 微生活";
    const heading = document.querySelector<HTMLHeadingElement>(".login-shell h1");
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    }
  }, []);

  if (!challenge) return <Navigate replace to="/" />;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const code = String(data.get("code") || "").trim();
    if (!/^\d{6}$/.test(code)) {
      setError("请输入 6 位短信验证码。");
      document.getElementById("tfa-code")?.focus();
      return;
    }
    verify.mutate(code);
  }

  return (
    <main className="login-shell">
      <div className="login-content">
        <PageHeader title="短信验证" description={`验证码将发送至 ${challenge.phone}`} back />
        <div className="login-title">
          <ShieldCheck aria-hidden="true" />
          <h2>确认是你本人操作</h2>
          <p className="muted">完成验证后会返回刚才的页面。</p>
        </div>
        {!codeSent ? (
          <button
            className="button button--primary button--block"
            type="button"
            disabled={send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? "正在发送…" : "发送验证码"}
          </button>
        ) : (
          <form className="form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="tfa-code">短信验证码</label>
              <input
                id="tfa-code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                spellCheck={false}
                placeholder="输入 6 位验证码…"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "tfa-error" : undefined}
              />
            </div>
            {info ? <StatusMessage>{info}</StatusMessage> : null}
            {error ? (
              <StatusMessage tone="danger">
                <span id="tfa-error">{error}</span>
              </StatusMessage>
            ) : null}
            <button
              className="button button--primary button--block"
              type="submit"
              disabled={verify.isPending}
            >
              {verify.isPending ? "正在验证…" : "完成验证"}
            </button>
            <button
              className="button button--secondary button--block"
              type="button"
              disabled={send.isPending}
              onClick={() => send.mutate()}
            >
              {send.isPending ? "正在发送…" : "重新发送"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
