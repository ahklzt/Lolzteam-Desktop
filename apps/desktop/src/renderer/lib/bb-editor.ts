
import { getEmojiByCode } from "../data/emoji";
import { bbcodeToHtml } from "./bbcode";

const INLINE = new Set([
  "b",
  "i",
  "u",
  "s",
  "color",
  "size",
  "font",
  "url",
  "center",
  "left",
  "right",
]);

const SELF = new Set(["visitor"]);

const ATOMIC = new Set([
  "quote",
  "spoiler",
  "code",
  "php",
  "html",
  "src",
  "srci",
  "icode",
  "plain",
  "list",
  "img",
  "media",
  "price",
  "button",
  "tooltip",
  "lang",
  "censor",
  "cenz",
  "reklama",
  "guest",
  "club",
  "days",
  "exceptids",
  "userids",
  "likes",
  "likes2",
  "onlyusers",
  "user",
  "email",
]);

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sizeToPx = (raw: string): number => {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 15;
  return n <= 7 ? 10 + n * 3 : Math.min(n, 48);
};

const safeColor = (raw: string): string | null => {
  const c = raw.trim();
  return /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s,.%]+\))$/i.test(c) ? c : null;
};

const safeUrl = (raw: string): string => {
  const u = raw.trim();
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^www\./i.test(u)) return "https://" + u;
  return "#";
};

const renderPlain = (text: string): string => {
  let out = escapeHtml(text);
  out = out.replace(/:([\wа-яё+-]+):/gi, (match, code: string) => {
    const emoji = getEmojiByCode(code);
    if (!emoji) return match;
    return (
      '<img class="bb-smilie" src="' +
      emoji.url +
      '" alt="' +
      match +
      '" title="' +
      escapeHtml(emoji.title) +
      '" loading="lazy" />'
    );
  });
  out = out.replace(/\r?\n/g, "<br />");
  return out;
};

interface ParsedTag {
  isClose: boolean;
  name: string;
  arg: string | undefined;
}

const parseTag = (tok: string): ParsedTag | null => {
  const m = /^\[(\/?)([a-zA-Z][a-zA-Z0-9*]*)(?:=([^\]]*))?\]$/.exec(tok);
  if (!m) return null;
  return { isClose: m[1] === "/", name: (m[2] ?? "").toLowerCase(), arg: m[3] };
};

const inlineOpen = (name: string, arg: string | undefined): string => {
  switch (name) {
    case "b":
      return "<strong>";
    case "i":
      return "<em>";
    case "u":
      return "<u>";
    case "s":
      return "<s>";
    case "center":
      return '<div class="edCenter" data-bb-align="center" style="text-align:center">';
    case "left":
      return '<div data-bb-align="left" style="text-align:left">';
    case "right":
      return '<div data-bb-align="right" style="text-align:right">';
    case "color": {
      const c = arg ? safeColor(arg) : null;
      if (!c) return "<span>";
      return (
        '<span data-bb-color="' +
        escapeHtml(c) +
        '" style="color:' +
        escapeHtml(c) +
        '">'
      );
    }
    case "size": {
      const raw = (arg ?? "").trim();
      const px = sizeToPx(raw);
      return (
        '<span data-bb-size="' +
        escapeHtml(raw) +
        '" style="font-size:' +
        px +
        'px">'
      );
    }
    case "font": {
      const fam = (arg ?? "").replace(/"/g, "");
      return (
        '<span data-bb-font="' +
        escapeHtml(fam) +
        '" style="font-family:' +
        escapeHtml(fam) +
        '">'
      );
    }
    case "url": {
      const href = arg ? safeUrl(arg) : "#";
      return (
        '<a class="edLink" data-bb-url="' +
        escapeHtml(arg ?? "") +
        '" href="' +
        escapeHtml(href) +
        '" rel="noreferrer noopener">'
      );
    }
    default:
      return "<span>";
  }
};

const inlineClose = (name: string): string => {
  if (name === "url") return "</a>";
  if (name === "center" || name === "left" || name === "right")
    return "</div>";
  if (name === "b") return "</strong>";
  if (name === "i") return "</em>";
  if (name === "u") return "</u>";
  if (name === "s") return "</s>";
  return "</span>";
};

const atomic = (raw: string): string =>
  '<span class="edAtomic" contenteditable="false" data-bb="' +
  escapeHtml(raw) +
  '">' +
  bbcodeToHtml(raw) +
  "</span>";

const collect = (
  tokens: string[],
  start: number,
  name: string,
): { inner: string; next: number; closed: boolean } => {
  let depth = 1;
  let inner = "";
  let i = start;
  for (; i < tokens.length; i++) {
    const tk = tokens[i] ?? "";
    const tg = parseTag(tk);
    if (tg && !tg.isClose && tg.name === name) {
      depth++;
    } else if (tg && tg.isClose && tg.name === name) {
      depth--;
      if (depth === 0) return { inner, next: i + 1, closed: true };
    }
    inner += tk;
  }
  return { inner, next: i, closed: false };
};

const TAG_RE = /(\[\/?[a-zA-Z][a-zA-Z0-9*]*(?:=[^\]\n]*)?\])/;

