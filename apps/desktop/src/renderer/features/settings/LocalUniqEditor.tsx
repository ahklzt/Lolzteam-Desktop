import { ArrowLeft, Copy, Plus, Trash2 } from "lucide-react";
import { DEFAULT_SETTINGS } from "@lzt/shared";
import type { LocalUniqConfig, LocalUniqShadow } from "@lzt/shared";
import { useSettingsStore } from "~/stores/settings";
import { useSession } from "~/stores/session";
import { Toggle } from "~/widgets/Toggle";
import { buildBannerStyle, buildUsernameStyle } from "~/lib/localUniq";
import styles from "./LocalUniqEditor.module.scss";

const ALLOWED_PROPS = [
  "color",
  "text-shadow <= 3px",
  "border-radius",
  "background",
  "background-color",
  "background-image",
  "-webkit-background-clip",
  "-webkit-text-fill-color",
];

const BANNER_MAX = 24;
const ICON_MAX = 5000;

const toHexColor = (color: string): string =>
  /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffffff";

interface LocalUniqEditorProps {
  onBack: () => void;
}

export const LocalUniqEditor = ({ onBack }: LocalUniqEditorProps) => {
  const settings = useSettingsStore((s) => s.snapshot?.settings);
  const patch = useSettingsStore((s) => s.patch);
  const status = useSession((s) => s.status);
  const profile =
    status?.authenticated && !status.offline ? status.profile : null;

  const uniq: LocalUniqConfig =
    settings?.localUniq ?? DEFAULT_SETTINGS.localUniq;

  const update = (partial: Partial<LocalUniqConfig>) => {
    void patch({ localUniq: { ...uniq, ...partial } });
  };

  const updateShadow = (idx: number, partial: Partial<LocalUniqShadow>) => {
    const shadows = uniq.shadows.map((sh, i) =>
      i === idx ? { ...sh, ...partial } : sh,
    );
    update({ shadows });
  };

  const addShadow = () => {
    update({
      shadows: [...uniq.shadows, { x: 0, y: 0, blur: 3, color: "#ffffff" }],
    });
  };

  const cloneShadow = (idx: number) => {
    const src = uniq.shadows[idx];
    if (!src) return;
    const shadows = [...uniq.shadows];
    shadows.splice(idx + 1, 0, { ...src });
    update({ shadows });
  };

  const removeShadow = (idx: number) => {
    update({ shadows: uniq.shadows.filter((_, i) => i !== idx) });
  };

  const usernameStyle = buildUsernameStyle(uniq);
  const bannerStyle = buildBannerStyle(uniq);
  const name = profile?.username ?? "username";
  const avatar = profile?.avatarUrl ?? null;
  const bannerText = uniq.bannerText.trim();
  const charsLeft = BANNER_MAX - uniq.bannerText.length;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <button type="button" className={styles.backBtn} onClick={onBack}>
          <ArrowLeft size={16} />
          <span>Назад к настройкам</span>
        </button>
        <span className={styles.title}>Локальный Уник</span>
      </div>

      <div className={styles.enableRow}>
        <div className={styles.enableText}>
          <span className={styles.enableTitle}>Включить локальный уник</span>
          <span className={styles.enableDesc}>
            Оформление применяется только к вашему нику и только внутри
            приложения — на форуме ничего не меняется.
          </span>
        </div>
        <Toggle checked={uniq.enabled} onChange={(v) => update({ enabled: v })} />
      </div>

      <div className={styles.preview}>
        {avatar ? (
          <img className={styles.previewAvatar} src={avatar} alt="" />
        ) : (
          <span className={styles.previewAvatarFallback}>
            {name.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className={styles.previewInfo}>
          <span className={styles.previewName}>
            <span style={usernameStyle}>{name}</span>
            {uniq.usernameIconSvg ? (
              <span
                className={styles.previewIcon}
                dangerouslySetInnerHTML={{ __html: uniq.usernameIconSvg }}
              />
            ) : null}
          </span>
          {bannerText ? (
            <span className={styles.previewBanner} style={bannerStyle}>
              {bannerText}
            </span>
          ) : null}
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Текст лычки</h3>
          <p className={styles.groupDesc}>
            Максимум {BANNER_MAX} символа. Без текста лычка не показывается.
          </p>
        </div>
        <div className={styles.inputBox}>
          <input
            className={styles.input}
            value={uniq.bannerText}
            maxLength={BANNER_MAX}
            placeholder="Lolzteam"
            onChange={(e) => update({ bannerText: e.target.value })}
          />
          <span className={styles.charsLeft}>{charsLeft}</span>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Разрешённые CSS-свойства</h3>
        </div>
        <ul className={styles.allowed}>
          {ALLOWED_PROPS.map((p) => (
            <li key={p} className={styles.allowedItem}>
              {p}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Стиль ника</h3>
          <p className={styles.groupDesc}>
            CSS применяется к нику. Запрещены красные и чёрные цвета, а также
            стили, похожие на лычки командного состава.
          </p>
        </div>
        <textarea
          className={styles.textarea}
          value={uniq.usernameCss}
          placeholder="color: #0daf77"
          spellCheck={false}
          onChange={(e) => update({ usernameCss: e.target.value })}
        />
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Стиль лычки</h3>
          <p className={styles.groupDesc}>CSS применяется к лычке.</p>
        </div>
        <textarea
          className={styles.textarea}
          value={uniq.bannerCss}
          placeholder="background: #0daf77; color: #fff"
          spellCheck={false}
          onChange={(e) => update({ bannerCss: e.target.value })}
        />
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Тени для ника</h3>
          <p className={styles.groupDesc}>
            Каждая тень: смещение X/Y, размытие (до 3px) и цвет.
          </p>
        </div>
        <div className={styles.shadowList}>
          {uniq.shadows.map((sh, idx) => (
            <div key={idx} className={styles.shadowItem}>
              <div className={styles.shadowHead}>
                <span className={styles.shadowName}>Тень #{idx + 1}</span>
                <div className={styles.shadowBtns}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => cloneShadow(idx)}
                    aria-label="Дублировать тень"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => removeShadow(idx)}
                    aria-label="Удалить тень"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className={styles.shadowBody}>
                <label className={styles.cord}>
                  <input
                    type="number"
                    className={styles.cordInput}
                    value={sh.x}
                    onChange={(e) =>
                      updateShadow(idx, { x: Number(e.target.value) || 0 })
                    }
                  />
                  <span>x</span>
                </label>
                <label className={styles.cord}>
                  <input
                    type="number"
                    className={styles.cordInput}
                    value={sh.y}
                    onChange={(e) =>
                      updateShadow(idx, { y: Number(e.target.value) || 0 })
                    }
                  />
                  <span>y</span>
                </label>
                <label className={styles.cord}>
                  <input
                    type="number"
                    className={styles.cordInput}
                    min={0}
                    max={3}
                    value={sh.blur}
                    onChange={(e) =>
                      updateShadow(idx, {
                        blur: Math.min(
                          3,
                          Math.max(0, Number(e.target.value) || 0),
                        ),
                      })
                    }
                  />
                  <span>blur</span>
                </label>
                <input
                  type="color"
                  className={styles.colorInput}
                  value={toHexColor(sh.color)}
                  onChange={(e) => updateShadow(idx, { color: e.target.value })}
                />
              </div>
            </div>
          ))}
          <button type="button" className={styles.addBtn} onClick={addShadow}>
            <Plus size={16} />
            <span>Добавить тень</span>
          </button>
        </div>
      </div>

      <div className={styles.group}>
        <div className={styles.groupHead}>
          <h3 className={styles.groupTitle}>Иконка ника (SVG)</h3>
          <p className={styles.groupDesc}>
            Необязательно. Вставьте код SVG (до {ICON_MAX} символов) — иконка
            появится рядом с ником в превью.
          </p>
        </div>
        <textarea
          className={styles.textarea}
          value={uniq.usernameIconSvg ?? ""}
          placeholder="<svg ...>…</svg>"
          spellCheck={false}
          maxLength={ICON_MAX}
          onChange={(e) =>
            update({ usernameIconSvg: e.target.value.trim() || null })
          }
        />
      </div>
    </div>
  );
};
