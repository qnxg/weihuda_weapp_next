import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api } from "../api/api";
import type { IndexCardKey, IndexCardSetting, TableSetting } from "../api/types";
import { DataRow, PageError, PageHeader, PageSkeleton, Section, StatusMessage } from "../components/ui";

const cardOptions = [
  ["course", "今日课程", "课程时间、教室与教师"],
  ["tasks", "近期考试", "最近的考试和待办提醒"],
  ["jifen", "积分签到", "积分余额与连续签到"],
  ["electricity", "宿舍电量", "寝室剩余电量"],
  ["campus", "校园动态", "最新校园公告"],
  ["count_down", "考试倒计时", "距离下一场考试的天数"],
  ["grade", "最新成绩", "最近公布的课程成绩"],
  ["email", "校内邮箱", "未读邮件数量"],
] as const satisfies readonly (readonly [IndexCardKey, string, string])[];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [cardMessage, setCardMessage] = useState("");
  const [cardValidation, setCardValidation] = useState("");
  const [tableMessage, setTableMessage] = useState("");
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.me.settings });
  const cards = useQuery({
    queryKey: ["setting", "index_card"],
    queryFn: () => api.me.setting<IndexCardSetting>("index_card"),
  });
  const table = useQuery({
    queryKey: ["setting", "table"],
    queryFn: () => api.me.setting<TableSetting>("table"),
  });

  const saveCards = useMutation({
    mutationFn: (value: IndexCardSetting) => api.me.updateSetting("index_card", value),
    onMutate: () => {
      setCardMessage("");
      setCardValidation("");
    },
    onSuccess: async (value) => {
      setCardMessage(`首页卡片设置已保存，版本 ${value.version}。`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["setting", "index_card"] }),
      ]);
    },
  });
  const saveTable = useMutation({
    mutationFn: (value: TableSetting) => api.me.updateSetting("table", value),
    onMutate: () => setTableMessage(""),
    onSuccess: async (value) => {
      setTableMessage(`课表设置已保存，版本 ${value.version}。`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["setting", "table"] }),
      ]);
    },
  });

  const queries = [settings, cards, table];
  if (queries.some((query) => query.isPending)) return <div className="page"><PageSkeleton rows={7} /></div>;
  const failed = queries.find((query) => query.isError);
  if (failed) {
    return (
      <div className="page">
        <PageHeader title="设置" back />
        <PageError error={failed.error} onRetry={() => void Promise.all(queries.map((query) => query.refetch()))} />
      </div>
    );
  }

  function submitCards(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const selectedCards = data.getAll("cards").map(String) as IndexCardKey[];
    if (selectedCards.length < 5) {
      setCardValidation("请至少保留 5 个首页卡片。");
      return;
    }
    setCardValidation("");
    saveCards.mutate({
      version: cards.data!.version + 1,
      setting: { cards: selectedCards },
    });
  }

  function submitTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    saveTable.mutate({
      version: table.data!.version + 1,
      setting: { display_not_current_week_courses: data.get("display_not_current_week_courses") === "on" },
    });
  }

  return (
    <div className="page">
      <PageHeader title="设置" description="调整首页内容和课表显示" back />

      <Section title="配置状态">
        <div className="surface list">
          <DataRow label="首页卡片版本" value={settings.data!.index_card_setting.version} detail={`${settings.data!.index_card_setting.setting.cards.length} 个卡片`} />
          <DataRow label="课表设置版本" value={settings.data!.table_setting.version} detail={settings.data!.table_setting.setting.display_not_current_week_courses ? "显示非本周课程" : "仅显示本周课程"} />
        </div>
      </Section>

      <Section title="首页卡片" description="选择需要在今日页关注的内容。">
        <form
          className="form"
          onChange={() => {
            setCardMessage("");
            setCardValidation("");
            saveCards.reset();
          }}
          onSubmit={submitCards}
        >
          <fieldset className="field settings-fieldset choice-list">
            <legend className="sr-only">首页卡片</legend>
            {cardOptions.map(([value, label, description]) => (
              <label className="choice-card" key={value}>
                <span className="choice-card__copy">
                  <strong>{label}</strong>
                  <span>{description}</span>
                </span>
                <input type="checkbox" name="cards" value={value} defaultChecked={cards.data!.setting.cards.includes(value)} />
                <span className="choice-card__surface" aria-hidden="true" />
              </label>
            ))}
          </fieldset>
          {cardValidation ? <StatusMessage tone="danger">{cardValidation}</StatusMessage> : null}
          {saveCards.isError ? <StatusMessage tone="danger">{saveCards.error.message}</StatusMessage> : null}
          {cardMessage ? <StatusMessage tone="success">{cardMessage}</StatusMessage> : null}
          <button className="button button--primary button--block" type="submit" disabled={saveCards.isPending}>
            {saveCards.isPending ? "正在保存…" : "保存首页设置"}
          </button>
        </form>
      </Section>

      <Section title="课表显示">
        <form
          className="form"
          onChange={() => {
            setTableMessage("");
            saveTable.reset();
          }}
          onSubmit={submitTable}
        >
          <label className="choice-card">
            <span className="choice-card__copy">
              <strong>显示非本周课程</strong>
              <span>在每天的课表中保留其他周课程并标记状态</span>
            </span>
            <input type="checkbox" name="display_not_current_week_courses" defaultChecked={table.data!.setting.display_not_current_week_courses} />
            <span className="choice-card__surface" aria-hidden="true" />
          </label>
          {saveTable.isError ? <StatusMessage tone="danger">{saveTable.error.message}</StatusMessage> : null}
          {tableMessage ? <StatusMessage tone="success">{tableMessage}</StatusMessage> : null}
          <button className="button button--secondary button--block" type="submit" disabled={saveTable.isPending}>
            {saveTable.isPending ? "正在保存…" : "保存课表设置"}
          </button>
        </form>
      </Section>
    </div>
  );
}
