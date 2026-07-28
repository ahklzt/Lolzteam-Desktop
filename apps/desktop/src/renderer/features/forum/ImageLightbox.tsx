import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as RPE,
} from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import styles from "./forum.module.scss";

interface Transform {
  scale: number;
  x: number;
  y: number;
}
const RESET: Transform = { scale: 1, x: 0, y: 0 };
const MIN = 1;
const MAX = 8;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const ImageLightbox = () => {
  const [src, setSrc] = useState<string | null>(null);
  const [tf, setTf] = useState<Transform>(RESET);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<{ src?: string }>).detail;
      if (detail?.src) {
        setSrc(detail.src);
        setTf(RESET);
      }
    };
    window.addEventListener("lzt:image-preview", onOpen);
    return () => window.removeEventListener("lzt:image-preview", onOpen);
  }, []);

  const close = useCallback(() => setSrc(null), []);

  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [src, close]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!el || !src) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setTf((prev) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const scale = clamp(prev.scale * factor, MIN, MAX);
        return scale === 1 ? RESET : { ...prev, scale };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [src]);

  if (!src) return null;

  const onPointerDown = (e: RPE) => {
    if (tf.scale <= 1) return;
    drag.current = { x: e.clientX, y: e.clientY, ox: tf.x, oy: tf.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: RPE) => {
    const d = drag.current;
    if (!d) return;
    setTf((prev) => ({
      ...prev,
      x: d.ox + (e.clientX - d.x),
      y: d.oy + (e.clientY - d.y),
    }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };
  const zoom = (dir: 1 | -1) =>
    setTf((prev) => {
      const scale = clamp(prev.scale * (dir > 0 ? 1.25 : 0.8), MIN, MAX);
      return scale === 1 ? RESET : { ...prev, scale };
    });

  return createPortal(
    <div
      ref={overlayRef}
      className={styles.lightbox}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.lightboxBar}>
        <button type="button" onClick={() => zoom(-1)} title="−">
          <Minus size={18} />
        </button>
        <button type="button" onClick={() => setTf(RESET)} title="100%">
          <RotateCcw size={16} />
        </button>
        <button type="button" onClick={() => zoom(1)} title="+">
          <Plus size={18} />
        </button>
        <button type="button" onClick={close} title="Esc">
          <X size={18} />
        </button>
      </div>
      <img
        className={styles.lightboxImg}
        src={src}
        alt=""
        draggable={false}
        style={{
          transform: `translate(${tf.x}px, ${tf.y}px) scale(${tf.scale})`,
          cursor: tf.scale > 1 ? (drag.current ? "grabbing" : "grab") : "auto",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={() => zoom(1)}
      />
    </div>,
    document.body,
  );
};
