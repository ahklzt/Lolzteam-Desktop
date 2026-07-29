import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { MessageSquareText, X } from "lucide-react";
import { useSettingsStore } from "~/stores/settings";
import { useChatStore } from "./chat-store";
import { ChatPanel } from "./ChatPanel";
import styles from "./chat.module.scss";

const BOX_KEY = "lzt.chat.floatingBox";
const MIN_W = 300;
const MIN_H = 360;

interface ChatBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clampBox = (box: ChatBox): ChatBox => {
  const width = Math.min(Math.max(box.width, MIN_W), window.innerWidth - 16);
  const height = Math.min(Math.max(box.height, MIN_H), window.innerHeight - 16);
  const left = Math.min(
    Math.max(box.left, 8),
    Math.max(window.innerWidth - width - 8, 8),
  );
  const top = Math.min(
    Math.max(box.top, 8),
    Math.max(window.innerHeight - height - 8, 8),
  );
  return { left, top, width, height };
};

const defaultBox = (): ChatBox =>
  clampBox({
    left: window.innerWidth - 586,
    top: window.innerHeight - 797,
    width: 566,
    height: 713,
  });

const loadBox = (): ChatBox => {
  try {
    const raw = localStorage.getItem(BOX_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ChatBox>;
      if (
        typeof parsed.left === "number" &&
        typeof parsed.top === "number" &&
        typeof parsed.width === "number" &&
        typeof parsed.height === "number"
      ) {
        return clampBox({
          left: parsed.left,
          top: parsed.top,
          width: parsed.width,
          height: parsed.height,
        });
      }
    }
  } catch {
    return defaultBox();
  }
  return defaultBox();
};

export const ChatWidget = () => {
  const separateWindow = useSettingsStore(
    (s) => s.snapshot?.settings.chatSeparateWindow ?? false,
  );
  const open = useChatStore((s) => s.open);
  const toggleOpen = useChatStore((s) => s.toggleOpen);

  const [box, setBox] = useState<ChatBox>(() => loadBox());
  const floatingRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<ChatBox>(box);
  const frameRef = useRef<number | null>(null);
  const pendingBoxRef = useRef<ChatBox | null>(null);
  const dragRef = useRef<{
    mode: "move" | "resize";
    x: number;
    y: number;
    box: ChatBox;
    pointerId: number;
    target: HTMLDivElement;
  } | null>(null);

  const renderBox = (next: ChatBox) => {
    const element = floatingRef.current;
    if (!element) return;
    element.style.left = `${next.left}px`;
    element.style.top = `${next.top}px`;
    element.style.width = `${next.width}px`;
    element.style.height = `${next.height}px`;
  };

  const scheduleBox = (next: ChatBox) => {
    boxRef.current = next;
    pendingBoxRef.current = next;
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const pending = pendingBoxRef.current;
      pendingBoxRef.current = null;
      if (pending) renderBox(pending);
    });
  };

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      scheduleBox(
        clampBox(
          drag.mode === "move"
            ? {
                left: drag.box.left + dx,
                top: drag.box.top + dy,
                width: drag.box.width,
                height: drag.box.height,
              }
            : {
                left: drag.box.left,
                top: drag.box.top,
                width: drag.box.width + dx,
                height: drag.box.height + dy,
              },
        ),
      );
    };
    const onUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== e.pointerId) return;
      dragRef.current = null;
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      pendingBoxRef.current = null;
      renderBox(boxRef.current);
      setBox(boxRef.current);
      floatingRef.current?.removeAttribute("data-interacting");
      if (drag.target.hasPointerCapture(drag.pointerId)) {
        drag.target.releasePointerCapture(drag.pointerId);
      }
      try {
        localStorage.setItem(BOX_KEY, JSON.stringify(boxRef.current));
      } catch {}
    };
    const onResize = () => {
      const next = clampBox(boxRef.current);
      boxRef.current = next;
      renderBox(next);
      setBox(next);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("resize", onResize);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const startDrag =
    (mode: "move" | "resize") => (e: ReactPointerEvent<HTMLDivElement>) => {
      if (
        mode === "move" &&
        e.target instanceof Element &&
        e.target.closest("button, a, input, textarea, select")
      ) {
        return;
      }
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      floatingRef.current?.setAttribute("data-interacting", "true");
      dragRef.current = {
        mode,
        x: e.clientX,
        y: e.clientY,
        box: boxRef.current,
        pointerId: e.pointerId,
        target: e.currentTarget,
      };
    };

  if (separateWindow) return null;

  return (
    <>
      {open && (
        <div
          ref={floatingRef}
          className={styles.floating}
          style={{
            left: box.left,
            top: box.top,
            right: "auto",
            bottom: "auto",
            width: box.width,
            height: box.height,
            maxHeight: "none",
          }}
        >
          <ChatPanel
            onDragStart={startDrag("move")}
            onClose={() => useChatStore.getState().setOpen(false)}
          />
          <div
            className={styles.resizeHandle}
            onPointerDown={startDrag("resize")}
            aria-hidden="true"
          />
        </div>
      )}
      <button
        type="button"
        className={styles.fab}
        onClick={toggleOpen}
        aria-label="Чат"
      >
        {open ? <X /> : <MessageSquareText />}
      </button>
    </>
  );
};
