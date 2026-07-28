import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import styles from "./forum.module.scss";

interface ColorPickerProps {
  onApply: (hex: string) => void;
  onBack: () => void;
}

const SWATCHES = [
  "#00ba78", "#2dce89", "#11cdef", "#1171ef", "#5e72e4", "#8965e0",
  "#f3a4b5", "#fb6340", "#f5365c", "#fbb140", "#ffd600", "#2dcecc",
  "#ffffff", "#d1d5db", "#9aa0a6", "#5f6368", "#3c4043", "#000000",
];

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const hsvToRgb = (h: number, s: number, v: number) => {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
};
const toHex = (n: number) => n.toString(16).padStart(2, "0");
const hsvToHex = (h: number, s: number, v: number) => {
  const { r, g, b } = hsvToRgb(h, s, v);
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};
const hexToHsv = (hex: string): { h: number; s: number; v: number } | null => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1]!, 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
};

export const ColorPicker = ({ onApply, onBack }: ColorPickerProps) => {
  const { t } = useTranslation();
  const [h, setH] = useState(150);
  const [s, setS] = useState(1);
  const [v, setV] = useState(0.85);
  const [hex, setHex] = useState(hsvToHex(150, 1, 0.85));
  const areaRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);
  const dragTarget = useRef<null | "area" | "hue">(null);

  useEffect(() => {
    setHex(hsvToHex(h, s, v));
  }, [h, s, v]);

  const applyFromArea = (clientX: number, clientY: number) => {
    const el = areaRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setS(clamp01((clientX - r.left) / r.width));
    setV(1 - clamp01((clientY - r.top) / r.height));
  };
  const applyFromHue = (clientY: number) => {
    const el = hueRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setH(clamp01((clientY - r.top) / r.height) * 360);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragTarget.current === "area") applyFromArea(e.clientX, e.clientY);
      else if (dragTarget.current === "hue") applyFromHue(e.clientY);
    };
    const onUp = () => {
      dragTarget.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const onHexInput = (value: string) => {
    setHex(value);
    const parsed = hexToHsv(value);
    if (parsed) {
      setH(parsed.h);
      setS(parsed.s);
      setV(parsed.v);
    }
  };

  const hueColor = hsvToHex(h, 1, 1);

  return (
    <div className={`${styles.edPopover} ${styles.edColorPop}`}>
      <div className={styles.edPopoverHead}>
        <button
          type="button"
          className={styles.edPopoverBack}
          onClick={onBack}
          title={t("forum.editor.back")}
        >
          <ArrowLeft size={16} />
        </button>
        <span>{t("forum.editor.color")}</span>
      </div>

      <div className={styles.edSwatches}>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={styles.edSwatch}
            style={{ background: c }}
            title={c}
            onClick={() => onHexInput(c)}
          />
        ))}
      </div>

      <div className={styles.edColorBody}>
        <div
          ref={areaRef}
          className={styles.edColorArea}
          style={{ background: hueColor }}
          onMouseDown={(e) => {
            dragTarget.current = "area";
            applyFromArea(e.clientX, e.clientY);
          }}
        >
          <span
            className={styles.edColorAreaThumb}
            style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
          />
        </div>
        <div
          ref={hueRef}
          className={styles.edHue}
          onMouseDown={(e) => {
            dragTarget.current = "hue";
            applyFromHue(e.clientY);
          }}
        >
          <span
            className={styles.edHueThumb}
            style={{ top: `${(h / 360) * 100}%` }}
          />
        </div>
      </div>

      <div className={styles.edColorBottom}>
        <span className={styles.edColorPreview} style={{ background: hex }} />
        <input
          className={styles.edHexInput}
          value={hex}
          onChange={(e) => onHexInput(e.target.value)}
          placeholder="#00BA78"
        />
        <button
          type="button"
          className={styles.edColorOk}
          onClick={() => onApply(hex)}
        >
          {t("forum.editor.colorOk")}
        </button>
      </div>
    </div>
  );
};
