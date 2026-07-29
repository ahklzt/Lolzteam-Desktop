import net from "node:net";
import tls from "node:tls";
import type { MassMailProxyInput } from "@lzt/shared";

const TIMEOUT = 25_000;

type Socket = net.Socket | tls.TLSSocket;

class SocketReader {
  private buffer = Buffer.alloc(0);
  private waiter:
    | {
        size?: number;
        marker?: Buffer;
        resolve: (value: Buffer) => void;
        reject: (error: Error) => void;
      }
    | null = null;

  constructor(private readonly socket: Socket) {
    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
  }

  bytes(size: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.waiter = { size, resolve, reject };
      this.flush();
    });
  }

  until(marker: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      this.waiter = { marker: Buffer.from(marker, "latin1"), resolve, reject };
      this.flush();
    });
  }

  dispose(): void {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    this.socket.off("close", this.onClose);
  }

  private readonly onData = (chunk: Buffer): void => {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    this.flush();
  };

  private readonly onError = (error: Error): void => this.reject(error);
  private readonly onClose = (): void => this.reject(new Error("closed"));

  private reject(error: Error): void {
    const waiter = this.waiter;
    this.waiter = null;
    waiter?.reject(error);
  }

  private flush(): void {
    const waiter = this.waiter;
    if (!waiter) return;
    const markerIndex = waiter.marker
      ? this.buffer.indexOf(waiter.marker)
      : -1;
    const end =
      waiter.size !== undefined
        ? this.buffer.length >= waiter.size
          ? waiter.size
          : -1
        : waiter.marker && markerIndex >= 0
          ? markerIndex + waiter.marker.length
          : -1;
    if (end <= 0) {
      if (this.buffer.length > 32_768) this.reject(new Error("proxy_response_too_large"));
      return;
    }
    const value = this.buffer.subarray(0, end);
    this.buffer = this.buffer.subarray(end);
    this.waiter = null;
    waiter.resolve(value);
  }
}

const connectTcp = (host: string, port: number, signal?: AbortSignal): Promise<net.Socket> =>
  new Promise((resolve, reject) => {
    const socket = net.connect({ host, port });
    const abort = (): void => {
      socket.destroy(new Error("aborted"));
    };
    const fail = (error: Error): void => {
      signal?.removeEventListener("abort", abort);
      reject(error);
    };
    signal?.addEventListener("abort", abort, { once: true });
    socket.setTimeout(TIMEOUT, () => socket.destroy(new Error("timeout")));
    socket.once("error", fail);
    socket.once("connect", () => {
      socket.off("error", fail);
      signal?.removeEventListener("abort", abort);
      socket.setTimeout(0);
      resolve(socket);
    });
  });

const connectTls = (
  host: string,
  port: number,
  signal?: AbortSignal,
  tunnel?: Socket,
): Promise<tls.TLSSocket> =>
  new Promise((resolve, reject) => {
    const options: tls.ConnectionOptions = tunnel
      ? { socket: tunnel, servername: host, rejectUnauthorized: true }
      : { host, port, servername: host, rejectUnauthorized: true };
    const socket = tls.connect(options);
    const abort = (): void => {
      socket.destroy(new Error("aborted"));
    };
    const fail = (error: Error): void => {
      signal?.removeEventListener("abort", abort);
      reject(error);
    };
    signal?.addEventListener("abort", abort, { once: true });
    socket.setTimeout(TIMEOUT, () => socket.destroy(new Error("timeout")));
    socket.once("error", fail);
    socket.once("secureConnect", () => {
      socket.off("error", fail);
      signal?.removeEventListener("abort", abort);
      socket.setTimeout(0);
      resolve(socket);
    });
  });

const httpTunnel = async (
  socket: Socket,
  proxy: MassMailProxyInput,
  host: string,
  port: number,
): Promise<void> => {
  const reader = new SocketReader(socket);
  const auth =
    proxy.username && proxy.password
      ? `Proxy-Authorization: Basic ${Buffer.from(`${proxy.username}:${proxy.password}`).toString("base64")}\r\n`
      : "";
  socket.write(`CONNECT ${host}:${port} HTTP/1.1\r\nHost: ${host}:${port}\r\n${auth}\r\n`);
  const response = (await reader.until("\r\n\r\n")).toString("latin1");
  reader.dispose();
  const status = response.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i)?.[1];
  if (status !== "200") throw new Error(`proxy_connect_${status ?? "failed"}`);
};

const socks4Tunnel = async (
  socket: Socket,
  proxy: MassMailProxyInput,
  host: string,
  port: number,
): Promise<void> => {
  const reader = new SocketReader(socket);
  socket.write(
    Buffer.concat([
      Buffer.from([0x04, 0x01, port >> 8, port & 0xff, 0, 0, 0, 1]),
      Buffer.from(proxy.username ?? "", "utf8"),
      Buffer.from([0]),
      Buffer.from(host, "utf8"),
      Buffer.from([0]),
    ]),
  );
  const response = await reader.bytes(8);
  reader.dispose();
  if (response[1] !== 0x5a) throw new Error(`proxy_socks4_${response[1] ?? "failed"}`);
};

const socks5Tunnel = async (
  socket: Socket,
  proxy: MassMailProxyInput,
  host: string,
  port: number,
): Promise<void> => {
  const reader = new SocketReader(socket);
  const withAuth = Boolean(proxy.username || proxy.password);
  socket.write(Buffer.from(withAuth ? [5, 2, 0, 2] : [5, 1, 0]));
  const method = await reader.bytes(2);
  if (method[0] !== 5 || method[1] === 0xff) throw new Error("proxy_socks5_method");
  if (method[1] === 2) {
    const username = Buffer.from(proxy.username ?? "", "utf8");
    const password = Buffer.from(proxy.password ?? "", "utf8");
    if (username.length > 255 || password.length > 255) throw new Error("proxy_credentials_too_long");
    socket.write(Buffer.concat([Buffer.from([1, username.length]), username, Buffer.from([password.length]), password]));
    const auth = await reader.bytes(2);
    if (auth[1] !== 0) throw new Error("proxy_auth_failed");
  }
  const domain = Buffer.from(host, "utf8");
  if (domain.length > 255) throw new Error("target_host_too_long");
  socket.write(Buffer.concat([Buffer.from([5, 1, 0, 3, domain.length]), domain, Buffer.from([port >> 8, port & 0xff])]));
  const head = await reader.bytes(4);
  if (head[1] !== 0) throw new Error(`proxy_socks5_${head[1] ?? "failed"}`);
  const addressLength = head[3] === 1 ? 4 : head[3] === 4 ? 16 : head[3] === 3 ? (await reader.bytes(1))[0] : 0;
  if (!addressLength) throw new Error("proxy_socks5_address");
  await reader.bytes(addressLength + 2);
  reader.dispose();
};

export const openMailTls = async (
  host: string,
  port: number,
  proxy?: MassMailProxyInput,
  signal?: AbortSignal,
): Promise<tls.TLSSocket> => {
  if (!proxy) return connectTls(host, port, signal);
  const base =
    proxy.protocol === "https"
      ? await connectTls(proxy.host, proxy.port, signal)
      : await connectTcp(proxy.host, proxy.port, signal);
  try {
    if (proxy.protocol === "http" || proxy.protocol === "https") await httpTunnel(base, proxy, host, port);
    else if (proxy.protocol === "socks4") await socks4Tunnel(base, proxy, host, port);
    else await socks5Tunnel(base, proxy, host, port);
    return await connectTls(host, port, signal, base);
  } catch (error) {
    base.destroy();
    throw error;
  }
};
