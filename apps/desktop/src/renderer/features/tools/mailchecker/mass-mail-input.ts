import type { MassMailAccountInput, MassMailProxyInput } from "@lzt/shared";

export interface ParsedInput<T> {
  values: T[];
  invalid: number;
}

export const parseAccounts = (source: string): ParsedInput<MassMailAccountInput> => {
  const values: MassMailAccountInput[] = [];
  let invalid = 0;
  source.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim();
    if (!line) return;
    const separator = line.indexOf(":");
    const email = line.slice(0, separator).trim();
    const password = line.slice(separator + 1);
    if (separator < 1 || !email.includes("@") || !password) {
      invalid += 1;
      return;
    }
    values.push({ id: `${index + 1}:${email}`, email, password });
  });
  return { values, invalid };
};

const protocols: MassMailProxyInput["protocol"][] = ["http", "https", "socks4", "socks5"];

export const parseProxies = (source: string): ParsedInput<MassMailProxyInput> => {
  const values: MassMailProxyInput[] = [];
  let invalid = 0;
  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    try {
      const legacy = !line.includes(":" + "//") ? line.split(":") : [];
      if (legacy.length >= 4) {
        const port = Number(legacy[1]);
        if (!legacy[0] || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
        values.push({ protocol: "http", host: legacy[0], port, username: legacy[2], password: legacy.slice(3).join(":") });
        continue;
      }
      const url = new URL(line.includes(":" + "//") ? line : "http" + "://" + line);
      const protocol = url.protocol.slice(0, -1) as MassMailProxyInput["protocol"];
      const port = Number(url.port);
      if (!protocols.includes(protocol) || !url.hostname || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error();
      values.push({
        protocol,
        host: url.hostname,
        port,
        ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
        ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      });
    } catch {
      invalid += 1;
    }
  }
  return { values, invalid };
};