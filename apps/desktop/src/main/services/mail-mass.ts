import { randomUUID } from "node:crypto";
import {
  detectMailProvider,
  mailProviderByKey,
  type MailLetter,
  type MailProvider,
  type MassMailAccountInput,
  type MassMailAccountResult,
  type MassMailAttempt,
  type MassMailCounters,
  type MassMailCustomServerInput,
  type MassMailDomainStat,
  type MassMailLetter,
  type MassMailProgressEvent,
  type MassMailProtocol,
  type MassMailProxyInput,
  type MassMailRunInput,
  type MassMailRunResult,
  type MassMailStopResult,
} from "@lzt/shared";
import log from "electron-log/main";
import { fetchInbox } from "./mail-imap";
import { fetchPop3Inbox } from "./mail-pop3";

interface ActiveRun {
  id: string;
  stopped: boolean;
  controllers: Set<AbortController>;
}

interface AttemptTarget {
  protocol: Exclude<MassMailProtocol, "auto">;
  provider: MailProvider;
}

let activeRun: ActiveRun | null = null;

const domainOf = (email: string): string =>
  email.split("@").at(-1)?.trim().toLowerCase() || "unknown";

const proxyLabel = (proxy?: MassMailProxyInput): string | null =>
  proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : null;

const toMassLetter = (letter: MailLetter): MassMailLetter => ({
  id: letter.uid,
  subject: letter.subject,
  from: letter.from,
  date: letter.date,
  preview: letter.preview,
  body: letter.body,
  bodyHtml: letter.bodyHtml ?? null,
  unread: !letter.seenOnServer,
  matchedKeywords: [],
});

const parseTime = (value: string | null): number | null => {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
};

const filterLetter = (
  letter: MassMailLetter,
  input: MassMailRunInput,
): MassMailLetter | null => {
  if (input.unreadOnly && letter.unread !== true) return null;
  const time = parseTime(letter.date);
  const from = parseTime(input.dateFrom);
  const to = parseTime(input.dateTo ? `${input.dateTo}T23:59:59.999` : null);
  if (from !== null && (time === null || time < from)) return null;
  if (to !== null && (time === null || time > to)) return null;
  const source = `${letter.subject}\n${letter.from}\n${letter.body}`.toLocaleLowerCase();
  const matchedKeywords = input.keywords.filter((keyword) =>
    source.includes(keyword.toLocaleLowerCase()),
  );
  if (input.keywords.length > 0 && matchedKeywords.length === 0) return null;
  return { ...letter, matchedKeywords };
};

const reasonOf = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  if (
    message === "auth_failed" ||
    message === "timeout" ||
    message === "select_failed" ||
    message === "invalid_credentials" ||
    message === "pop3_greeting_failed"
  ) {
    return message;
  }
  if (message === "aborted" || message === "closed") return "stopped";
  if (message.startsWith("proxy_")) return message;
  return "connect_failed";
};

const customProvider = (server: MassMailCustomServerInput): MailProvider => ({
  key: `custom-${server.protocol}`,
  label: `Custom ${server.protocol.toUpperCase()}`,
  imapHost: server.host,
  imapPort: server.port,
  pop3Host: server.host,
  pop3Port: server.port,
  domains: [],
});

const targetHost = (target: AttemptTarget): { host: string; port: number } =>
  target.protocol === "pop3"
    ? { host: target.provider.pop3Host, port: target.provider.pop3Port }
    : { host: target.provider.imapHost, port: target.provider.imapPort };

const addTarget = (targets: AttemptTarget[], target: AttemptTarget): void => {
  const server = targetHost(target);
  if (
    targets.some((current) => {
      const currentServer = targetHost(current);
      return (
        current.protocol === target.protocol &&
        currentServer.host === server.host &&
        currentServer.port === server.port
      );
    })
  ) {
    return;
  }
  targets.push(target);
};

const createTargets = (
  account: MassMailAccountInput,
  input: MassMailRunInput,
): AttemptTarget[] => {
  const provider =
    input.protocol === "hotmail"
      ? mailProviderByKey("outlook")
      : detectMailProvider(account.email);
  const customImap = input.customServers
    .filter((server) => server.protocol === "imap")
    .map(customProvider);
  const customPop3 = input.customServers
    .filter((server) => server.protocol === "pop3")
    .map(customProvider);
  const targets: AttemptTarget[] = [];

  if (input.protocol === "auto") {
    if (provider) {
      addTarget(targets, {
        protocol: provider.key === "outlook" ? "hotmail" : "imap",
        provider,
      });
      if (input.autoFallback && !input.unreadOnly) {
        addTarget(targets, { protocol: "pop3", provider });
      }
    }
    if (input.autoFallback || !provider) {
      for (const current of customImap) {
        addTarget(targets, { protocol: "imap", provider: current });
      }
      if (!input.unreadOnly) {
        for (const current of customPop3) {
          addTarget(targets, { protocol: "pop3", provider: current });
        }
      }
    }
    return targets;
  }

  if (input.protocol === "imap" && customImap.length > 0) {
    for (const current of customImap) {
      addTarget(targets, { protocol: "imap", provider: current });
    }
  } else if (input.protocol === "pop3" && customPop3.length > 0) {
    for (const current of customPop3) {
      addTarget(targets, { protocol: "pop3", provider: current });
    }
  }

  if (provider && (targets.length === 0 || input.autoFallback)) {
    addTarget(targets, { protocol: input.protocol, provider });
  }
  return targets;
};

