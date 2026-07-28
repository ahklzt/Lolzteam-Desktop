
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Code,
  Eraser,
  EyeOff,
  Flag,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Megaphone,
  Palette,
  Plus,
  Quote,
  Send,
  Strikethrough,
  Terminal,
  Type,
  User,
  type LucideIcon,
} from "lucide-react";
import { bbcodeToEditorHtml, editorHtmlToBbcode } from "~/lib/bb-editor";
import { ColorPicker } from "./ColorPicker";
import { GifPicker } from "./GifPicker";
import styles from "./forum.module.scss";

interface ForumEditorProps {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  sending?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}

const BLOCK = {
  quote: { open: "[QUOTE]", close: "[/QUOTE]" },
  spoiler: { open: "[SPOILER]", close: "[/SPOILER]" },
  srci: { open: "[ICODE]", close: "[/ICODE]" },
  reklama: { open: "[REKLAMA]", close: "[/REKLAMA]" },
  cenz: { open: "[CENZ]", close: "[/CENZ]" },
  guest: { open: "[GUEST]", close: "[/GUEST]" },
} as const;

interface InsertItem {
  id: string;
  labelKey: string;
  icon: LucideIcon;
  open?: string;
  close?: string;
}
const INSERT_ITEMS: InsertItem[] = [
  { id: "quote", labelKey: "quote", icon: Quote, ...BLOCK.quote },
  { id: "spoiler", labelKey: "spoiler", icon: Flag, ...BLOCK.spoiler },
  { id: "reklama", labelKey: "reklama", icon: Megaphone, ...BLOCK.reklama },
  { id: "code", labelKey: "code", icon: Code },
  { id: "srci", labelKey: "srci", icon: Terminal, ...BLOCK.srci },
  { id: "cenz", labelKey: "cenz", icon: EyeOff, ...BLOCK.cenz },
  { id: "guest", labelKey: "guest", icon: User, ...BLOCK.guest },
];

interface HideItem {
  id: string;
  labelKey: string;
  tag: string;
  param: boolean;
  paramKey?: string;
}
const HIDE_ITEMS: HideItem[] = [
  { id: "club", labelKey: "hideClub", tag: "CLUB", param: false },
  {
    id: "days",
    labelKey: "hideDays",
    tag: "DAYS",
    param: true,
    paramKey: "hideDaysParam",
  },
  {
    id: "except",
    labelKey: "hideExcept",
    tag: "EXCEPTIDS",
    param: true,
    paramKey: "hideExceptParam",
  },
  {
    id: "likes",
    labelKey: "hideLikes",
    tag: "LIKES",
    param: true,
    paramKey: "hideLikesParam",
  },
  {
    id: "likes2",
    labelKey: "hideLikes2",
    tag: "LIKES2",
    param: true,
    paramKey: "hideLikes2Param",
  },
  {
    id: "users",
    labelKey: "hideUsers",
    tag: "ONLYUSERS",
    param: true,
    paramKey: "hideUsersParam",
  },
];

const SIZE_ITEMS = [9, 10, 12, 14, 16, 18, 22, 26];

const ALIGN_ITEMS: Array<{
  id: "left" | "center" | "right";
  labelKey: string;
  icon: LucideIcon;
}> = [
  { id: "left", labelKey: "alignLeft", icon: AlignLeft },
  { id: "center", labelKey: "alignCenter", icon: AlignCenter },
  { id: "right", labelKey: "alignRight", icon: AlignRight },
];

const nodeToPlainText = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  if (el.tagName === "BR") return "\n";
  if (el.matches("img, [data-bb]")) return "";
  let out = "";
  el.childNodes.forEach((child) => {
    out += nodeToPlainText(child);
  });
  return out;
};

const buildPlainFragment = (text: string): DocumentFragment => {
  const frag = document.createDocumentFragment();
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (i > 0) frag.appendChild(document.createElement("br"));
    if (line) frag.appendChild(document.createTextNode(line));
  });
  return frag;
};

