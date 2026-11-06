import { useMutation, useQuery } from "@tanstack/react-query";
import { Clock, FlaskConical, MapPin, Phone, UserRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../../api/api";
import { EmptyState, PageHeader, QueryState, Section, StatusMessage } from "../../components/ui";
import { formatMonthDayWithWeekday, formatTime } from "../../utils/format";

export default function LabSchedulePage() {
  const [bindMessage, setBindMessage] = useState("");
  const schedule = useQuery({
    queryKey: ["lab", "schedule"],
    queryFn: api.lab.schedule,
  });
  const bind = useMutation({
    mutationFn: api.lab.bind,
    onMutate: () => setBindMessage(""),
    onSuccess: () => setBindMessage("实验平台账号已绑定。"),
  });

  function submitBind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    bind.mutate(String(data.get("password") || ""));
  }

  return (
    <div className="page">
      <PageHeader title="实验安排" back />

      <Section title="安排列表">
        <QueryState query={schedule} loadingRows={4}>
          {(items) =>
            items.length ? (
              <div className="lab-schedule-list">
                {items.map((item) => {
                  const moment = formatMonthDayWithWeekday(item.date_time);
                  const time = formatTime(item.date_time);
                  const teacher = item.teacher?.trim();
                  const place = item.place?.trim();
                  const seat = item.seat?.trim();
                  const phone = item.phone?.trim();
                  const email = item.email?.trim();

                  return (
                    <article
                      className="surface lab-schedule-item"
                      key={`${item.name}-${item.date_time}`}
                    >
                      <div className="lab-schedule-item__header">
                        <h3 className="lab-schedule-item__name">{item.name}</h3>
                      </div>

                      <div className="lab-schedule-item__rows">
                        <div className="lab-schedule-item__row">
                          <Clock aria-hidden="true" />
                          <div className="lab-schedule-item__row-body">
                            <span className="lab-schedule-item__row-label">实验时间</span>
                            <time
                              className="lab-schedule-item__row-value"
                              dateTime={item.date_time.replace(" ", "T")}
                            >
                              {time ? `${moment} ${time}` : moment}
                            </time>
                          </div>
                        </div>

                        <div className="lab-schedule-item__row">
                          <MapPin aria-hidden="true" />
                          <div className="lab-schedule-item__row-body">
                            <span className="lab-schedule-item__row-label">实验地点</span>
                            <span className="lab-schedule-item__row-value">
                              {place || "地点待定"}
                              {seat ? ` · 座位 ${seat}` : ""}
                            </span>
                          </div>
                        </div>

                        <div className="lab-schedule-item__row lab-schedule-item__row--teacher">
                          <UserRound aria-hidden="true" />
                          <div className="lab-schedule-item__row-body">
                            <span className="lab-schedule-item__row-label">授课教师</span>
                            {email ? (
                              <a
                                className="lab-schedule-item__teacher"
                                href={`mailto:${email}`}
                                aria-label={`发送邮件给${teacher || "授课教师"}（${email}）`}
                              >
                                <strong>{teacher || "待定"}</strong>
                                <span className="lab-schedule-item__teacher-channel">
                                  ({email})
                                </span>
                              </a>
                            ) : (
                              <span className="lab-schedule-item__teacher">
                                <strong>{teacher || "待定"}</strong>
                              </span>
                            )}
                          </div>
                          {phone ? (
                            <div className="lab-schedule-item__actions">
                              <a
                                className="button button--ghost button--small lab-schedule-item__action"
                                href={`tel:${phone}`}
                                aria-label="电话联系"
                              >
                                <Phone aria-hidden="true" />
                                电话
                              </a>
                            </div>
                          ) : null}
                          {!phone && !email ? (
                            <span className="lab-schedule-item__no-contact">暂无联系方式</span>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="暂无实验安排"
                description="新的实验排期会显示在这里。"
                icon={FlaskConical}
              />
            )
          }
        </QueryState>
      </Section>

      <Section title="绑定实验平台" description="绑定信息只用于同步实验安排与成绩。">
        <form className="form surface surface--padded" onSubmit={submitBind}>
          <div className="field">
            <label htmlFor="lab-password">实验平台密码</label>
            <input
              id="lab-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="输入平台密码…"
            />
          </div>
          {bindMessage ? <StatusMessage tone="success">{bindMessage}</StatusMessage> : null}
          {bind.isError ? <StatusMessage tone="danger">{bind.error.message}</StatusMessage> : null}
          <button
            className="button button--secondary button--block"
            type="submit"
            disabled={bind.isPending}
          >
            {bind.isPending ? "正在绑定…" : "绑定账号"}
          </button>
        </form>
      </Section>
    </div>
  );
}
