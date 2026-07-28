import tls from "node:tls";
import {
  type MailFetchResult,
  type MailLetter,
  detectMailProvider,
  mailProviderByKey,
  type MailProvider,
} from "@lzt/shared";
import log from "electron-log/main";


const CONNECT_TIMEOUT = 25_000;
const IO_TIMEOUT = 25_000;
const MAX_LITERAL = 1_048_576;
const DEFAULT_LIMIT = 30;

type Waiter =
  | {
      kind: "line";
      resolve: (line: string) => void;
      reject: (e: Error) => void;
    }
  | {
      kind: "bytes";
      n: number;
      resolve: (buf: Buffer) => void;
      reject: (e: Error) => void;
    };

class ImapClient {
  private socket: tls.TLSSocket | null = null;
  private buf: Buffer = Buffer.alloc(0);
  private waiter: Waiter | null = null;
  private failure: Error | null = null;
  private tag = 0;

  connect(host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = tls.connect(
        { host, port, servername: host, rejectUnauthorized: true },
        () => {
          socket.setTimeout(IO_TIMEOUT);
          resolve();
        },
      );
      this.socket = socket;
      let settled = false;
      const fail = (e: Error) => {
        if (settled) return;
        settled = true;
        this.failure = e;
        if (this.waiter) {
          const w = this.waiter;
          this.waiter = null;
          w.reject(e);
        }
        reject(e);
      };
      socket.setTimeout(CONNECT_TIMEOUT);
      socket.on("data", (chunk: Buffer) => {
        this.buf = Buffer.concat([this.buf, chunk]);
        this.pump();
      });
      socket.on("error", (e) =>
        fail(e instanceof Error ? e : new Error(String(e))),
      );
      socket.on("timeout", () => {
        socket.destroy();
        fail(new Error("timeout"));
      });
      socket.on("close", () => fail(new Error("closed")));
    });
  }

  private pump(): void {
    if (!this.waiter) return;
    if (this.waiter.kind === "line") {
      const idx = this.buf.indexOf("\r\n");
      if (idx >= 0) {
        const line = this.buf.subarray(0, idx).toString("latin1");
        this.buf = this.buf.subarray(idx + 2);
        const w = this.waiter;
        this.waiter = null;
        w.resolve(line);
      }
    } else {
      if (this.buf.length >= this.waiter.n) {
        const out = this.buf.subarray(0, this.waiter.n);
        this.buf = this.buf.subarray(this.waiter.n);
        const w = this.waiter;
        this.waiter = null;
        w.resolve(out);
      }
    }
  }

  private readLine(): Promise<string> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiter = { kind: "line", resolve, reject };
      this.pump();
    });
  }

  private readBytes(n: number): Promise<Buffer> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiter = { kind: "bytes", n, resolve, reject };
      this.pump();
    });
  }

  private write(s: string): void {
    this.socket?.write(s, "utf8");
  }

  private quote(s: string): string {
    return '"' + s.replace(/([\\"])/g, "\\$1") + '"';
  }

  private async command(
    cmd: string,
  ): Promise<{ ok: boolean; lines: string[]; literals: Buffer[] }> {
    const tag = "A" + ++this.tag;
    this.write(tag + " " + cmd + "\r\n");
    const lines: string[] = [];
    const literals: Buffer[] = [];
    for (let guard = 0; guard < 20_000; guard++) {
      const line = await this.readLine();
      const m = line.match(/\{(\d+)\}\s*$/);
      if (m) {
        const n = Math.min(parseInt(m[1], 10), MAX_LITERAL);
        const full = parseInt(m[1], 10);
        const body = await this.readBytes(full);
        literals.push(body.subarray(0, n));
        lines.push(line);
        continue;
      }
      if (line.startsWith(tag + " ")) {
        return { ok: /^OK/i.test(line.slice(tag.length + 1)), lines, literals };
      }
      lines.push(line);
    }
    return { ok: false, lines, literals };
  }

  async login(email: string, password: string): Promise<boolean> {
    const greeting = await this.readLine();
    if (!/^\* (OK|PREAUTH)/i.test(greeting)) return false;
    const r = await this.command(
      `LOGIN ${this.quote(email)} ${this.quote(password)}`,
    );
    return r.ok;
  }

  async selectInbox(): Promise<boolean> {
    return (await this.command("SELECT INBOX")).ok;
  }

  async searchAll(): Promise<number[]> {
    const r = await this.command("UID SEARCH ALL");
    const uids: number[] = [];
    for (const l of r.lines) {
      const m = l.match(/^\* SEARCH((?:\s+\d+)+)/i);
      if (m) {
        for (const n of m[1].trim().split(/\s+/)) uids.push(parseInt(n, 10));
      }
    }
    return uids;
  }

  async fetchOne(uid: number): Promise<MailLetter | null> {
    const r = await this.command(
      `UID FETCH ${uid} (FLAGS INTERNALDATE BODY.PEEK[])`,
    );
    if (!r.ok || r.literals.length === 0) return null;
    const meta = r.lines.find((l) => /\{\d+\}\s*$/.test(l)) ?? "";
    const seen = /FLAGS \([^)]*\\Seen/i.test(meta);
    const dm = meta.match(/INTERNALDATE "([^"]+)"/);
    const date = dm ? parseInternalDate(dm[1]) : null;
    const parsed = parseMessage(r.literals[0]!);
    if (parsed.subject.trim() === "" && parsed.text.trim() === "") return null;
    const preview = parsed.text.replace(/\s+/g, " ").trim().slice(0, 200);
    return {
      uid: String(uid),
      subject: parsed.subject,
      from: parsed.from,
      fromAddress: extractAddress(parsed.from),
      date,
      preview,
      body: parsed.text,
      seenOnServer: seen,
    };
  }

  async logout(): Promise<void> {
    try {
      await this.command("LOGOUT");
    } catch {
    }
  }

  close(): void {
    try {
      this.socket?.destroy();
    } catch {
    }
    this.socket = null;
  }
}

export const fetchInbox = async (
  email: string,
  password: string,
  providerKey: string | undefined,
  limit = DEFAULT_LIMIT,
): Promise<MailFetchResult> => {
  const addr = email.trim();
  const pass = password;
  if (addr === "" || pass === "" || !addr.includes("@")) {
    return { ok: false, message: "invalid_credentials" };
  }
  const provider: MailProvider | null =
    (providerKey ? mailProviderByKey(providerKey) : null) ??
    detectMailProvider(addr);
  if (!provider) {
    return { ok: false, message: "unknown_provider" };
  }

  const client = new ImapClient();
  try {
    await client.connect(provider.imapHost, provider.imapPort);
    const ok = await client.login(addr, pass);
    if (!ok) {
      client.close();
      return { ok: false, message: "auth_failed" };
    }
    if (!(await client.selectInbox())) {
      client.close();
      return { ok: false, message: "select_failed" };
    }
    const uids = await client.searchAll();
    uids.sort((a, b) => a - b);
    const recent = uids.slice(-Math.max(1, Math.min(100, limit))).reverse();
    const letters: MailLetter[] = [];
    for (const uid of recent) {
      const letter = await client.fetchOne(uid);
      if (letter) letters.push(letter);
    }
    await client.logout();
    client.close();
    return { ok: true, provider: provider.key, email: addr, letters };
  } catch (err) {
    client.close();
    log.warn("[mail] imap fetch failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "timeout") return { ok: false, message: "timeout" };
    return { ok: false, message: "connect_failed" };
  }
};


interface ParsedMessage {
  subject: string;
  from: string;
  text: string;
}

const parseMessage = (raw: Buffer): ParsedMessage => {
  const s = raw.toString("latin1");
  const [head, body] = splitHead(s);
  const headers = parseHeaders(head);
  const subject = decodeHeaderWord(headers["subject"] ?? "");
  const from = decodeHeaderWord(headers["from"] ?? "");
  const text = partToText(headers, body, 0);
  return { subject, from, text };
};

const splitHead = (raw: string): [string, string] => {
  let p = raw.indexOf("\r\n\r\n");
  if (p >= 0) return [raw.slice(0, p), raw.slice(p + 4)];
  p = raw.indexOf("\n\n");
  if (p >= 0) return [raw.slice(0, p), raw.slice(p + 2)];
  return [raw, ""];
};

const parseHeaders = (head: string): Record<string, string> => {
  const out: Record<string, string> = {};
  let cur = "";
  for (const line of head.split(/\r?\n/)) {
    if (line !== "" && (line[0] === " " || line[0] === "\t")) {
      cur += " " + line.trim();
      continue;
    }
    if (cur !== "") pushHeader(out, cur);
    cur = line;
  }
  if (cur !== "") pushHeader(out, cur);
  return out;
};

const pushHeader = (out: Record<string, string>, line: string): void => {
  const p = line.indexOf(":");
  if (p < 0) return;
  const name = line.slice(0, p).trim().toLowerCase();
  if (!(name in out)) out[name] = line.slice(p + 1).trim();
};

const decodeHeaderWord = (value: string): string => {
  if (value === "") return "";
  const joined = value.replace(/\?=\s+=\?/g, "?==?");
  return joined.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (whole, charset: string, enc: string, text: string) => {
      try {
        let bytes: Buffer;
        if (enc.toUpperCase() === "B") {
          bytes = Buffer.from(text, "base64");
        } else {
          const q = text
            .replace(/_/g, " ")
            .replace(/=([0-9A-Fa-f]{2})/g, (_m, h: string) =>
              String.fromCharCode(parseInt(h, 16)),
            );
          bytes = Buffer.from(q, "latin1");
        }
        return decodeBytes(bytes, charset);
      } catch {
        return whole;
      }
    },
  );
};

const partToText = (
  headers: Record<string, string>,
  body: string,
  depth: number,
): string => {
  if (depth > 4) return "";
  const ct = (headers["content-type"] ?? "text/plain").toLowerCase();
  if (ct.startsWith("multipart/")) {
    const bm = (headers["content-type"] ?? "").match(/boundary="?([^";]+)"?/i);
    if (!bm) return "";
    let plain = "";
    let html = "";
    for (const part of body.split("--" + bm[1])) {
      const trimmed = part.replace(/^\r?\n/, "");
      if (trimmed === "" || trimmed.startsWith("--")) continue;
      const [ph, pb] = splitHead(trimmed);
      const hh = parseHeaders(ph);
      const pct = (hh["content-type"] ?? "text/plain").toLowerCase();
      const txt = partToText(hh, pb, depth + 1);
      if (txt === "") continue;
      if (pct.startsWith("text/plain") && plain === "") plain = txt;
      else if (html === "") html = txt;
    }
    return plain !== "" ? plain : html;
  }
  const decoded = decodeTransfer(
    body,
    (headers["content-transfer-encoding"] ?? "").toLowerCase(),
  );
  const csMatch = (headers["content-type"] ?? "").match(
    /charset="?([A-Za-z0-9._\-]+)"?/i,
  );
  const text = decodeBytes(decoded, csMatch ? csMatch[1] : "utf-8");
  if (ct.startsWith("text/html")) return htmlToText(text);
  if (ct.startsWith("text/")) return text.trim();
  return "";
};

