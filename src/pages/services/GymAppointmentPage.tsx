import { useQuery } from "@tanstack/react-query";
import { CalendarCheck } from "lucide-react";
import { api } from "../../api/api";
import { EmptyState, PageHeader, QueryState, Section } from "../../components/ui";

export default function GymAppointmentPage() {
  const appointments = useQuery({
    queryKey: ["gym", "appointments"],
    queryFn: api.gym.appointments,
  });

  return (
    <div className="page">
      <PageHeader title="体测预约" back />

      <Section title="预约信息">
        <QueryState query={appointments} loadingRows={3}>
          {(items) =>
            items.length ? (
              <div className="surface list">
                {items.map((item) => (
                  <article className="record-item stack gap-8" key={`${item.name}-${item.time}`}>
                    <div className="cluster spread gap-12">
                      <h3>{item.name}</h3>
                      <span className="badge badge--success">{item.status}</span>
                    </div>
                    <p>{item.description}</p>
                    <p className="muted text-sm">
                      {item.show_date} · {item.time}
                    </p>
                    <p className="muted text-sm">测试类型：{item.test_type}</p>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState
                title="暂无体测预约"
                description="成功预约后，时间与测试项目会显示在这里。"
                icon={CalendarCheck}
              />
            )
          }
        </QueryState>
      </Section>
    </div>
  );
}
