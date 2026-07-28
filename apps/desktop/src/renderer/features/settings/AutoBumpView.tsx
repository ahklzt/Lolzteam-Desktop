import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Play,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import type { AutoBumpResult, AutoBumpThread } from "@lzt/shared";
import { useAutoBumpStore } from "~/stores/autobump";
import { pushToast } from "~/stores/toast";
import { Toggle } from "~/widgets/Toggle/Toggle";
import styles from "./AutoBumpView.module.scss";

interface Props {
  onBack?: () => void;
}

const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Пн" },
  { value: 2, label: "Вт" },
  { value: 3, label: "Ср" },
  { value: 4, label: "Чт" },
  { value: 5, label: "Пт" },
  { value: 6, label: "Сб" },
  { value: 0, label: "Вс" },
];

const RESULT_LABEL: Record<AutoBumpResult, string> = {
  ok: "Успех",
  error: "Ошибка",
  cooldown: "Кулдаун",
  skipped: "Пропуск",
};

const minToHHMM = (m: number): string =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hhmmToMin = (v: string): number => {
  const [h, m] = v.split(":").map((x) => Number(x));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
};

const fmtDateTime = (ts: number): string =>
  new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

export const AutoBumpView = ({ onBack }: Props) => {
  const state = useAutoBumpStore((s) => s.state);
  const load = useAutoBumpStore((s) => s.load);
  const subscribe = useAutoBumpStore((s) => s.subscribe);
  const setGlobal = useAutoBumpStore((s) => s.setGlobal);
  const addThread = useAutoBumpStore((s) => s.addThread);
  const updateThread = useAutoBumpStore((s) => s.updateThread);
  const removeThread = useAutoBumpStore((s) => s.removeThread);
  const bumpNow = useAutoBumpStore((s) => s.bumpNow);
  const clearLog = useAutoBumpStore((s) => s.clearLog);

  const [forumUrl, setForumUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void load();
    const off = subscribe();
    void window.moderator.app.getForumWebUrl().then(setForumUrl);
    return off;
  }, [load, subscribe]);

  const threads = useMemo(() => state?.threads ?? [], [state?.threads]);

  if (!state) return null;

  const onAdd = async () => {
    const ref = draft.trim();
    if (!ref) return;
    setAdding(true);
    const res = await addThread(ref);
    setAdding(false);
    if (res.ok) {
      setDraft("");
      pushToast({ kind: "success", title: "AutoBump", message: "Тема добавлена" });
    } else {
      pushToast({
        kind: "error",
        title: "AutoBump",
        message: res.message ?? "Не удалось добавить тему",
      });
    }
  };

  const openThread = (id: number) => {
    if (!forumUrl) return;
    void window.moderator.app.openExternal(`${forumUrl}/threads/${id}/`, {
      forceExternal: true,
    });
  };

  const runNow = async (id: number) => {
    const res = await bumpNow(id);
    pushToast({
      kind: res.ok ? "success" : "error",
      title: "AutoBump",
      message: res.ok ? "Тема бампнута" : (res.message ?? "Бамп не удался"),
    });
  };

  const toggleWeekday = (t: AutoBumpThread, day: number) => {
    const has = t.weekdays.includes(day);
    const weekdays = has
      ? t.weekdays.filter((d) => d !== day)
      : [...t.weekdays, day];
    void updateThread(t.threadId, { weekdays });
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        {onBack && (
          <button
            type="button"
            className={styles.back}
            onClick={onBack}
            aria-label="Назад"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <span className={styles.headText}>
          <span className={styles.title}>
            <Rocket size={18} /> AutoBump
          </span>
          <span className={styles.subtitle}>
            Автоматический бамп выбранных тем по расписанию
          </span>
        </span>
      </header>

      {}
      <div className={styles.card}>
        <div className={styles.rowBetween}>
          <span className={styles.fieldLabel}>Включить AutoBump</span>
          <Toggle
            checked={state.enabled}
            onChange={(v) => void setGlobal({ enabled: v })}
          />
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Период проверки, сек</span>
            <input
              className={styles.input}
              type="number"
              min={5}
              value={state.tickSeconds}
              onChange={(e) =>
                void setGlobal({ tickSeconds: Number(e.target.value) })
              }
            />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Джиттер интервала, мин</span>
            <input
              className={styles.input}
              type="number"
              min={0}
              value={state.jitterMin}
              onChange={(e) =>
                void setGlobal({ jitterMin: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <span className={styles.fieldHint}>
          Планировщик работает, пока открыто приложение. Форум ограничивает
          частоту бампа — преждевременные попытки помечаются как «Кулдаун».
        </span>
      </div>

      {}
      <div className={styles.card}>
        <span className={styles.fieldLabel}>Добавить тему</span>
        <div className={styles.addRow}>
          <input
            className={styles.input}
            placeholder="ID темы или ссылка (…/threads/название.123456/)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void onAdd();
            }}
          />
          <button
            type="button"
            className={styles.primary}
            onClick={() => void onAdd()}
            disabled={adding}
          >
            <Plus size={16} /> {adding ? "Добавляю…" : "Добавить"}
          </button>
        </div>
      </div>

      {}
      {threads.length === 0 ? (
        <div className={styles.empty}>
          Пока нет тем. Добавьте тему по ID или ссылке выше.
        </div>
      ) : (
        threads.map((t) => (
          <div key={t.threadId} className={styles.threadCard}>
            <div className={styles.threadHead}>
              <div className={styles.threadTitleWrap}>
                {t.prefixes.length > 0 && (
                  <span className={styles.prefixes}>
                    {t.prefixes.map((p, i) => (
                      <span
                        key={i}
                        className={styles.prefix}
                        style={p.color ? { color: p.color } : undefined}
                      >
                        {p.title}
                      </span>
                    ))}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.threadTitle}
                  onClick={() => openThread(t.threadId)}
                >
                  {t.title ?? `Тема #${t.threadId}`}
                  <ExternalLink size={13} />
                </button>
                <span className={styles.threadMeta}>
                  #{t.threadId}
                  {t.creatorUsername ? ` · ${t.creatorUsername}` : ""}
                  {t.replyCount != null ? ` · ${t.replyCount} ответов` : ""}
                  {t.viewCount != null ? ` · ${t.viewCount} просмотров` : ""}
                </span>
              </div>
              <div className={styles.threadActions}>
                <Toggle
                  checked={t.enabled}
                  onChange={(v) => void updateThread(t.threadId, { enabled: v })}
                />
                <button
                  type="button"
                  className={styles.icon}
                  title="Бампнуть сейчас"
                  onClick={() => void runNow(t.threadId)}
                >
                  <Play size={16} />
                </button>
                <button
                  type="button"
                  className={styles.icon}
                  title="Удалить"
                  onClick={() => void removeThread(t.threadId)}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className={styles.grid3}>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Начало окна</span>
                <input
                  className={styles.input}
                  type="time"
                  value={minToHHMM(t.windowStartMin)}
                  onChange={(e) =>
                    void updateThread(t.threadId, {
                      windowStartMin: hhmmToMin(e.target.value),
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Конец окна</span>
                <input
                  className={styles.input}
                  type="time"
                  value={minToHHMM(t.windowEndMin)}
                  onChange={(e) =>
                    void updateThread(t.threadId, {
                      windowEndMin: hhmmToMin(e.target.value),
                    })
                  }
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Интервал, мин</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  value={t.intervalMin}
                  onChange={(e) =>
                    void updateThread(t.threadId, {
                      intervalMin: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className={styles.weekdays}>
              {WEEKDAYS.map((d) => {
                const on =
                  t.weekdays.length === 0 || t.weekdays.includes(d.value);
                return (
                  <button
                    key={d.value}
                    type="button"
                    className={`${styles.weekday} ${on ? styles.weekdayOn : ""}`}
                    onClick={() => toggleWeekday(t, d.value)}
                    title={
                      t.weekdays.length === 0
                        ? "Сейчас активны все дни"
                        : undefined
                    }
                  >
                    {d.label}
                  </button>
                );
              })}
              <label className={styles.maxPerDay}>
                <span className={styles.fieldLabel}>Лимит/сутки</span>
                <input
                  className={styles.inputSm}
                  type="number"
                  min={0}
                  value={t.maxPerDay}
                  onChange={(e) =>
                    void updateThread(t.threadId, {
                      maxPerDay: Number(e.target.value),
                    })
                  }
                />
              </label>
            </div>

            <div className={styles.threadStatus}>
              {t.lastResult && (
                <span
                  className={`${styles.badge} ${styles[`badge_${t.lastResult}`]}`}
                >
                  {RESULT_LABEL[t.lastResult]}
                </span>
              )}
              {t.lastBumpAt && (
                <span className={styles.statusText}>
                  Последний бамп: {fmtDateTime(t.lastBumpAt)}
                </span>
              )}
              {t.nextBumpAt && (
                <span className={styles.statusText}>
                  Следующий: {fmtDateTime(t.nextBumpAt)}
                </span>
              )}
              {t.lastMessage && (
                <span className={styles.statusMsg}>{t.lastMessage}</span>
              )}
            </div>
          </div>
        ))
      )}

      {}
      <div className={styles.card}>
        <div className={styles.rowBetween}>
          <span className={styles.fieldLabel}>
            <Clock size={14} /> Журнал бампов
          </span>
          {state.log.length > 0 && (
            <button
              type="button"
              className={styles.link}
              onClick={() => void clearLog()}
            >
              Очистить
            </button>
          )}
        </div>
        {state.log.length === 0 ? (
          <span className={styles.fieldHint}>Событий пока нет.</span>
        ) : (
          <ul className={styles.log}>
            {state.log.map((e) => (
              <li key={e.id} className={styles.logItem}>
                <span className={styles.logTime}>{fmtDateTime(e.ts)}</span>
                <span
                  className={`${styles.badge} ${styles[`badge_${e.result}`]}`}
                >
                  {RESULT_LABEL[e.result]}
                </span>
                <span className={styles.logThread}>
                  {e.threadTitle ?? `#${e.threadId}`}
                </span>
                {e.message && <span className={styles.logMsg}>{e.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
