import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, CircleHelp, Info, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { AuthPrompt, ConfirmDialog, DataRow, PageError, PageHeader, PageSkeleton, Section } from "../components/ui";

export default function ProfilePage() {
  const { isAuthenticated, logout } = useAuth();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const me = useQuery({ queryKey: ["me"], queryFn: api.me.get, enabled: isAuthenticated });
  const unbind = useMutation({
    mutationFn: api.auth.unbind,
    onSuccess: () => {
      queryClient.clear();
      logout();
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="page">
        <PageHeader title="我的" description="个人资料与应用设置" />
        <AuthPrompt title="登录校园账号" description="登录后可查看个人资料、通知和偏好设置。" />
        <div className="surface list">
          <Link className="menu-link" to="/feedback"><CircleHelp aria-hidden="true" /><span>问题反馈</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="menu-link" to="/about"><Info aria-hidden="true" /><span>关于微生活</span><ChevronRight aria-hidden="true" /></Link>
        </div>
      </div>
    );
  }

  if (me.isPending) return <div className="page"><PageSkeleton rows={6} /></div>;
  if (me.isError) {
    return (
      <div className="page">
        <PageHeader title="我的" />
        <PageError error={me.error} onRetry={() => void me.refetch()} />
      </div>
    );
  }

  const profile = me.data;
  return (
    <div className="page">
      <PageHeader title="我的" description="个人资料与应用设置" />

      <section className="profile-heading">
        <div className="profile-avatar" aria-hidden="true">{profile.name.slice(0, 1)}</div>
        <div className="min-w-0">
          <h2>{profile.name}</h2>
          <p className="muted">{profile.stu_id} · {profile.class}</p>
        </div>
      </section>

      <Section title="学籍信息">
        <div className="surface list">
          <DataRow label="学院" value={profile.college} />
          <DataRow label="专业" value={profile.major} />
          <DataRow label="入学年份" value={profile.enter} />
          <DataRow label="学制" value={profile.xz === null ? "未提供" : `${profile.xz} 年`} />
          <DataRow label="性别" value={profile.sex} />
        </div>
      </Section>

      <Section title="应用">
        <div className="surface list">
          <Link className="menu-link" to="/notices"><Bell aria-hidden="true" /><span>通知消息</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="menu-link" to="/settings"><Settings aria-hidden="true" /><span>显示与课表设置</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="menu-link" to="/feedback"><CircleHelp aria-hidden="true" /><span>问题反馈</span><ChevronRight aria-hidden="true" /></Link>
          <Link className="menu-link" to="/about"><Info aria-hidden="true" /><span>关于微生活</span><ChevronRight aria-hidden="true" /></Link>
        </div>
      </Section>

      <button className="button button--secondary button--block text-danger" type="button" onClick={() => setConfirming(true)}>
        <LogOut aria-hidden="true" />解除绑定并退出
      </button>

      {confirming ? (
        <ConfirmDialog
          title="解除账号绑定？"
          description="本机登录信息会被清除，下次查看个人数据需要重新登录。"
          confirmLabel="解除绑定"
          pending={unbind.isPending}
          error={unbind.isError ? unbind.error.message : undefined}
          onCancel={() => setConfirming(false)}
          onConfirm={() => unbind.mutate()}
        />
      ) : null}
    </div>
  );
}
