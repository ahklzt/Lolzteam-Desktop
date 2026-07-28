import { useEffect, useRef, useState } from "react";
import { Gamepad2, Plug, RefreshCw } from "lucide-react";
import {
  LZT_CONFIG,
  describePresence,
  type DiscordRpcAnimation,
  type DiscordRpcSettings,
} from "@lzt/shared";
import { useDiscordRpcStore } from "~/stores/discordRpc";
import { Toggle } from "~/widgets/Toggle/Toggle";
import styles from "./DiscordRpcView.module.scss";

const FAVICON_URL = `${LZT_CONFIG.webUrl}/public/brand/favicon.svg`;

const ANIMATIONS: Array<{ value: DiscordRpcAnimation; label: string }> = [
  { value: "none", label: "Без анимации" },
  { value: "pulse", label: "Пульс (звёздочка мерцает)" },
  { value: "typewriter", label: "Печатная машинка" },
  { value: "cycle", label: "Чередование строк" },
];

export const DiscordRpcView = () => {
  const snapshot = useDiscordRpcStore((s) => s.snapshot);
  const load = useDiscordRpcStore((s) => s.load);
  const subscribe = useDiscordRpcStore((s) => s.subscribe);
  const patch = useDiscordRpcStore((s) => s.patch);
  const reconnect = useDiscordRpcStore((s) => s.reconnect);

  const [form, setForm] = useState<DiscordRpcSettings | null>(null);
  const lastJson = useRef<string>("");

  useEffect(() => {
    void load();
    const off = subscribe();
    return off;
  }, [load, subscribe]);

  useEffect(() => {
    if (!snapshot) return;
    const js = JSON.stringify(snapshot.settings);
    if (js !== lastJson.current) {
      lastJson.current = js;
      setForm(snapshot.settings);
    }
  }, [snapshot]);

  if (!snapshot || !form) return null;

  const status = snapshot.status;

  const commit = (patchObj: Partial<DiscordRpcSettings>) => {
    setForm((f) => (f ? { ...f, ...patchObj } : f));
    void patch(patchObj);
  };

  type TextKey = {
    [K in keyof DiscordRpcSettings]: DiscordRpcSettings[K] extends string
      ? K
      : never;
  }[keyof DiscordRpcSettings];

  const bindText = (key: TextKey) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) =>
        f ? ({ ...f, [key]: e.target.value } as DiscordRpcSettings) : f,
      ),
    onBlur: (e: React.FocusEvent<HTMLInputElement>) =>
      void patch({ [key]: e.target.value } as Partial<DiscordRpcSettings>),
  });

  const previewDetails = form.showDetails
    ? (describePresence({ kind: "forum_section", name: "Курилка" }) ??
      form.idleDetails)
    : form.idleDetails;
  const previewState =
    form.animation === "pulse" ? `✦ ${form.stateText}` : form.stateText;

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <span className={styles.headText}>
          <span className={styles.title}>
            <Gamepad2 size={18} /> Discord RPC
          </span>
          <span className={styles.subtitle}>
            Показывайте в Discord, чем вы заняты в Lolzteam Desktop
          </span>
        </span>
      </header>

      {}
      <div className={styles.card}>
        <div className={styles.rowBetween}>
          <span className={styles.fieldLabel}>Включить Discord RPC</span>
          <Toggle
            checked={form.enabled}
            onChange={(v) => commit({ enabled: v })}
          />
        </div>
        {form.enabled && (
          <div className={styles.statusRow}>
            <span
              className={`${styles.dot} ${
                status.connected ? styles.dotOn : styles.dotOff
              }`}
            />
            <span className={styles.statusText}>
              {status.connected
                ? "Подключено к Discord"
                : (status.lastError ?? "Ожидание клиента Discord…")}
            </span>
            {!status.connected && (
              <button
                type="button"
                className={styles.reconnect}
                onClick={() => void reconnect()}
              >
                <RefreshCw size={14} /> Переподключиться
              </button>
            )}
          </div>
        )}
      </div>

      {}
      <div className={styles.previewCard}>
        <img
          className={styles.previewImg}
          src={FAVICON_URL}
          alt="Lolzteam"
          draggable={false}
        />
        <div className={styles.previewBody}>
          <span className={styles.previewApp}>Lolzteam Desktop</span>
          <span className={styles.previewDetails}>{previewDetails}</span>
          <span className={styles.previewState}>{previewState}</span>
          {form.showElapsed && (
            <span className={styles.previewElapsed}>00:42 прошло</span>
          )}
        </div>
      </div>

      {}
      <div className={styles.card}>
        <span className={styles.cardTitle}>Содержимое</span>
        <div className={styles.rowBetween}>
          <span className={styles.fieldLabel}>Показывать, что смотрит пользователь</span>
          <Toggle
            checked={form.showDetails}
            onChange={(v) => commit({ showDetails: v })}
          />
        </div>
        <div className={styles.rowBetween}>
          <span className={styles.fieldLabel}>Показывать время использования</span>
          <Toggle
            checked={form.showElapsed}
            onChange={(v) => commit({ showElapsed: v })}
          />
        </div>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Строка «бездействие» (details)</span>
            <input className={styles.input} {...bindText("idleDetails")} />
            <span className={styles.fieldHint}>
              Показывается, когда активного контекста нет.
            </span>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Нижняя строка (state)</span>
            <input className={styles.input} {...bindText("stateText")} />
          </label>
        </div>
      </div>

      {}
      <div className={styles.card}>
        <span className={styles.cardTitle}>Анимация</span>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Стиль анимации</span>
            <select
              className={styles.select}
              value={form.animation}
              onChange={(e) =>
                commit({ animation: e.target.value as DiscordRpcAnimation })
              }
            >
              {ANIMATIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Интервал шага, сек</span>
            <input
              className={styles.input}
              type="number"
              min={4}
              value={form.animationIntervalSec}
              onChange={(e) =>
                commit({ animationIntervalSec: Number(e.target.value) })
              }
            />
            <span className={styles.fieldHint}>
              Не меньше 4 сек: Discord режет частые обновления.
            </span>
          </label>
        </div>
        {form.animation === "cycle" && (
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Строки для чередования (по одной на строку)</span>
            <textarea
              className={styles.textarea}
              rows={4}
              value={form.animationLines.join("\n")}
              onChange={(e) =>
                setForm((f) =>
                  f
                    ? { ...f, animationLines: e.target.value.split("\n") }
                    : f,
                )
              }
              onBlur={(e) =>
                void patch({
                  animationLines: e.target.value
                    .split("\n")
                    .map((x) => x.trim())
                    .filter((x) => x.length > 0),
                })
              }
            />
          </label>
        )}
      </div>

      {}
      <div className={styles.card}>
        <span className={styles.cardTitle}>Картинки</span>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ключ большой картинки</span>
            <input className={styles.input} {...bindText("largeImageKey")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Подпись большой картинки</span>
            <input className={styles.input} {...bindText("largeImageText")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ключ маленькой картинки</span>
            <input className={styles.input} {...bindText("smallImageKey")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Подпись маленькой картинки</span>
            <input className={styles.input} {...bindText("smallImageText")} />
          </label>
        </div>
        <span className={styles.fieldHint}>
          Картинки берутся не по ссылке, а по ключу ассета, загруженного в Discord
          Developer Portal → Rich Presence → Art Assets. Загрузите туда логотип
          Lolzteam как PNG с именем «lolzteam».
        </span>
      </div>

      {}
      <div className={styles.card}>
        <span className={styles.cardTitle}>Кнопки (до двух)</span>
        <div className={styles.grid2}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Название кнопки 1</span>
            <input className={styles.input} {...bindText("button1Label")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ссылка кнопки 1</span>
            <input className={styles.input} {...bindText("button1Url")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Название кнопки 2</span>
            <input className={styles.input} {...bindText("button2Label")} />
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Ссылка кнопки 2</span>
            <input className={styles.input} {...bindText("button2Url")} />
          </label>
        </div>
        <span className={styles.fieldHint}>
          Кнопка показывается, только если заполнены и название, и ссылка.
        </span>
      </div>

      <div className={styles.note}>
        <Plug size={14} /> Application ID: {" "}
        <code>{"1240457969867427881"}</code>. Для работы нужен запущенный
        десктоп-клиент Discord на том же компьютере.
      </div>
    </div>
  );
};