interface ModalField {
  name: string;
  label: string;
  type?: "input" | "textarea";
  placeholder?: string;
  required?: boolean;
}
interface ModalConfig {
  title: string;
  fields: ModalField[];
  hint?: string;
  submitLabel?: string;
  onConfirm: (values: Record<string, string>) => void;
}

export const ForumEditor = ({
  value,
  onChange,
  onSubmit,
  placeholder,
  rows = 3,
  disabled = false,
  sending = false,
  autoFocus = false,
  compact = false,
}: ForumEditorProps) => {
  const { t } = useTranslation();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const lastBb = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);

  const [menu, setMenu] = useState<
    null | "insert" | "hide" | "size" | "align"
  >(null);
  const [popover, setPopover] = useState<null | "link" | "gif" | "color">(
    null,
  );
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkPreview, setLinkPreview] = useState(false);
  const [modal, setModal] = useState<ModalConfig | null>(null);
  const [modalValues, setModalValues] = useState<Record<string, string>>({});
  const [isEmpty, setIsEmpty] = useState(!value);

  useLayoutEffect(() => {
    if (lastBb.current === value) return;
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = bbcodeToEditorHtml(value);
    lastBb.current = value;
    setIsEmpty(el.textContent?.trim() === "" && el.childElementCount === 0);
  }, [value]);

  useEffect(() => {
    if (autoFocus) editorRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!menu && !popover) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setMenu(null);
        setPopover(null);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu, popover]);

  const emit = () => {
    const el = editorRef.current;
    if (!el) return;
    const bb = editorHtmlToBbcode(el);
    lastBb.current = bb;
    setIsEmpty(
      el.textContent?.trim() === "" &&
        el.querySelector(".edAtomic, img, br") === null,
    );
    onChange(bb);
  };

  const currentRange = (): Range | null => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer))
      return null;
    return range;
  };

  const saveSelection = () => {
    const range = currentRange();
    savedRange.current = range ? range.cloneRange() : null;
  };

  const restoreSelection = (): Range | null => {
    const el = editorRef.current;
    if (!el) return null;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return null;
    if (savedRange.current) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
      return savedRange.current;
    }
    return currentRange();
  };

  const wrapRange = (range: Range, wrapper: HTMLElement) => {
    const sel = window.getSelection();
    if (range.collapsed) {
      wrapper.appendChild(document.createTextNode("\u200b"));
      range.insertNode(wrapper);
    } else {
      wrapper.appendChild(range.extractContents());
      range.insertNode(wrapper);
    }
    if (sel) {
      const r = document.createRange();
      r.selectNodeContents(wrapper);
      r.collapse(false);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    emit();
  };

  const wrapInline = (make: () => HTMLElement) => {
    editorRef.current?.focus();
    const range = currentRange();
    if (!range) return;
    wrapRange(range, make());
  };

  const insertNode = (range: Range | null, node: Node) => {
    const el = editorRef.current;
    if (!el) return;
    if (range) {
      range.deleteContents();
      range.insertNode(node);
    } else {
      el.appendChild(node);
    }
    const sel = window.getSelection();
    if (sel) {
      const r = document.createRange();
      r.setStartAfter(node);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
    emit();
  };

  const buildAtomic = (bb: string): Node => {
    const tpl = document.createElement("template");
    tpl.innerHTML = bbcodeToEditorHtml(bb);
    return tpl.content.firstChild ?? document.createTextNode("");
  };

  const insertAtomicSaved = (bb: string) => {
    const range = restoreSelection();
    insertNode(range, buildAtomic(bb));
  };

  const savedText = (): string => savedRange.current?.toString() ?? "";

  const clearFormatting = () => {
    editorRef.current?.focus();
    const sel = window.getSelection();
    const range = currentRange();
    if (range && !range.collapsed && sel) {
      const holder = document.createElement("div");
      holder.appendChild(range.cloneContents());
      const text = nodeToPlainText(holder);
      range.deleteContents();
      const plain = buildPlainFragment(text);
      const last = plain.lastChild;
      range.insertNode(plain);
      if (last) {
        const r = document.createRange();
        r.setStartAfter(last);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
      }
      emit();
      return;
    }
    const el = editorRef.current;
    if (!el) return;
    const text = nodeToPlainText(el);
    el.replaceChildren(buildPlainFragment(text));
    emit();
  };

  const openModal = (config: ModalConfig) => {
    saveSelection();
    setMenu(null);
    setPopover(null);
    setModalValues(Object.fromEntries(config.fields.map((f) => [f.name, ""])));
    setModal(config);
  };

  const openLinkPopover = () => {
    saveSelection();
    setMenu(null);
    setLinkUrl("");
    setLinkText(savedText());
    setLinkPreview(false);
    setPopover("link");
  };

  const confirmLink = () => {
    const url = linkUrl.trim();
    if (!url) return;
    const range = restoreSelection();
    if (!range) {
      setPopover(null);
      return;
    }
    if (linkPreview && !linkText.trim()) {
      insertNode(range, document.createTextNode(url));
    } else {
      const label = linkText.trim() || savedText() || url;
      const a = document.createElement("a");
      a.className = styles.edLink ?? "edLink";
      a.setAttribute("data-bb-url", url);
      a.setAttribute("href", url);
      a.textContent = label;
      insertNode(range, a);
    }
    setPopover(null);
  };

  const openGifPopover = () => {
    saveSelection();
    setMenu(null);
    setPopover("gif");
  };

  const pickGif = (url: string) => {
    insertAtomicSaved(`[IMG]${url}[/IMG]`);
    setPopover(null);
  };

  const openColorPopover = () => {
    saveSelection();
    setMenu(null);
    setPopover("color");
  };

  const applyColor = (hex: string) => {
    const range = restoreSelection();
    if (!range) {
      setPopover(null);
      return;
    }
    const span = document.createElement("span");
    span.setAttribute("data-bb-color", hex);
    span.style.color = hex;
    wrapRange(range, span);
    setPopover(null);
  };

  const applySize = (px: number) => {
    editorRef.current?.focus();
    const range = currentRange();
    if (!range) return;
    const span = document.createElement("span");
    span.setAttribute("data-bb-size", String(px));
    span.style.fontSize = `${px}px`;
    wrapRange(range, span);
    setMenu(null);
  };

  const applyAlign = (align: "left" | "center" | "right") => {
    editorRef.current?.focus();
    const range = currentRange();
    if (!range) return;
    const div = document.createElement("div");
    div.setAttribute("data-bb-align", align);
    div.style.textAlign = align;
    if (align === "center") div.className = styles.edCenter ?? "edCenter";
    wrapRange(range, div);
    setMenu(null);
  };

  const insertList = (numbered: boolean) => {
    editorRef.current?.focus();
    saveSelection();
    const selected = savedText();
    const open = numbered ? "[LIST=1]" : "[LIST]";
    insertAtomicSaved(`${open}\n[*]${selected}\n[/LIST]`);
    setMenu(null);
  };

  const openMediaModal = () =>
    openModal({
      title: t("forum.editor.media"),
      fields: [
        {
          name: "url",
          label: t("forum.editor.mediaUrlLabel"),
          placeholder: "https" + "://",
        },
      ],
      hint: t("forum.editor.mediaSites"),
      onConfirm: (v) => insertAtomicSaved(`[MEDIA]${v["url"] ?? ""}[/MEDIA]`),
    });

  const openCodeModal = () =>
    openModal({
      title: t("forum.editor.code"),
      fields: [
        {
          name: "lang",
          label: t("forum.editor.codeLang"),
          placeholder: t("forum.editor.codeLangNone"),
        },
        {
          name: "code",
          label: t("forum.editor.codeBody"),
          type: "textarea",
          required: true,
        },
      ],
      onConfirm: (v) => {
        const lang = (v["lang"] ?? "").trim();
        const body = v["code"] ?? "";
        const open = lang ? `[CODE=${lang}]` : "[CODE]";
        insertAtomicSaved(`${open}${body}[/CODE]`);
      },
    });

  const wrapBlock = (open: string, close: string) => {
    editorRef.current?.focus();
    saveSelection();
    const selected = savedText();
    insertAtomicSaved(`${open}${selected}${close}`);
    setMenu(null);
  };

  const onInsertItem = (item: InsertItem) => {
    if (item.id === "code") {
      openCodeModal();
      return;
    }
    if (item.open && item.close) wrapBlock(item.open, item.close);
  };

  const applyHide = (item: HideItem) => {
    if (!item.param) {
      wrapBlock(`[${item.tag}]`, `[/${item.tag}]`);
      return;
    }
    openModal({
      title: t(`forum.editor.${item.labelKey}`),
      fields: [
        {
          name: "value",
          label: t(`forum.editor.${item.paramKey ?? "hideValue"}`),
        },
      ],
      onConfirm: (v) => {
        const selected = savedText();
        insertAtomicSaved(
          `[${item.tag}=${v["value"] ?? ""}]${selected}[/${item.tag}]`,
        );
      },
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      const el = editorRef.current;
      if (onSubmit && !sending && el && editorHtmlToBbcode(el).trim())
        onSubmit();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      emit();
      return;
    }
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (key === "b") {
        e.preventDefault();
        wrapInline(() => document.createElement("strong"));
      } else if (key === "i") {
        e.preventDefault();
        wrapInline(() => document.createElement("em"));
      } else if (key === "s") {
        e.preventDefault();
        wrapInline(() => document.createElement("s"));
      }
    }
  };

  const onPaste = (e: ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

  const requiredName =
    modal?.fields.find((f) => f.required)?.name ?? modal?.fields[0]?.name;
  const modalOkDisabled =
    !!requiredName && !(modalValues[requiredName] ?? "").trim();

  const firstFieldName = modal?.fields[0]?.name;
  const canSend = !isEmpty;

  return (
    <div
      ref={wrapRef}
      className={`${styles.editor} ${compact ? styles.editorCompact : ""}`}
    >
      <div className={styles.edToolbar}>
        <button
          type="button"
          className={styles.edBtn}
          onMouseDown={keepFocus}
          onClick={clearFormatting}
          title={t("forum.editor.clear")}
        >
          <Eraser size={16} />
        </button>
        <button
          type="button"
          className={styles.edBtn}
          onMouseDown={keepFocus}
          onClick={() => wrapInline(() => document.createElement("strong"))}
          title={t("forum.editor.bold")}
        >
          <Bold size={16} />
        </button>
        <button
          type="button"
          className={styles.edBtn}
          onMouseDown={keepFocus}
          onClick={() => wrapInline(() => document.createElement("em"))}
          title={t("forum.editor.italic")}
        >
          <Italic size={16} />
        </button>
        <button
          type="button"
          className={styles.edBtn}
          onMouseDown={keepFocus}
          onClick={() => wrapInline(() => document.createElement("s"))}
          title={t("forum.editor.strike")}
        >
          <Strikethrough size={16} />
        </button>

        {}
        <div className={styles.edMenuWrap}>
          <button
            type="button"
            className={`${styles.edBtn} ${menu === "size" ? styles.edBtnActive : ""}`}
            onMouseDown={keepFocus}
            onClick={() => setMenu((m) => (m === "size" ? null : "size"))}
            title={t("forum.editor.size")}
          >
            <Type size={16} />
          </button>
          {menu === "size" && (
            <div className={`${styles.edMenu} ${styles.edSizeMenu}`}>
              {SIZE_ITEMS.map((px) => (
                <button
                  key={px}
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => applySize(px)}
                >
                  {px}
                </button>
              ))}
            </div>
          )}
        </div>

        {}
        <div className={styles.edMenuWrap}>
          <button
            type="button"
            className={`${styles.edBtn} ${popover === "color" ? styles.edBtnActive : ""}`}
            onMouseDown={keepFocus}
            onClick={() =>
              popover === "color" ? setPopover(null) : openColorPopover()
            }
            title={t("forum.editor.color")}
          >
            <Palette size={16} />
          </button>
          {popover === "color" && (
            <ColorPicker onApply={applyColor} onBack={() => setPopover(null)} />
          )}
        </div>

        {}
        <div className={styles.edMenuWrap}>
          <button
            type="button"
            className={`${styles.edBtn} ${menu === "align" ? styles.edBtnActive : ""}`}
            onMouseDown={keepFocus}
            onClick={() => setMenu((m) => (m === "align" ? null : "align"))}
            title={t("forum.editor.align")}
          >
            <AlignCenter size={16} />
          </button>
          {menu === "align" && (
            <div className={styles.edMenu}>
              {ALIGN_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => applyAlign(it.id)}
                  >
                    <Icon size={16} />
                    {t(`forum.editor.${it.labelKey}`)}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {}
        <button
          type="button"
          className={styles.edBtn}
          onMouseDown={keepFocus}
          onClick={() => insertList(false)}
          title={t("forum.editor.bulletList")}
        >
          <List size={16} />
        </button>

        {}
        <button
          type="button"
          className={styles.edBtn}
          onMouseDown={keepFocus}
          onClick={() => insertList(true)}
          title={t("forum.editor.numberedList")}
        >
          <ListOrdered size={16} />
        </button>

        <div className={styles.edMenuWrap}>
          <button
            type="button"
            className={`${styles.edBtn} ${popover === "link" ? styles.edBtnActive : ""}`}
            onMouseDown={keepFocus}
            onClick={() =>
              popover === "link" ? setPopover(null) : openLinkPopover()
            }
            title={t("forum.editor.link")}
          >
            <Link2 size={16} />
          </button>
          {popover === "link" && (
            <div className={styles.edPopover}>
              <div className={styles.edPopoverHead}>
                <button
                  type="button"
                  className={styles.edPopoverBack}
                  onClick={() => setPopover(null)}
                  title={t("forum.editor.back")}
                >
                  <ArrowLeft size={16} />
                </button>
              </div>
              <input
                autoFocus
                className={styles.edPopoverInput}
                placeholder={t("forum.editor.linkUrlLabel")}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
              />
              <input
                className={styles.edPopoverInput}
                placeholder={t("forum.editor.linkText")}
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
              />
              <label className={styles.edCheck}>
                <input
                  type="checkbox"
                  checked={linkPreview}
                  onChange={(e) => setLinkPreview(e.target.checked)}
                />
                {t("forum.editor.linkPreview")}
              </label>
              <button
                type="button"
                className={styles.edPopoverBtn}
                disabled={!linkUrl.trim()}
                onClick={confirmLink}
              >
                {t("forum.editor.insertEllipsis")}
              </button>
            </div>
          )}
        </div>
        <div className={styles.edMenuWrap}>
          <button
            type="button"
            className={`${styles.edBtn} ${styles.edGif} ${popover === "gif" ? styles.edBtnActive : ""}`}
            onMouseDown={keepFocus}
            onClick={() =>
              popover === "gif" ? setPopover(null) : openGifPopover()
            }
            title={t("forum.editor.gif")}
          >
            GIF
          </button>
          {popover === "gif" && (
            <GifPicker onPick={pickGif} onBack={() => setPopover(null)} />
          )}
        </div>
        <button
          type="button"
          className={styles.edBtn}
          onMouseDown={keepFocus}
          onClick={openMediaModal}
          title={t("forum.editor.media")}
        >
          <ImageIcon size={16} />
        </button>
        <div className={styles.edMenuWrap}>
          <button
            type="button"
            className={`${styles.edBtn} ${menu === "insert" ? styles.edBtnActive : ""}`}
            onMouseDown={keepFocus}
            onClick={() => setMenu((m) => (m === "insert" ? null : "insert"))}
            title={t("forum.editor.insert")}
          >
            <Plus size={16} />
          </button>
          {menu === "insert" && (
            <div className={styles.edMenu}>
              {INSERT_ITEMS.map((it) => {
                const Icon = it.icon;
                return (
                  <button
                    key={it.id}
                    type="button"
                    onMouseDown={keepFocus}
                    onClick={() => onInsertItem(it)}
                  >
                    <Icon size={16} />
                    {t(`forum.editor.${it.labelKey}`)}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className={styles.edMenuWrap}>
          <button
            type="button"
            className={`${styles.edBtn} ${menu === "hide" ? styles.edBtnActive : ""}`}
            onMouseDown={keepFocus}
            onClick={() => setMenu((m) => (m === "hide" ? null : "hide"))}
            title={t("forum.editor.hide")}
          >
            <EyeOff size={16} />
          </button>
          {menu === "hide" && (
            <div className={styles.edMenu}>
              {HIDE_ITEMS.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => applyHide(it)}
                >
                  {t(`forum.editor.${it.labelKey}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={styles.edInputRow}>
        <div className={styles.edEditableWrap}>
          <div
            ref={editorRef}
            className={styles.edEditable}
            contentEditable={!disabled}
            suppressContentEditableWarning
            role="textbox"
            aria-multiline="true"
            style={{ minHeight: `${Math.max(rows, 1) * 1.5 + 0.5}em` }}
            onInput={emit}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          {isEmpty && placeholder && (
            <div className={styles.edPlaceholder} aria-hidden="true">
              {placeholder}
            </div>
          )}
        </div>
        {onSubmit && (
          <button
            type="button"
            className={styles.edSend}
            disabled={disabled || sending || !canSend}
            onClick={() => onSubmit()}
            title={t("forum.send")}
          >
            <Send size={16} />
          </button>
        )}
      </div>

      {modal && (
        <div
          className={styles.edModalOverlay}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <div className={styles.edModal}>
            <div className={styles.edModalHead}>
              <span>{modal.title}</span>
              <button
                type="button"
                onClick={() => setModal(null)}
                title={t("common.close")}
              >
                ✕
              </button>
            </div>
            {modal.fields.map((f) => (
              <label key={f.name} className={styles.edField}>
                {f.label}
                {f.type === "textarea" ? (
                  <textarea
                    className={styles.edTextarea}
                    rows={7}
                    autoFocus={f.name === firstFieldName}
                    placeholder={f.placeholder}
                    value={modalValues[f.name] ?? ""}
                    onChange={(e) =>
                      setModalValues((prev) => ({
                        ...prev,
                        [f.name]: e.target.value,
                      }))
                    }
                  />
                ) : (
                  <input
                    autoFocus={f.name === firstFieldName}
                    placeholder={f.placeholder}
                    value={modalValues[f.name] ?? ""}
                    onChange={(e) =>
                      setModalValues((prev) => ({
                        ...prev,
                        [f.name]: e.target.value,
                      }))
                    }
                  />
                )}
              </label>
            ))}
            {modal.hint && <p className={styles.edModalHint}>{modal.hint}</p>}
            <div className={styles.edModalActions}>
              <button
                type="button"
                className={styles.edModalCancel}
                onClick={() => setModal(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className={styles.edModalOk}
                disabled={modalOkDisabled}
                onClick={() => {
                  modal.onConfirm(modalValues);
                  setModal(null);
                }}
              >
                {modal.submitLabel ?? t("common.insert")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