const decodeTransfer = (s: string, enc: string): Buffer => {
  if (enc === "base64") {
    return Buffer.from(s.replace(/\s+/g, ""), "base64");
  }
  if (enc === "quoted-printable") {
    return qpDecode(s);
  }
  return Buffer.from(s, "latin1");
};

const qpDecode = (s: string): Buffer => {
  const noSoft = s.replace(/=\r?\n/g, "");
  const out: number[] = [];
  for (let i = 0; i < noSoft.length; i++) {
    const c = noSoft[i]!;
    if (c === "=") {
      const hex = noSoft.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        out.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
      out.push(0x3d);
    } else {
      out.push(c.charCodeAt(0) & 0xff);
    }
  }
  return Buffer.from(out);
};

const decodeBytes = (bytes: Buffer, charset: string): string => {
  const cs = charset.trim().toLowerCase();
  if (
    cs === "" ||
    cs === "us-ascii" ||
    cs === "ascii" ||
    cs === "utf-8" ||
    cs === "utf8"
  ) {
    return new TextDecoder("utf-8").decode(bytes);
  }
  try {
    return new TextDecoder(cs).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
};

const htmlToText = (input: string): string => {
  const looksHtml = /<(html|a\s|div|td|br|p)/i.test(input);
  if (!looksHtml) return input.trim();
  let s = input.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  s = s.replace(/<a\b[^>]*href=["']?([^"'\s>]+)["']?[^>]*>/gi, " $1 ");
  s = s.replace(/<(br|\/p|\/div|\/tr|\/li|\/h\d)[^>]*>/gi, "\n");
  s = s.replace(/<[^>]+>/g, " ");
  s = decodeEntities(s);
  return s
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, n: string) =>
      String.fromCodePoint(parseInt(n, 10)),
    )
    .replace(/&#x([0-9A-Fa-f]+);/g, (_m, n: string) =>
      String.fromCodePoint(parseInt(n, 16)),
    );

const extractAddress = (from: string): string => {
  const m = from.match(/<([^>]+)>/);
  if (m) return m[1]!.trim();
  const bare = from.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+/);
  return bare ? bare[0] : from.trim();
};

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};
const parseInternalDate = (v: string): string | null => {
  const m = v.match(
    /(\d{1,2})-([A-Za-z]{3})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})\s+([+\-]\d{4})/,
  );
  if (!m) return null;
  const mon = MONTHS[m[2]!.toLowerCase()];
  if (mon === undefined) return null;
  const [, dd, , yyyy, hh, mm, ss, tz] = m;
  const sign = tz![0] === "-" ? -1 : 1;
  const offMin =
    sign * (parseInt(tz!.slice(1, 3), 10) * 60 + parseInt(tz!.slice(3, 5), 10));
  const utc = Date.UTC(
    parseInt(yyyy!, 10),
    mon,
    parseInt(dd!, 10),
    parseInt(hh!, 10),
    parseInt(mm!, 10),
    parseInt(ss!, 10),
  );
  return new Date(utc - offMin * 60_000).toISOString();
};
