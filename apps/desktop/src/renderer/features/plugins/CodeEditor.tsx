import { useMemo, useRef } from "react";
import styles from "./CodeEditor.module.scss";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
}

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "break", "continue", "new", "typeof", "instanceof",
  "in", "of", "await", "async", "try", "catch", "finally", "throw", "class",
  "extends", "super", "this", "import", "from", "export", "default", "void",
  "yield", "delete",
]);
const LITERALS = new Set(["null", "undefined", "true", "false"]);

const TOKEN =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`)|(\b\d[\d_]*(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)/g;

const highlight = (
  code: string,
  cls: Record<string, string>,
): string => {
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(code)) !== null) {
    out += escapeHtml(code.slice(last, m.index));
    const [full, comment, str, num, word] = m;
    if (comment != null) {
      out += `<span class="${cls.comment}">${escapeHtml(comment)}</span>`;
    } else if (str != null) {
      out += `<span class="${cls.string}">${escapeHtml(str)}</span>`;
    } else if (num != null) {
      out += `<span class="${cls.number}">${escapeHtml(num)}</span>`;
    } else if (word != null) {
      const kind = KEYWORDS.has(word)
        ? cls.keyword
        : LITERALS.has(word)
          ? cls.literal
          : "";
      out += kind
        ? `<span class="${kind}">${escapeHtml(word)}</span>`
        : escapeHtml(word);
    } else {
      out += escapeHtml(full);
    }
    last = m.index + full.length;
  }
  out += escapeHtml(code.slice(last));
  return out + "\n";
};

export const CodeEditor = ({
  value,
  onChange,
  placeholder,
  minRows = 14,
}: CodeEditorProps) => {
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const html = useMemo(() => highlight(value, styles), [value]);

  const onScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  };

  return (
    <div className={styles.editor} style={{ minHeight: `${minRows * 1.5}em` }}>
      <div className={styles.gutter} ref={gutterRef} aria-hidden>
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i} className={styles.lineNo}>
            {i + 1}
          </div>
        ))}
      </div>
      <div className={styles.codeArea}>
        <pre className={styles.highlight} ref={preRef} aria-hidden>
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
        <textarea
          className={styles.textarea}
          value={value}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onScroll={onScroll}
        />
      </div>
    </div>
  );
};