const waitForRetry = (durationMs: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, durationMs);
    const abort = (): void => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", abort, { once: true });
  });

const failed = (
  account: MassMailAccountInput,
  protocol: Exclude<MassMailProtocol, "auto">,
  reason: string,
  startedAt: number,
  proxy?: MassMailProxyInput,
  attempts: MassMailAttempt[] = [],
): MassMailAccountResult => ({
  id: account.id,
  email: account.email,
  domain: domainOf(account.email),
  protocol,
  status:
    reason === "stopped"
      ? "stopped"
      : reason === "auth_failed" || reason === "hotmail_auth_failed"
        ? "bad"
        : "error",
  totalLetters: 0,
  matchCount: 0,
  letters: [],
  reason,
  attempts,
  durationMs: Date.now() - startedAt,
  proxy: proxyLabel(proxy),
});

const checkAccount = async (
  account: MassMailAccountInput,
  input: MassMailRunInput,
  proxy: MassMailProxyInput | undefined,
  signal: AbortSignal,
): Promise<MassMailAccountResult> => {
  const startedAt = Date.now();
  const fallback = input.protocol === "auto" ? "imap" : input.protocol;
  if (fallback === "pop3" && input.unreadOnly) {
    return failed(account, fallback, "pop3_unread_unsupported", startedAt, proxy);
  }
  const targets = createTargets(account, input);
  if (targets.length === 0) {
    return failed(account, fallback, "unknown_provider", startedAt, proxy);
  }
  if (fallback === "http" && targets[0]?.provider.key !== "gmx") {
    return failed(account, fallback, "http_gmx_only", startedAt, proxy);
  }

  const attempts: MassMailAttempt[] = [];
  let lastProtocol = targets[0]?.protocol ?? fallback;
  for (let round = 0; round < input.retryAttempts; round++) {
    for (const target of targets) {
      if (signal.aborted) {
        return failed(account, target.protocol, "stopped", startedAt, proxy, attempts);
      }
      lastProtocol = target.protocol;
      const server = targetHost(target);
      const attemptStartedAt = Date.now();
      try {
        let letters: MassMailLetter[];
        if (target.protocol === "pop3") {
          letters = await fetchPop3Inbox(
            account.email,
            account.password,
            target.provider,
            input.letterLimit,
            proxy,
            signal,
          );
        } else {
          const response = await fetchInbox(
            account.email,
            account.password,
            target.provider.key,
            input.letterLimit,
            { proxy, signal, provider: target.provider },
          );
          if (!response.ok) throw new Error(response.message);
          letters = response.letters.map(toMassLetter);
        }
        attempts.push({
          protocol: target.protocol,
          host: server.host,
          port: server.port,
          reason: null,
          durationMs: Date.now() - attemptStartedAt,
        });
        const matches = letters
          .map((letter) => filterLetter(letter, input))
          .filter((letter): letter is MassMailLetter => letter !== null);
        return {
          id: account.id,
          email: account.email,
          domain: domainOf(account.email),
          protocol: target.protocol,
          status: matches.length > 0 ? "found" : "good",
          totalLetters: letters.length,
          matchCount: matches.length,
          letters: matches,
          reason:
            target.protocol === "http"
              ? "gmx_compatible_mode"
              : attempts.length > 1
                ? "fallback_succeeded"
                : null,
          attempts,
          durationMs: Date.now() - startedAt,
          proxy: proxyLabel(proxy),
        };
      } catch (error) {
        const reason = signal.aborted ? "stopped" : reasonOf(error);
        attempts.push({
          protocol: target.protocol,
          host: server.host,
          port: server.port,
          reason,
          durationMs: Date.now() - attemptStartedAt,
        });
        log.warn(
          `[mass-mail] attempt failed domain=${domainOf(account.email)} protocol=${target.protocol} server=${server.host}:${server.port} reason=${reason}`,
        );
        if (reason === "stopped") {
          return failed(account, target.protocol, reason, startedAt, proxy, attempts);
        }
      }
    }
    if (round + 1 < input.retryAttempts && input.retryDelayMs > 0) {
      try {
        await waitForRetry(input.retryDelayMs, signal);
      } catch {
        return failed(account, lastProtocol, "stopped", startedAt, proxy, attempts);
      }
    }
  }

  const authFailed = attempts.some((attempt) => attempt.reason === "auth_failed");
  const reason = authFailed
    ? lastProtocol === "hotmail"
      ? "hotmail_auth_failed"
      : "auth_failed"
    : attempts.at(-1)?.reason ?? "connect_failed";
  return failed(account, lastProtocol, reason, startedAt, proxy, attempts);
};

