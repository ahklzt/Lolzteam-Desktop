import { useMemo } from "react";
import { useMyProfile } from "~/features/forum/forum-hooks";
import { useLocalUniq } from "~/lib/localUniq";
import styles from "./RichUsername.module.scss";

interface Props {
  html: string | null;
  fallback: string;
  color?: string | null;
  className?: string;
  userId?: string | number | null;
}

const ALLOWED_TAGS = new Set([
  "SPAN",
  "A",
  "B",
  "I",
  "EM",
  "STRONG",
  "BDI",
  "SVG",
  "G",
  "PATH",
  "DEFS",
  "LINEARGRADIENT",
  "RADIALGRADIENT",
  "STOP",
  "CIRCLE",
  "RECT",
  "POLYGON",
  "POLYLINE",
  "LINE",
  "ELLIPSE",
  "CLIPPATH",
  "USE",
  "TITLE",
  "ANIMATE",
  "ANIMATETRANSFORM",
]);

const ALLOWED_ATTRS = new Set([
  "class",
  "style",
  "fill",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "stroke-dasharray",
  "d",
  "points",
  "cx",
  "cy",
  "r",
  "rx",
  "ry",
  "x",
  "y",
  "x1",
  "y1",
  "x2",
  "y2",
  "width",
  "height",
  "viewbox",
  "transform",
  "offset",
  "stop-color",
  "stop-opacity",
  "gradientunits",
  "gradienttransform",
  "opacity",
  "fill-rule",
  "fill-opacity",
  "clip-rule",
  "clip-path",
  "id",
]);

const isSafeStyle = (value: string): boolean =>
  !/javascript:|expression\s*\(/i.test(value);

const sanitizeNode = (node: Element): void => {
  for (const child of Array.from(node.children)) {
    if (!ALLOWED_TAGS.has(child.tagName.toUpperCase())) {
      sanitizeNode(child);
      child.replaceWith(...child.childNodes);
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const keep =
        ALLOWED_ATTRS.has(name) &&
        !name.startsWith("on") &&
        (name !== "style" || isSafeStyle(attr.value));
      if (!keep) child.removeAttribute(attr.name);
    }
    sanitizeNode(child);
  }
};

const sanitize = (raw: string): string => {
  try {
    const doc = new DOMParser().parseFromString(
      `<div>${raw}</div>`,
      "text/html",
    );
    const root = doc.body.firstElementChild;
    if (!root) return "";
    sanitizeNode(root);
    return root.innerHTML;
  } catch {
    return "";
  }
};

const hasMarkup = (value: string): boolean => /<[a-z][^>]*>/i.test(value);

const stripMarkup = (value: string): string => {
  try {
    const doc = new DOMParser().parseFromString(
      `<div>${value}</div>`,
      "text/html",
    );
    return (doc.body.textContent ?? "").trim();
  } catch {
    return value;
  }
};

export const RichUsername = ({
  html,
  fallback,
  color,
  className,
  userId = null,
}: Props) => {
  const safe = useMemo(() => (html ? sanitize(html) : ""), [html]);
  const fallbackHtml = useMemo(
    () => (hasMarkup(fallback) ? sanitize(fallback) : ""),
    [fallback],
  );
  const plainFallback = useMemo(
    () => (hasMarkup(fallback) ? stripMarkup(fallback) : fallback),
    [fallback],
  );
  const localUniq = useLocalUniq();
  const { data: me } = useMyProfile();
  const cls = className ? `${styles.root} ${className}` : styles.root;

  const isMe =
    !!me &&
    ((userId != null && String(userId) === String(me.userId)) ||
      (plainFallback.trim().length > 0 &&
        plainFallback.trim().toLowerCase() ===
          stripMarkup(me.username).toLowerCase()));
  const uniqIcon = useMemo(
    () => (isMe && localUniq?.iconSvg ? sanitize(localUniq.iconSvg) : ""),
    [isMe, localUniq],
  );
  if (isMe && localUniq) {
    return (
      <span className={cls} style={localUniq.usernameStyle}>
        {uniqIcon ? (
          <span
            className={styles.uniqIcon}
            dangerouslySetInnerHTML={{ __html: uniqIcon }}
          />
        ) : null}
        {plainFallback}
      </span>
    );
  }

  if (!safe) {
    if (fallbackHtml) {
      return (
        <span
          className={cls}
          dangerouslySetInnerHTML={{ __html: fallbackHtml }}
        />
      );
    }
    return (
      <span className={cls} style={color ? { color } : undefined}>
        {plainFallback}
      </span>
    );
  }
  return <span className={cls} dangerouslySetInnerHTML={{ __html: safe }} />;
};
