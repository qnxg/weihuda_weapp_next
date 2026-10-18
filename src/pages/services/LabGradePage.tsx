import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/api";
import { EmptyState, PageHeader, QueryState, Section } from "../../components/ui";
import { findCurrentSemester } from "../../utils/semester";

export default function LabGradePage() {
  const semesterTable = useQuery({
    queryKey: ["semester"],
    queryFn: api.semester.get,
  });
  const semester = findCurrentSemester(semesterTable.data);
  const grade = useQuery({
    queryKey: ["lab", "grade", semester?.xn, semester?.xq],
    queryFn: () => api.lab.grade(semester!.xn, semester!.xq),
    enabled: semester !== undefined,
  });

  return (
    <div className="page">
      <PageHeader
        title="实验成绩"
        description={
          grade.data
            ? `${grade.data.course_name} · 总评 ${grade.data.course_score ?? "待发布"}`
            : undefined
        }
        back
      />

      <Section title="成绩明细">
        <QueryState query={semesterTable} loadingRows={3}>
          {() => (
            <QueryState query={grade} loadingRows={3}>
              {(result) =>
                result?.labs.length ? (
                  <div className="surface list">
                    {result.labs.map((lab) => (
                      <article className="record-item stack gap-8" key={lab.lab_name}>
                        <div className="cluster spread gap-12">
                          <h3>{lab.lab_name}</h3>
                          <strong>{lab.score}</strong>
                        </div>
                        <p className="muted text-sm">出勤：{lab.attendance || "未记录"}</p>
                        {lab.details.map((detail) => (
                          <div className="cluster spread text-sm" key={detail.name}>
                            <span>{detail.name}</span>
                            <strong>{detail.score ?? "待发布"}</strong>
                          </div>
                        ))}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="暂无实验成绩" description="成绩发布后会显示评分组成。" />
                )
              }
            </QueryState>
          )}
        </QueryState>
      </Section>
    </div>
  );
}
