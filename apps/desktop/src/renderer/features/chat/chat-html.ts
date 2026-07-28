import { getForumWebBase } from "@lzt/shared";
import { getEmojiByCode } from "~/data/emoji";

const ALLOWED_TAGS = new Set([
  "P", "BR", "A", "IMG", "SPAN", "DIV", "B", "I", "EM", "STRONG", "U", "S",
  "DEL", "INS", "STRIKE", "SUB", "SUP", "CODE", "PRE", "BLOCKQUOTE", "ABBR",
  "UL", "OL", "LI", "DL", "DD", "DT",
  "ASIDE", "BUTTON", "H1", "H2", "H3", "H4", "H5", "H6",
]);

const ALLOWED_ATTRS = new Set(["class", "style", "title", "alt"]);

const isSafeStyle = (value: string): boolean =>
  !/javascript:|expression\s*\(|url\s*\(/i.test(value);

const absolutize = (href: string): string | null => {
  const url = href.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return getForumWebBase() + url;
  return null;
};

const replaceEmojiInText = (node: Text): void => {
  const text = node.nodeValue ?? "";
  if (!text.includes(":")) return;
  const re = /:([\wа-яё+\-]+):/gi;
  const doc = node.ownerDocument;
  const frag = doc.createDocumentFragment();
  let last = 0;
  let replaced = false;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const emoji = getEmojiByCode(match[1] ?? "");
    if (!emoji) continue;
    replaced = true;
    frag.appendChild(doc.createTextNode(text.slice(last, match.index)));
    const img = doc.createElement("img");
    img.className = "chat-smilie";
    img.src = emoji.url;
    img.alt = match[0];
    img.title = emoji.title;
    img.loading = "lazy";
    frag.appendChild(img);
    last = match.index + match[0].length;
  }
  if (!replaced) return;
  frag.appendChild(doc.createTextNode(text.slice(last)));
  node.replaceWith(frag);
};

const walk = (el: Element): void => {
  for (const node of [...el.childNodes]) {
    if (node.nodeType === Node.TEXT_NODE) {
      replaceEmojiInText(node as Text);
      continue;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      (node as ChildNode).remove();
      continue;
    }
    const child = node as Element;
    const tag = child.tagName.toUpperCase();
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "IFRAME") {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      walk(child);
      child.replaceWith(...child.childNodes);
      continue;
    }
    for (const attr of [...child.attributes]) {
      const name = attr.name.toLowerCase();
      if (name === "href" && tag === "A") continue;
      if (name === "src" && tag === "IMG") continue;
      if (name === "data-cachedtitle") continue;
      const keep =
        ALLOWED_ATTRS.has(name) &&
        !name.startsWith("on") &&
        (name !== "style" || isSafeStyle(attr.value));
      if (!keep) child.removeAttribute(attr.name);
    }
    if (tag === "A") {
      const href = absolutize(child.getAttribute("href") ?? "");
      if (href) {
        child.setAttribute("href", href);
        child.setAttribute("target", "_blank");
        child.setAttribute("rel", "noreferrer noopener");
      } else {
        child.removeAttribute("href");
      }
    }
    if (tag === "IMG") {
      const abs = absolutize(child.getAttribute("src") ?? "");
      if (!abs) {
        child.remove();
        continue;
      }
      child.setAttribute("src", abs);
      child.setAttribute("loading", "lazy");
    }
    if (tag === "ABBR") {
      const tip = child.getAttribute("data-cachedtitle");
      if (tip && !child.getAttribute("title")) child.setAttribute("title", tip);
      child.removeAttribute("data-cachedtitle");
    }
    walk(child);
  }
};

export const renderChatHtml = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(
      `<div>${html}</div>`,
      "text/html",
    );
    const root = doc.body.firstElementChild;
    if (!root) return "";
    walk(root);
    return root.innerHTML;
  } catch {
    return "";
  }
};

export const chatHtmlToText = (html: string): string => {
  try {
    const doc = new DOMParser().parseFromString(
      `<div>${html}</div>`,
      "text/html",
    );
    for (const img of [...doc.querySelectorAll("img")]) {
      img.replaceWith(doc.createTextNode(img.getAttribute("alt") ?? ""));
    }
    for (const br of [...doc.querySelectorAll("br")]) {
      br.replaceWith(doc.createTextNode("\n"));
    }
    return (doc.body.textContent ?? "").trim();
  } catch {
    return "";
  }
};