const validInput = (input: MassMailRunInput): boolean => {
  const protocols: MassMailProtocol[] = ["auto", "imap", "pop3", "hotmail", "http"];
  return Boolean(
    input &&
      Array.isArray(input.accounts) &&
      input.accounts.length > 0 &&
      input.accounts.length <= 5_000 &&
      input.accounts.every(
        (account) =>
          typeof account.id === "string" &&
          typeof account.email === "string" &&
          account.email.includes("@") &&
          typeof account.password === "string" &&
          account.password.length > 0,
      ) &&
      Array.isArray(input.proxies) &&
      Array.isArray(input.customServers) &&
      input.customServers.every(
        (server) =>
          (server.protocol === "imap" || server.protocol === "pop3") &&
          typeof server.host === "string" &&
          server.host.trim().length > 0 &&
          Number.isInteger(server.port) &&
          server.port > 0 &&
          server.port <= 65_535,
      ) &&
      typeof input.autoFallback === "boolean" &&
      Array.isArray(input.keywords) &&
      protocols.includes(input.protocol),
  );
};

const createDomains = (accounts: MassMailAccountInput[]): Map<string, MassMailDomainStat> => {
  const domains = new Map<string, MassMailDomainStat>();
  for (const account of accounts) {
    const domain = domainOf(account.email);
    const stat = domains.get(domain);
    if (stat) stat.total += 1;
    else domains.set(domain, { domain, total: 1, checked: 0, found: 0, good: 0, bad: 0, errors: 0 });
  }
  return domains;
};

const domainList = (domains: Map<string, MassMailDomainStat>): MassMailDomainStat[] =>
  [...domains.values()].sort((a, b) => b.total - a.total || a.domain.localeCompare(b.domain));

export const runMassMail = async (
  raw: MassMailRunInput,
  onProgress: (event: MassMailProgressEvent) => void,
): Promise<MassMailRunResult> => {
  if (activeRun) return { ok: false, reason: "busy", message: "mass_mail_busy" };
  if (!validInput(raw)) return { ok: false, reason: "invalid_input", message: "mass_mail_invalid_input" };
  const input: MassMailRunInput = {
    ...raw,
    threads: Math.max(1, Math.min(50, Math.trunc(raw.threads) || 1)),
    letterLimit: Math.max(1, Math.min(100, Math.trunc(raw.letterLimit) || 30)),
    retryAttempts: Math.max(1, Math.min(5, Math.trunc(raw.retryAttempts) || 1)),
    retryDelayMs: Math.max(0, Math.min(10_000, Math.trunc(raw.retryDelayMs) || 0)),
    customServers: raw.customServers.map((server) => ({
      ...server,
      host: server.host.trim().toLowerCase(),
    })),
    keywords: raw.keywords.map((value) => value.trim()).filter(Boolean),
  };
  const run: ActiveRun = { id: randomUUID(), stopped: false, controllers: new Set() };
  activeRun = run;
  const counters: MassMailCounters = { total: input.accounts.length, checked: 0, found: 0, good: 0, bad: 0, errors: 0, stopped: 0 };
  const domains = createDomains(input.accounts);
  const results: MassMailAccountResult[] = [];
  let cursor = 0;
  const emit = (running: boolean, result?: MassMailAccountResult): void =>
    onProgress({ runId: run.id, running, counters: { ...counters }, domains: domainList(domains), ...(result ? { result } : {}) });
  emit(true);
  const worker = async (): Promise<void> => {
    while (!run.stopped) {
      const index = cursor++;
      const account = input.accounts[index];
      if (!account) return;
      const controller = new AbortController();
      run.controllers.add(controller);
      const proxy = input.proxies.length ? input.proxies[index % input.proxies.length] : undefined;
      const result = await checkAccount(account, input, proxy, controller.signal);
      run.controllers.delete(controller);
      results.push(result);
      counters.checked += 1;
      if (result.status === "found") counters.found += 1;
      else if (result.status === "good") counters.good += 1;
      else if (result.status === "bad") counters.bad += 1;
      else if (result.status === "stopped") counters.stopped += 1;
      else counters.errors += 1;
      const stat = domains.get(result.domain);
      if (stat) {
        stat.checked += 1;
        if (result.status === "found") stat.found += 1;
        else if (result.status === "good") stat.good += 1;
        else if (result.status === "bad") stat.bad += 1;
        else if (result.status === "error") stat.errors += 1;
      }
      emit(true, result);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(input.threads, input.accounts.length) }, worker));
    results.sort((a, b) => b.matchCount - a.matchCount || a.email.localeCompare(b.email));
    emit(false);
    return { ok: true, runId: run.id, stopped: run.stopped, counters, domains: domainList(domains), results };
  } finally {
    if (activeRun === run) activeRun = null;
  }
};

export const stopMassMail = (): MassMailStopResult => {
  if (!activeRun) return { ok: false, runId: null };
  activeRun.stopped = true;
  for (const controller of activeRun.controllers) controller.abort();
  return { ok: true, runId: activeRun.id };
};
