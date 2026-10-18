import {
  Activity,
  Dumbbell,
  Footprints,
  Gauge,
  MoveHorizontal,
  Timer,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState, type KeyboardEvent } from "react";
import { PageFootnotes } from "../../components/PageFootnotes";
import { PageHeader, RadioGroup, Section, Tag } from "../../components/ui";
import {
  gymStandardProjects as projects,
  type Audience,
  type GradeGroup,
  type StandardProject,
  type StandardRow,
} from "./gymStandards";

type StandardScoreRow = StandardRow & { kind: "standard" };
type BonusScoreRow = StandardRow & { kind: "bonus" };

const projectIcons: Record<StandardProject["id"], LucideIcon> = {
  bmi: Gauge,
  "vital-capacity": Wind,
  sprint: Timer,
  "sit-reach": MoveHorizontal,
  "standing-jump": Footprints,
  strength: Dumbbell,
  endurance: Activity,
};

const audienceOptions: ReadonlyArray<{ value: Audience; label: string }> = [
  { value: "male", label: "男生" },
  { value: "female", label: "女生" },
];

const gradeOptions: ReadonlyArray<{ value: GradeGroup; label: string }> = [
  { value: "lower", label: "大一 / 大二" },
  { value: "upper", label: "大三 / 大四" },
];

const notes = [
  "体测总分由标准分与附加分相加，标准分满分 100 分，附加分满分 20 分，总分满分 120 分。",
  "标准分卡片展示各项目完整分档；耐力跑与力量项目另用附加分卡片展示达到各档加分所需的具体成绩。",
  "体测标准按性别和年级区分，请以学校正式通知为准。",
] as const;

function scoreLevel(score: number) {
  if (score >= 90) return { label: "优秀", tone: "success" as const };
  if (score >= 80) return { label: "良好", tone: "primary" as const };
  if (score >= 60) return { label: "及格", tone: "warning" as const };
  return { label: "不及格", tone: "danger" as const };
}

function rowLevel(row: StandardScoreRow) {
  if (row.category === "正常") return { label: row.category, tone: "success" as const };
  if (row.category === "低体重") return { label: row.category, tone: "primary" as const };
  if (row.category === "肥胖") return { label: row.category, tone: "danger" as const };
  if (row.category) return { label: row.category, tone: "warning" as const };
  return scoreLevel(row.score);
}

function isStandardScoreRow(row: StandardRow): row is StandardScoreRow {
  return row.kind === "standard";
}

function isBonusScoreRow(row: StandardRow): row is BonusScoreRow {
  return row.kind === "bonus";
}

function displayProjectName(project: StandardProject, audience: Audience) {
  return typeof project.name === "string" ? project.name : project.name[audience];
}

function displayProjectShortName(project: StandardProject, audience: Audience) {
  return typeof project.shortName === "string" ? project.shortName : project.shortName[audience];
}

