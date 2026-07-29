import type {
  MailProvider,
  MassMailLetter,
  MassMailProxyInput,
} from "@lzt/shared";
import { parseMailMessage } from "./mail-imap";
import { openMailTls } from "./mail-transport";

const IO_TIMEOUT = 25_000;
const MAX_MESSAGE_SIZE = 1_048_576;

class Pop3Client {
  private socket: Awaited<ReturnType<typeof openMailTls>> | null = null;
  private buffer = Buffer.alloc(0);
  private waiter:
    | { resolve: (line: string) => void; reject: (error: Error) => void }
    | null = null;
  private failure: Error | null = null;
  private clearAbort: (() => void) | null = null;

  async connect(
    provider: MailProvider,
    proxy?: MassMailProxyInput,
    signal?: AbortSignal,
  ): Promise<void> {
    const socket = await openMailTls(
      provider.pop3Host,
      provider.pop3Port,
      proxy,
      signal,
    );
    this.socket = socket;
    const abort = (): void => {
      socket.destroy(new Error("aborted"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    this.clearAbort = () => signal?.removeEventListener("abort", abort);
    socket.setTimeout(IO_TIMEOUT);
    socket.on("data", (chunk: Buffer) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.flush();
    });
    socket.on("error", (error) => this.fail(error));
    socket.on("timeout", () => socket.destroy(new Error("timeout")));
    socket.on("close", () => this.fail(new Error("closed")));
    const greeting = await this.readLine();
    if (!greeting.startsWith("+OK")) throw new Error("pop3_greeting_failed");
  }

  async login(email: string, password: string): Promise<boolean> {
    if (!(await this.command(`USER ${email}`)).startsWith("+OK")) return false;
    return (await this.command(`PASS ${password}`)).startsWith("+OK");
  }

  async count(): Promise<number> {
    const response = await this.command("STAT");
    const count = Number.parseInt(response.split(/\s+/)[1] ?? "0", 10);
    return Number.isFinite(count) ? count : 0;
  }

  async retrieve(index: number): Promise<MassMailLetter | null> {
    if (!(await this.command(`RETR ${index}`)).startsWith("+OK")) return null;
    const lines: string[] = [];
    let size = 0;
    for (;;) {
      const line = await this.readLine();
      if (line === ".") break;
      const value = line.startsWith("..") ? line.slice(1) : line;
      size += Buffer.byteLength(value, "latin1") + 2;
      if (size <= MAX_MESSAGE_SIZE) lines.push(value);
    }
    const parsed = parseMailMessage(
      Buffer.from(lines.join("\r\n"), "latin1"),
    );
    if (parsed.subject.trim() === "" && parsed.text.trim() === "") return null;
    return {
      id: String(index),
      subject: parsed.subject,
      from: parsed.from,
      date: parsed.date,
      preview: parsed.text.replace(/\s+/g, " ").trim().slice(0, 200),
      body: parsed.text,
      bodyHtml: null,
      unread: null,
      matchedKeywords: [],
    };
  }

  async quit(): Promise<void> {
    try {
      await this.command("QUIT");
    } catch {
    }
  }

  close(): void {
    this.clearAbort?.();
    this.clearAbort = null;
    this.socket?.destroy();
    this.socket = null;
  }

  private command(value: string): Promise<string> {
    this.socket?.write(`${value}\r\n`, "utf8");
    return this.readLine();
  }

  private readLine(): Promise<string> {
    if (this.failure) return Promise.reject(this.failure);
    return new Promise((resolve, reject) => {
      this.waiter = { resolve, reject };
      this.flush();
    });
  }

  private flush(): void {
    if (!this.waiter) return;
    const index = this.buffer.indexOf("\r\n");
    if (index < 0) return;
    const line = this.buffer.subarray(0, index).toString("latin1");
    this.buffer = this.buffer.subarray(index + 2);
    const waiter = this.waiter;
    this.waiter = null;
    waiter.resolve(line);
  }

  private fail(error: Error): void {
    if (this.failure) return;
    this.failure = error;
    const waiter = this.waiter;
    this.waiter = null;
    waiter?.reject(error);
  }
}

export const fetchPop3Inbox = async (
  email: string,
  password: string,
  provider: MailProvider,
  limit: number,
  proxy?: MassMailProxyInput,
  signal?: AbortSignal,
): Promise<MassMailLetter[]> => {
  const client = new Pop3Client();
  try {
    await client.connect(provider, proxy, signal);
    if (!(await client.login(email, password))) throw new Error("auth_failed");
    const count = await client.count();
    const first = Math.max(1, count - limit + 1);
    const letters: MassMailLetter[] = [];
    for (let index = count; index >= first; index--) {
      if (signal?.aborted) throw new Error("aborted");
      const letter = await client.retrieve(index);
      if (letter) letters.push(letter);
    }
    await client.quit();
    return letters;
  } finally {
    client.close();
  }
};