export const bbcodeToEditorHtml = (
  source: string | null | undefined,
): string => {
  if (!source) return "";
  const tokens = source.split(TAG_RE);
  let out = "";
  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i] ?? "";
    if (tok === "") {
      i++;
      continue;
    }
    const tag = parseTag(tok);
    if (!tag || tag.isClose) {
      out += tag ? escapeHtml(tok) : renderPlain(tok);
      i++;
      continue;
    }
    const name = tag.name;
    if (INLINE.has(name)) {
      const { inner, next } = collect(tokens, i + 1, name);
      out +=
        inlineOpen(name, tag.arg) +
        bbcodeToEditorHtml(inner) +
        inlineClose(name);
      i = next;
    } else if (SELF.has(name)) {
      out += atomic(tok);
      i++;
    } else if (ATOMIC.has(name)) {
      const { inner, next, closed } = collect(tokens, i + 1, name);
      const raw = tok + inner + (closed ? "[/" + name + "]" : "");
      out += atomic(raw);
      i = next;
    } else {
      out += escapeHtml(tok);
      i++;
    }
  }
  return out;
};


interface Wrapper {
  open: string;
  close: string;
}

const collectWrappers = (el: HTMLElement): Wrapper[] => {
  const wrappers: Wrapper[] = [];
  const ds = el.dataset;
  const style = el.style;

  const size = ds["bbSize"];
  if (size) wrappers.push({ open: "[SIZE=" + size + "]", close: "[/SIZE]" });
  else if (style.fontSize) {
    const px = parseInt(style.fontSize, 10);
    if (Number.isFinite(px))
      wrappers.push({ open: "[SIZE=" + px + "]", close: "[/SIZE]" });
  }

  const color = ds["bbColor"];
  if (color)
    wrappers.push({ open: "[COLOR=" + color + "]", close: "[/COLOR]" });
  else if (style.color)
    wrappers.push({ open: "[COLOR=" + style.color + "]", close: "[/COLOR]" });

  const font = ds["bbFont"];
  if (font) wrappers.push({ open: "[FONT=" + font + "]", close: "[/FONT]" });
  else if (style.fontFamily) {
    wrappers.push({
      open: "[FONT=" + style.fontFamily.replace(/"/g, "") + "]",
      close: "[/FONT]",
    });
  }

  const align = ds["bbAlign"] || style.textAlign;
  if (align === "center") {
    wrappers.push({ open: "[CENTER]", close: "[/CENTER]" });
  } else if (align === "left") {
    wrappers.push({ open: "[LEFT]", close: "[/LEFT]" });
  } else if (align === "right") {
    wrappers.push({ open: "[RIGHT]", close: "[/RIGHT]" });
  }

  const weight = style.fontWeight;
  if (weight === "bold" || weight === "700" || weight === "600") {
    wrappers.push({ open: "[B]", close: "[/B]" });
  }
  if (style.fontStyle === "italic")
    wrappers.push({ open: "[I]", close: "[/I]" });
  const deco = style.textDecorationLine || style.textDecoration;
  if (deco && deco.includes("line-through"))
    wrappers.push({ open: "[S]", close: "[/S]" });
  if (deco && deco.includes("underline"))
    wrappers.push({ open: "[U]", close: "[/U]" });

  return wrappers;
};

const serializeChildren = (node: Node): string => {
  let out = "";
  node.childNodes.forEach((child) => {
    out += serializeNode(child);
  });
  return out;
};

const serializeNode = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? "").replace(/\u200b/g, "");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;

  const rawBb = el.getAttribute("data-bb");
  if (rawBb !== null) return rawBb;

  const tag = el.tagName;
  if (tag === "BR") return "\n";
  if (tag === "IMG") {
    const cls = el.className || "";
    if (/bb-smilie|chat-smilie|mceSmilie/.test(cls))
      return el.getAttribute("alt") ?? "";
    const src = el.getAttribute("src");
    return src ? "[IMG]" + src + "[/IMG]" : "";
  }

  const inner = serializeChildren(el);

  switch (tag) {
    case "STRONG":
    case "B":
      return "[B]" + inner + "[/B]";
    case "EM":
    case "I":
      return "[I]" + inner + "[/I]";
    case "U":
      return "[U]" + inner + "[/U]";
    case "S":
    case "STRIKE":
    case "DEL":
      return "[S]" + inner + "[/S]";
    case "A": {
      const dataUrl = el.getAttribute("data-bb-url");
      let href =
        dataUrl && dataUrl.length > 0
          ? dataUrl
          : (el.getAttribute("href") ?? "");
      if (href === "#") href = "";
      if (!href) href = inner;
      return href === inner
        ? "[URL]" + inner + "[/URL]"
        : "[URL=" + href + "]" + inner + "[/URL]";
    }
    case "UL":
      return serializeList(el, false);
    case "OL":
      return serializeList(el, true);
    case "LI":
      return inner;
    case "DIV":
    case "P":
    case "SPAN":
    case "FONT": {
      const wrappers = collectWrappers(el);
      let s = inner;
      for (let k = wrappers.length - 1; k >= 0; k--) {
        const w = wrappers[k];
        if (w) s = w.open + s + w.close;
      }
      if (
        (tag === "DIV" || tag === "P") &&
        wrappers.length === 0 &&
        el.nextSibling &&
        !s.endsWith("\n")
      ) {
        s += "\n";
      }
      return s;
    }
    default:
      return inner;
  }
};

const serializeList = (el: HTMLElement, ordered: boolean): string => {
  const items: string[] = [];
  el.querySelectorAll(":scope > li").forEach((li) => {
    items.push("[*]" + serializeChildren(li).trim());
  });
  const open = ordered ? "[LIST=1]" : "[LIST]";
  return open + "\n" + items.join("\n") + "\n[/LIST]";
};

export const editorHtmlToBbcode = (root: HTMLElement): string =>
  serializeChildren(root)
    .replace(/\u200b/g, "")
    .replace(/\n{3,}/g, "\n\n");
