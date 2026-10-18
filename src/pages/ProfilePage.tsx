import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, ChevronRight, CircleHelp, Gift, Info, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/api";
import { useAuth } from "../auth/AuthProvider";
import { AuthPrompt, ConfirmDialog, PageError, PageHeader, Section } from "../components/ui";

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

  return (
    <div className="page profile-page">
      <PageHeader title="我的" />

      {!isAuthenticated ? (
        <AuthPrompt title="登录校园账号" description="登录后可查看积分、通知和个性化设置。" />
      ) : me.isPending ? (
        <section
          className="profile-account-card profile-account-card--loading"
          aria-label="正在加载账号信息"
          role="status"
        >
          <div className="profile-account-card__top">
            <div className="profile-account-card__name-block">
              <div className="skeleton profile-account-card__name-skeleton" />
              <div className="skeleton profile-account-card__student-id-skeleton" />
            </div>
          </div>
          <div className="profile-account-card__bottom">
            <div className="skeleton profile-account-card__college-skeleton" />
          </div>
          <div className="skeleton profile-account-card__avatar-skeleton" aria-hidden="true" />
        </section>
      ) : me.isError ? (
        <Section title="账号">
          <PageError error={me.error} onRetry={() => void me.refetch()} />
        </Section>
      ) : (
        <section
          className="profile-account-card"
          aria-label={`已登录账号 ${me.data.name}，${me.data.college}，学号 ${me.data.stu_id}`}
        >
          <div className="profile-account-card__top">
            <div className="profile-account-card__name-block">
              <h2>{me.data.name}</h2>
              <p className="profile-account-card__student-id">{me.data.stu_id}</p>
            </div>
          </div>
          <div className="profile-account-card__bottom">
            <p className="profile-account-card__college">{me.data.college}</p>
          </div>
          <div className="profile-account-card__avatar" aria-hidden="true">
            {me.data.name.slice(0, 1)}
          </div>
        </section>
      )}

      <Section title="更多应用">
        <div className="surface list">
          <Link className="menu-link" to="/services/points">
            <Gift aria-hidden="true" />
            <span className="menu-link__copy">
              <strong>积分中心</strong>
              <span>签到、记录与积分兑换</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
          {isAuthenticated ? (
            <>
              <Link className="menu-link" to="/notices">
                <Bell aria-hidden="true" />
                <span className="menu-link__copy">
                  <strong>通知消息</strong>
                  <span>查看校园提醒与未读消息</span>
                </span>
                <ChevronRight aria-hidden="true" />
              </Link>
              <Link className="menu-link" to="/settings">
                <Settings aria-hidden="true" />
                <span className="menu-link__copy">
                  <strong>显示与课表设置</strong>
                  <span>调整首页内容和课表显示</span>
                </span>
                <ChevronRight aria-hidden="true" />
              </Link>
            </>
          ) : null}
        </div>
      </Section>

      <Section title="支持与信息">
        <div className="surface list">
          <Link className="menu-link" to="/feedback">
            <CircleHelp aria-hidden="true" />
            <span className="menu-link__copy">
              <strong>问题反馈</strong>
              <span>提交问题与使用建议</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
          <Link className="menu-link" to="/about">
            <Info aria-hidden="true" />
            <span className="menu-link__copy">
              <strong>关于微生活</strong>
              <span>版本、项目链接与服务状态</span>
            </span>
            <ChevronRight aria-hidden="true" />
          </Link>
          {isAuthenticated ? (
            <button
              className="menu-link profile-logout-item"
              type="button"
              aria-haspopup="dialog"
              onClick={() => setConfirming(true)}
            >
              <LogOut aria-hidden="true" />
              <span className="menu-link__copy">
                <strong>退出登录</strong>
                <span>清除本机登录信息</span>
              </span>
              <ChevronRight aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </Section>

      {isAuthenticated && confirming ? (
        <ConfirmDialog
          title="退出登录？"
          description="本机登录信息会被清除，下次查看个人数据需要重新登录。"
          confirmLabel="退出登录"
          pending={unbind.isPending}
          error={unbind.isError ? unbind.error.message : undefined}
          onCancel={() => setConfirming(false)}
          onConfirm={() => unbind.mutate()}
        />
      ) : null}
    </div>
  );
}