function StandardScoreTable({
  projectName,
  rows,
  gradeIndex,
  unit,
}: {
  projectName: string;
  rows: readonly StandardScoreRow[];
  gradeIndex: 0 | 1;
  unit: string;
}) {
  return (
    <div className="gym-standard-table surface">
      <table>
        <caption className="sr-only">{projectName}分数与成绩要求</caption>
        <thead>
          <tr>
            <th scope="col">分值</th>
            <th scope="col">成绩要求（{unit}）</th>
            <th scope="col">等级</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const level = rowLevel(row);
            return (
              <tr key={`${row.score}-${row.category ?? ""}`}>
                <th scope="row">
                  <strong>{row.score}</strong>
                </th>
                <td>{row.thresholds[gradeIndex]}</td>
                <td>
                  <Tag tone={level.tone}>{level.label}</Tag>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BonusScoreTable({
  projectName,
  rangeLabel,
  rows,
  gradeIndex,
  unit,
}: {
  projectName: string;
  rangeLabel: string;
  rows: readonly BonusScoreRow[];
  gradeIndex: 0 | 1;
  unit: string;
}) {
  return (
    <div className="gym-standard-table gym-standard-bonus-table surface">
      <table>
        <caption className="sr-only">
          {projectName}附加分{rangeLabel}成绩要求
        </caption>
        <thead>
          <tr>
            <th scope="col">分值</th>
            <th scope="col">成绩要求（{unit}）</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.score}>
              <th scope="row">
                <strong>+{row.score}</strong>
              </th>
              <td>{row.thresholds[gradeIndex]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GymStandardPage() {
  const [audience, setAudience] = useState<Audience>("male");
  const [gradeGroup, setGradeGroup] = useState<GradeGroup>("lower");
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0].id);
  const projectButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const gradeIndex: 0 | 1 = gradeGroup === "lower" ? 0 : 1;
  const projectRows = selectedProject.standards[audience];
  const standardRows = projectRows.filter(isStandardScoreRow);
  const bonusStandardRows = projectRows.filter(isBonusScoreRow);
  const selectedProjectName = displayProjectName(selectedProject, audience);
  const selectedProjectDescription =
    selectedProject.id === "bmi"
      ? `占比 ${selectedProject.weight}% · BMI 指标 = 体重 / 身高的平方`
      : `占比 ${selectedProject.weight}%`;

  function handleProjectKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % projects.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + projects.length) % projects.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = projects.length - 1;
    if (nextIndex === undefined) return;

    event.preventDefault();
    setSelectedProjectId(projects[nextIndex].id);
    projectButtons.current[nextIndex]?.focus();
  }

  return (
    <div className="page gym-standard-page">
      <PageHeader title="体测标准" back />

      <section className="gym-standard-overview surface" aria-labelledby="gym-standard-overview">
        <div className="gym-standard-overview__heading">
          <h2 id="gym-standard-overview">总分构成</h2>
        </div>
        <div
          className="gym-standard-score-composition"
          aria-label="体测总分等于标准分 100 分加附加分 20 分，满分 120 分"
          role="group"
        >
          <div className="gym-standard-score-part">
            <strong>
              100<small>分</small>
            </strong>
            <span>标准分</span>
          </div>
          <span className="gym-standard-score-operator" aria-hidden="true">
            +
          </span>
          <div className="gym-standard-score-part">
            <strong>
              20<small>分</small>
            </strong>
            <span>附加分</span>
          </div>
          <span className="gym-standard-score-operator" aria-hidden="true">
            =
          </span>
          <div className="gym-standard-score-part gym-standard-score-part--total">
            <strong>
              120<small>分</small>
            </strong>
            <span>总分</span>
          </div>
        </div>
        <div className="gym-standard-level-heading">
          <h3>等级划分</h3>
          <span>按总分评定</span>
        </div>
        <div className="gym-standard-levels" aria-label="分数等级范围">
          <div>
            <strong>≥ 90</strong>
            <span>优秀</span>
          </div>
          <div>
            <strong>80–89</strong>
            <span>良好</span>
          </div>
          <div>
            <strong>60–79</strong>
            <span>及格</span>
          </div>
          <div>
            <strong>&lt; 60</strong>
            <span>不及格</span>
          </div>
        </div>
      </section>

      <section
        className="gym-standard-graduation surface"
        aria-labelledby="gym-standard-graduation"
      >
        <div className="gym-standard-graduation__heading">
          <h2 id="gym-standard-graduation">毕业成绩</h2>
        </div>
        <div
          className="gym-standard-graduation__calculation"
          role="group"
          aria-label="毕业成绩等于毕业当年学年总分乘以 50%，加其他学年总分平均得分乘以 50%；毕业等级按毕业成绩评定"
        >
          <div className="gym-standard-graduation__factor">
            <span className="gym-standard-graduation__operator" aria-hidden="true" />
            <span>毕业当年学年总分</span>
            <strong>× 50%</strong>
          </div>
          <div className="gym-standard-graduation__factor">
            <span className="gym-standard-graduation__operator" aria-hidden="true">
              +
            </span>
            <span>其他学年总分平均得分</span>
            <strong>× 50%</strong>
          </div>
          <div className="gym-standard-graduation__result">
            <span className="gym-standard-graduation__operator" aria-hidden="true">
              =
            </span>
            <div>
              <strong>毕业成绩</strong>
              <span>同时据此评定毕业等级</span>
            </div>
          </div>
        </div>
      </section>

      <Section className="gym-standard-filters" title="项目评分标准">
        <div className="gym-standard-filter surface">
          <RadioGroup
            className="gym-standard-filter__group"
            label="性别"
            options={audienceOptions}
            value={audience}
            onChange={setAudience}
          />
          <RadioGroup
            className="gym-standard-filter__group"
            label="年级"
            options={gradeOptions}
            value={gradeGroup}
            onChange={setGradeGroup}
          />
        </div>
        <div className="gym-standard-project-scroll" role="region" aria-label="测试项目选择">
          <div className="gym-standard-project-card surface">
            <div className="gym-standard-projects" role="tablist" aria-label="体测项目">
              {projects.map((project, index) => {
                const Icon = projectIcons[project.id];
                const selected = project.id === selectedProject.id;
                const shortName = displayProjectShortName(project, audience);
                return (
                  <button
                    aria-label={shortName}
                    aria-controls="gym-standard-panel"
                    aria-selected={selected}
                    className={selected ? "is-active" : ""}
                    id={`gym-standard-tab-${project.id}`}
                    key={project.id}
                    ref={(element) => {
                      projectButtons.current[index] = element;
                    }}
                    role="tab"
                    tabIndex={selected ? 0 : -1}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    onKeyDown={(event) => handleProjectKeyDown(event, index)}
                  >
                    <Icon aria-hidden="true" />
                    <span>{shortName}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <div
        aria-labelledby={`gym-standard-tab-${selectedProject.id}`}
        className="gym-standard-result-panel stack gap-16"
        id="gym-standard-panel"
        role="tabpanel"
        tabIndex={0}
      >
        <Section
          className="gym-standard-result"
          title={`${selectedProjectName}标准`}
          description={selectedProjectDescription}
        >
          <StandardScoreTable
            gradeIndex={gradeIndex}
            projectName={selectedProjectName}
            rows={standardRows}
            unit={selectedProject.unit}
          />
        </Section>

        {bonusStandardRows.length > 0 ? (
          <Section className="gym-standard-bonus" title="附加分">
            <div className="gym-standard-bonus-grid">
              <BonusScoreTable
                gradeIndex={gradeIndex}
                projectName={selectedProjectName}
                rangeLabel="前 5 档"
                rows={bonusStandardRows.slice(0, 5)}
                unit={selectedProject.unit}
              />
              <BonusScoreTable
                gradeIndex={gradeIndex}
                projectName={selectedProjectName}
                rangeLabel="后 5 档"
                rows={bonusStandardRows.slice(5)}
                unit={selectedProject.unit}
              />
            </div>
          </Section>
        ) : null}
      </div>

      <PageFootnotes items={notes} label="体测标准说明" />
    </div>
  );
}
