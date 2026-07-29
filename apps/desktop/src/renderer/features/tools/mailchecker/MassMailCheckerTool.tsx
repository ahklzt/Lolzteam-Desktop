import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Inbox, MailSearch, Play, RotateCcw, Square, X } from "lucide-react";
import type {
  MassMailAccountResult,
  MassMailCounters,
  MassMailCustomServerInput,
  MassMailDomainStat,
  MassMailLetter,
  MassMailProtocol,
} from "@lzt/shared";
import { parseAccounts, parseProxies } from "./mass-mail-input";
import styles from "./MassMailCheckerTool.module.scss";

const EMPTY_COUNTERS: MassMailCounters = {
  total: 0,
  checked: 0,
  found: 0,
  good: 0,
  bad: 0,
  errors: 0,
  stopped: 0,
};

const PROTOCOLS: MassMailProtocol[] = ["auto", "imap", "pop3", "hotmail", "http"];
const METRIC_KEYS = ["found", "good", "bad", "errors", "stopped"] as const;

const STATUS_ORDER: Record<MassMailAccountResult["status"], number> = {
  found: 0,
  good: 1,
  bad: 2,
  error: 3,
  stopped: 4,
};

const formatDate = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

const sortResults = (items: MassMailAccountResult[]): MassMailAccountResult[] =>
  [...items].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || b.matchCount - a.matchCount,
  );

export const MassMailCheckerTool = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const [accountsText, setAccountsText] = useState("");
  const [proxiesText, setProxiesText] = useState("");
  const [keywordsText, setKeywordsText] = useState("");
  const [protocol, setProtocol] = useState<MassMailProtocol>("auto");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [threads, setThreads] = useState(10);
  const [letterLimit, setLetterLimit] = useState(30);
  const [customSettingsOpen, setCustomSettingsOpen] = useState(false);
  const [customImapEnabled, setCustomImapEnabled] = useState(false);
  const [customImapHost, setCustomImapHost] = useState("");
  const [customImapPort, setCustomImapPort] = useState(993);
  const [customPop3Enabled, setCustomPop3Enabled] = useState(false);
  const [customPop3Host, setCustomPop3Host] = useState("");
  const [customPop3Port, setCustomPop3Port] = useState(995);
  const [autoFallback, setAutoFallback] = useState(true);
  const [retryAttempts, setRetryAttempts] = useState(2);
  const [retryDelayMs, setRetryDelayMs] = useState(1500);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [counters, setCounters] = useState<MassMailCounters>(EMPTY_COUNTERS);
  const [domains, setDomains] = useState<MassMailDomainStat[]>([]);
  const [results, setResults] = useState<MassMailAccountResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<MassMailAccountResult | null>(null);
  const [selectedLetter, setSelectedLetter] = useState<MassMailLetter | null>(null);

  const parsedAccounts = useMemo(() => parseAccounts(accountsText), [accountsText]);
  const parsedProxies = useMemo(() => parseProxies(proxiesText), [proxiesText]);
  const customServers = useMemo<MassMailCustomServerInput[]>(() => {
    const servers: MassMailCustomServerInput[] = [];
    if (customImapEnabled && customImapHost.trim()) {
      servers.push({ protocol: "imap", host: customImapHost.trim(), port: customImapPort });
    }
    if (customPop3Enabled && customPop3Host.trim()) {
      servers.push({ protocol: "pop3", host: customPop3Host.trim(), port: customPop3Port });
    }
    return servers;
  }, [customImapEnabled, customImapHost, customImapPort, customPop3Enabled, customPop3Host, customPop3Port]);
  const customServersInvalid =
    (customImapEnabled && !customImapHost.trim()) ||
    (customPop3Enabled && !customPop3Host.trim());
  const keywords = useMemo(
    () =>
      keywordsText
        .split(/[\r\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean),
    [keywordsText],
  );
  const progress = counters.total > 0 ? Math.round((counters.checked / counters.total) * 100) : 0;

  const translateReason = useCallback(
    (reason: string | null | undefined): string => {
      if (!reason) return "—";
      return t(`massMail.reasons.${reason}`, { defaultValue: reason });
    },
    [t],
  );

  const selectedLetterHtml = useMemo(() => {
    if (!selectedLetter?.bodyHtml) return null;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0;
        padding: 16px;
        font: 14px/1.55 Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #f3f5f7;
        background: #101317;
        overflow-wrap: anywhere;
      }
      img, video, iframe { max-width: 100%; height: auto; }
      a { color: #6fb8ff; }
      pre { white-space: pre-wrap; }
    </style>
  </head>
  <body>${selectedLetter.bodyHtml}</body>
</html>`;
  }, [selectedLetter]);

  useEffect(
    () =>
      window.moderator.massMail.onProgress((event) => {
        setRunning(event.running);
        setCounters(event.counters);
        setDomains(event.domains);
        const result = event.result;
        if (!result) return;
        setResults((current) =>
          sortResults([...current.filter((item) => item.id !== result.id), result]),
        );
        setSelectedResult((current) => (current?.id === result.id ? result : current));
      }),
    [],
  );

  useEffect(() => {
    if (!selectedResult) {
      setSelectedLetter(null);
      return;
    }
    setSelectedLetter((current) => {
      if (!current) return selectedResult.letters[0] ?? null;
      return (
        selectedResult.letters.find((letter) => letter.id === current.id) ??
        selectedResult.letters[0] ??
        null
      );
    });
  }, [selectedResult]);

  const start = useCallback(async () => {
    if (running) return;
    if (!parsedAccounts.values.length) {
      setNotice(t("massMail.validation.accounts"));
      return;
    }
    if (parsedProxies.invalid > 0) {
      setNotice(t("massMail.validation.proxies"));
      return;
    }
    if (customServersInvalid) {
      setNotice(t("massMail.validation.customServer"));
      return;
    }

    setNotice(null);
    setResults([]);
    setDomains([]);
    setCounters({ ...EMPTY_COUNTERS, total: parsedAccounts.values.length });
    setSelectedResult(null);
    setSelectedLetter(null);
    setRunning(true);

    try {
      const response = await window.moderator.massMail.start({
        accounts: parsedAccounts.values,
        proxies: parsedProxies.values,
        protocol,
        customServers,
        autoFallback,
        retryAttempts,
        retryDelayMs,
        keywords,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        unreadOnly,
        threads,
        letterLimit,
      });

      if (!response.ok) {
        setNotice(translateReason(response.reason));
        return;
      }

      setCounters(response.counters);
      setDomains(response.domains);
      setResults(sortResults(response.results));
      if (response.stopped) setNotice(t("massMail.reasons.stopped"));
    } catch {
      setNotice(t("massMail.reasons.internal"));
    } finally {
      setRunning(false);
    }
  }, [
    autoFallback,
    customServers,
    customServersInvalid,
    dateFrom,
    dateTo,
    keywords,
    letterLimit,
    parsedAccounts,
    parsedProxies,
    protocol,
    retryAttempts,
    retryDelayMs,
    running,
    t,
    threads,
    translateReason,
    unreadOnly,
  ]);

  const stop = useCallback(async () => {
    try {
      await window.moderator.massMail.stop();
    } catch {
      setNotice(t("massMail.reasons.internal"));
    }
  }, [t]);

  const clear = useCallback(() => {
    if (running) return;
    setResults([]);
    setDomains([]);
    setCounters(EMPTY_COUNTERS);
    setNotice(null);
    setSelectedResult(null);
    setSelectedLetter(null);
  }, [running]);

  const openResult = useCallback((result: MassMailAccountResult) => {
    setSelectedResult(result);
  }, []);

  const closeViewer = useCallback(() => {
    setSelectedResult(null);
    setSelectedLetter(null);
  }, []);

  useEffect(() => {
    if (!selectedResult) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") closeViewer();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closeViewer, selectedResult]);

  return (
    <div className={styles.wrap}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={onBack} aria-label={t("massMail.back")}>
          <ArrowLeft size={18} />
        </button>
        <div className={styles.headerCopy}>
          <h1 className={styles.title}>{t("massMail.title")}</h1>
          <p className={styles.subtitle}>{t("massMail.description")}</p>
        </div>
        <div className={styles.headerActions}>
          {running ? (
            <button type="button" className={styles.stopButton} onClick={() => void stop()}>
              <Square size={16} />
              {t("massMail.stop")}
            </button>
          ) : (
            <button type="button" className={styles.startButton} onClick={() => void start()}>
              <Play size={16} />
              {t("massMail.start")}
            </button>
          )}
          <button type="button" className={styles.clearButton} disabled={running} onClick={clear}>
            <RotateCcw size={16} />
            {t("massMail.clear")}
          </button>
        </div>
      </header>

      <section className={styles.overview}>
        <div className={styles.progressCard}>
          <div
            className={styles.progressRing}
            style={{ "--progress": `${progress * 3.6}deg` } as CSSProperties}
          >
            <strong>{progress}%</strong>
            <span>{t("massMail.checked")}</span>
          </div>
          <div className={styles.progressMeta}>
            <strong>
              {counters.checked} / {counters.total}
            </strong>
            <span>{running ? t("massMail.running") : t("massMail.ready")}</span>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <div className={`${styles.metric} ${styles.metricNeutral}`}>
            <span className={styles.metricLabel}>{t("massMail.metrics.accounts")}</span>
            <strong className={styles.metricValue}>{parsedAccounts.values.length}</strong>
            <small className={styles.metricHint}>
              {parsedAccounts.invalid > 0 ? `+${parsedAccounts.invalid} invalid` : "email:password"}
            </small>
          </div>
          <div className={`${styles.metric} ${styles.metricNeutral}`}>
            <span className={styles.metricLabel}>{t("massMail.metrics.proxies")}</span>
            <strong className={styles.metricValue}>{parsedProxies.values.length}</strong>
            <small className={styles.metricHint}>
              {parsedProxies.invalid > 0 ? `+${parsedProxies.invalid} invalid` : t("massMail.viewer.proxy")}
            </small>
          </div>
          <div className={`${styles.metric} ${styles.metricNeutral}`}>
            <span className={styles.metricLabel}>{t("massMail.metrics.threads")}</span>
            <strong className={styles.metricValue}>{threads}</strong>
            <small className={styles.metricHint}>
              {t("massMail.letterLimit")}: {letterLimit}
            </small>
          </div>
          {METRIC_KEYS.map((key) => (
            <div key={key} className={`${styles.metric} ${styles[key]}`}>
              <span className={styles.metricLabel}>{t(`massMail.metrics.${key}`)}</span>
              <strong className={styles.metricValue}>{counters[key]}</strong>
              <small className={styles.metricHint}>
                {counters.total > 0 ? `${Math.round((counters[key] / counters.total) * 100)}%` : "0%"}
              </small>
            </div>
          ))}
        </div>
      </section>

      {notice ? <div className={styles.notice}>{notice}</div> : null}

      <div className={styles.workspace}>
        <aside className={styles.controls}>
          <section className={styles.controlSection}>
            <div className={styles.sectionHead}>
              <span>{t("massMail.accounts")}</span>
              <small>
                {parsedAccounts.values.length} / {parsedAccounts.invalid}
              </small>
            </div>
            <textarea
              className={styles.textarea}
              value={accountsText}
              disabled={running}
              rows={10}
              placeholder={t("massMail.accountsPlaceholder")}
              onChange={(event) => setAccountsText(event.target.value)}
            />
          </section>

          <section className={styles.controlSection}>
            <div className={styles.sectionHead}>
              <span>{t("massMail.proxies")}</span>
              <small>
                {parsedProxies.values.length} / {parsedProxies.invalid}
              </small>
            </div>
            <textarea
              className={styles.textarea}
              value={proxiesText}
              disabled={running}
              rows={6}
              placeholder={t("massMail.proxiesPlaceholder")}
              onChange={(event) => setProxiesText(event.target.value)}
            />
          </section>

          <section className={styles.controlSection}>
            <span className={styles.sectionTitle}>{t("massMail.settings")}</span>

            <label className={styles.field}>
              <span>{t("massMail.protocol")}</span>
              <select
                className={styles.input}
                value={protocol}
                disabled={running}
                onChange={(event) => setProtocol(event.target.value as MassMailProtocol)}
              >
                {PROTOCOLS.map((value) => (
                  <option key={value} value={value}>
                    {t(`massMail.protocols.${value}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>{t("massMail.keywords")}</span>
              <textarea
                className={styles.input}
                rows={4}
                value={keywordsText}
                disabled={running}
                placeholder={t("massMail.keywordsPlaceholder")}
                onChange={(event) => setKeywordsText(event.target.value)}
              />
            </label>

            <div className={styles.twoColumns}>
              <label className={styles.field}>
                <span>{t("massMail.dateFrom")}</span>
                <input
                  className={styles.input}
                  type="date"
                  value={dateFrom}
                  disabled={running}
                  onChange={(event) => setDateFrom(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>{t("massMail.dateTo")}</span>
                <input
                  className={styles.input}
                  type="date"
                  value={dateTo}
                  disabled={running}
                  onChange={(event) => setDateTo(event.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>{t("massMail.threads")}</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  max={50}
                  value={threads}
                  disabled={running}
                  onChange={(event) => setThreads(Math.max(1, Math.min(50, Number(event.target.value) || 1)))}
                />
              </label>
              <label className={styles.field}>
                <span>{t("massMail.letterLimit")}</span>
                <input
                  className={styles.input}
                  type="number"
                  min={1}
                  max={100}
                  value={letterLimit}
                  disabled={running}
                  onChange={(event) => setLetterLimit(Math.max(1, Math.min(100, Number(event.target.value) || 1)))}
                />
              </label>
            </div>

            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={unreadOnly}
                disabled={running || protocol === "pop3"}
                onChange={(event) => setUnreadOnly(event.target.checked)}
              />
              <span>{t("massMail.unreadOnly")}</span>
            </label>

            <div className={styles.customSettings}>
              <button
                type="button"
                className={styles.customSettingsToggle}
                disabled={running}
                aria-expanded={customSettingsOpen}
                onClick={() => setCustomSettingsOpen((current) => !current)}
              >
                <span>
                  <strong>{t("massMail.custom.title")}</strong>
                  <small>{t("massMail.custom.description")}</small>
                </span>
                <span className={styles.customSettingsState}>
                  {customServers.length > 0 ? customServers.length : "+"}
                </span>
              </button>

              {customSettingsOpen ? (
                <div className={styles.customSettingsBody}>
                  <label className={styles.checkRow}>
                    <input
                      type="checkbox"
                      checked={autoFallback}
                      disabled={running}
                      onChange={(event) => setAutoFallback(event.target.checked)}
                    />
                    <span>{t("massMail.custom.autoFallback")}</span>
                  </label>
                  <small className={styles.customHint}>{t("massMail.custom.autoFallbackHint")}</small>

                  <div className={styles.customServer}>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={customImapEnabled}
                        disabled={running}
                        onChange={(event) => setCustomImapEnabled(event.target.checked)}
                      />
                      <span>{t("massMail.custom.imap")}</span>
                    </label>
                    <div className={styles.serverFields}>
                      <label className={styles.field}>
                        <span>{t("massMail.custom.host")}</span>
                        <input
                          className={styles.input}
                          value={customImapHost}
                          disabled={running || !customImapEnabled}
                          placeholder="imap.example.com"
                          onChange={(event) => setCustomImapHost(event.target.value)}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>{t("massMail.custom.port")}</span>
                        <input
                          className={styles.input}
                          type="number"
                          min={1}
                          max={65535}
                          value={customImapPort}
                          disabled={running || !customImapEnabled}
                          onChange={(event) => setCustomImapPort(Math.max(1, Math.min(65535, Number(event.target.value) || 993)))}
                        />
                      </label>
                    </div>
                  </div>

                  <div className={styles.customServer}>
                    <label className={styles.checkRow}>
                      <input
                        type="checkbox"
                        checked={customPop3Enabled}
                        disabled={running}
                        onChange={(event) => setCustomPop3Enabled(event.target.checked)}
                      />
                      <span>{t("massMail.custom.pop3")}</span>
                    </label>
                    <div className={styles.serverFields}>
                      <label className={styles.field}>
                        <span>{t("massMail.custom.host")}</span>
                        <input
                          className={styles.input}
                          value={customPop3Host}
                          disabled={running || !customPop3Enabled}
                          placeholder="pop.example.com"
                          onChange={(event) => setCustomPop3Host(event.target.value)}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>{t("massMail.custom.port")}</span>
                        <input
                          className={styles.input}
                          type="number"
                          min={1}
                          max={65535}
                          value={customPop3Port}
                          disabled={running || !customPop3Enabled}
                          onChange={(event) => setCustomPop3Port(Math.max(1, Math.min(65535, Number(event.target.value) || 995)))}
                        />
                      </label>
                    </div>
                  </div>

                  <div className={styles.serverFields}>
                    <label className={styles.field}>
                      <span>{t("massMail.custom.attempts")}</span>
                      <input
                        className={styles.input}
                        type="number"
                        min={1}
                        max={5}
                        value={retryAttempts}
                        disabled={running}
                        onChange={(event) => setRetryAttempts(Math.max(1, Math.min(5, Number(event.target.value) || 1)))}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>{t("massMail.custom.delay")}</span>
                      <input
                        className={styles.input}
                        type="number"
                        min={0}
                        max={10}
                        step={0.5}
                        value={retryDelayMs / 1000}
                        disabled={running}
                        onChange={(event) => setRetryDelayMs(Math.max(0, Math.min(10000, (Number(event.target.value) || 0) * 1000)))}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </aside>

        <main className={styles.resultsPanel}>
          <div className={styles.panelHead}>
            <div>
              <strong>{t("massMail.results")}</strong>
              <span>{results.length}</span>
            </div>
            <small>{t("massMail.sortedHint")}</small>
          </div>

          <div className={styles.tableHead}>
            <span>{t("massMail.columns.email")}</span>
            <span>{t("massMail.columns.protocol")}</span>
            <span>{t("massMail.columns.letters")}</span>
            <span>{t("massMail.columns.matches")}</span>
            <span>{t("massMail.columns.status")}</span>
          </div>

          <div className={styles.tableBody}>
            {results.length === 0 ? (
              <div className={styles.empty}>
                <MailSearch size={34} />
                <strong>{t("massMail.emptyTitle")}</strong>
                <span>{t("massMail.emptyText")}</span>
              </div>
            ) : (
              results.map((result) => {
                const active = selectedResult?.id === result.id;
                return (
                  <button
                    type="button"
                    key={result.id}
                    aria-pressed={active}
                    className={`${styles.resultRow} ${styles[result.status]} ${active ? styles.resultRowActive : ""}`}
                    onClick={() => openResult(result)}
                  >
                    <span className={styles.emailCell}>
                      <strong>{result.email}</strong>
                      <small>{result.domain}</small>
                    </span>
                    <span>{result.protocol.toUpperCase()}</span>
                    <span>{result.totalLetters}</span>
                    <span className={styles.matchCount}>{result.matchCount}</span>
                    <span className={styles.statusBadge}>{t(`massMail.status.${result.status}`)}</span>
                  </button>
                );
              })
            )}
          </div>
        </main>

        <aside className={styles.domainsPanel}>
          <div className={styles.panelHead}>
            <div>
              <strong>{t("massMail.domains")}</strong>
              <span>{domains.length}</span>
            </div>
          </div>
          <div className={styles.domainList}>
            {domains.length === 0 ? (
              <span className={styles.domainEmpty}>{t("massMail.domainsEmpty")}</span>
            ) : (
              domains.map((domain) => (
                <div key={domain.domain} className={styles.domainRow}>
                  <div>
                    <strong>{domain.domain}</strong>
                    <span>
                      {domain.checked} / {domain.total}
                    </span>
                  </div>
                  <div className={styles.domainBar}>
                    <span style={{ width: `${domain.total ? (domain.checked / domain.total) * 100 : 0}%` }} />
                  </div>
                  <small>
                    {t("massMail.domainSummary", {
                      found: domain.found,
                      good: domain.good,
                      bad: domain.bad + domain.errors,
                    })}
                  </small>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {selectedResult ? (
        <div
          className={styles.viewerOverlay}
          role="dialog"
          aria-modal="true"
          aria-label={t("massMail.viewer.title")}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer();
          }}
        >
          <div className={styles.viewer}>
            <header className={styles.viewerHeader}>
              <div className={styles.viewerTitle}>
                <span>{t("massMail.viewer.title")}</span>
                <h2>{selectedResult.email}</h2>
                {selectedResult.reason ? (
                  <p className={styles.reasonText}>{translateReason(selectedResult.reason)}</p>
                ) : null}
              </div>
              <button
                type="button"
                className={styles.viewerClose}
                onClick={closeViewer}
                aria-label={t("massMail.viewer.close")}
              >
                <X size={18} />
              </button>
            </header>

            <div className={styles.viewerStats}>
              <div className={styles.viewerStat}>
                <span>{t("massMail.viewer.protocol")}</span>
                <strong>{selectedResult.protocol.toUpperCase()}</strong>
              </div>
              <div className={styles.viewerStat}>
                <span>{t("massMail.viewer.matches")}</span>
                <strong>{selectedResult.matchCount}</strong>
              </div>
              <div className={styles.viewerStat}>
                <span>{t("massMail.viewer.proxy")}</span>
                <strong>{selectedResult.proxy ?? "—"}</strong>
              </div>
              <div className={styles.viewerStat}>
                <span>{t("massMail.viewer.duration")}</span>
                <strong>{selectedResult.durationMs} ms</strong>
              </div>
            </div>

            <div className={styles.attemptLog}>
              <div className={styles.attemptLogHead}>
                <strong>{t("massMail.attempts.title")}</strong>
                <span>{selectedResult.attempts.length}</span>
              </div>
              <div className={styles.attemptList}>
                {selectedResult.attempts.map((attempt, index) => (
                  <div
                    key={`${attempt.protocol}-${attempt.host}-${attempt.port}-${index}`}
                    className={styles.attemptRow}
                  >
                    <strong>{attempt.protocol.toUpperCase()}</strong>
                    <span>{attempt.host}:{attempt.port}</span>
                    <span>{attempt.durationMs} ms</span>
                    <span className={attempt.reason ? styles.attemptFailed : styles.attemptSuccess}>
                      {attempt.reason ? translateReason(attempt.reason) : t("massMail.attempts.success")}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.viewerBody}>
              <aside className={styles.viewerList}>
                <div className={styles.viewerListHead}>
                  <span>{t("massMail.viewer.letters")}</span>
                  <strong>{selectedResult.letters.length}</strong>
                </div>
                {selectedResult.letters.length === 0 ? (
                  <div className={styles.viewerEmpty}>
                    <Inbox size={28} />
                    <span>{t("massMail.viewer.noMatches")}</span>
                  </div>
                ) : (
                  <div className={styles.letterList}>
                    {selectedResult.letters.map((letter) => {
                      const active = selectedLetter?.id === letter.id;
                      return (
                        <button
                          type="button"
                          key={letter.id}
                          className={`${styles.letterButton} ${active ? styles.letterActive : ""}`}
                          onClick={() => setSelectedLetter(letter)}
                        >
                          <strong className={styles.letterSubject}>
                            {letter.subject || t("mail.noSubject")}
                          </strong>
                          <span className={styles.letterMeta}>{letter.from}</span>
                          <span className={styles.letterMeta}>{formatDate(letter.date)}</span>
                          {letter.matchedKeywords.length > 0 ? (
                            <div className={styles.letterKeywords}>
                              {letter.matchedKeywords.map((keyword) => (
                                <span key={`${letter.id}-${keyword}`} className={styles.keyword}>
                                  {keyword}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}
              </aside>

              <section className={styles.viewerContent}>
                {selectedLetter ? (
                  <>
                    <div className={styles.viewerContentHead}>
                      <div>
                        <span>{t("massMail.viewer.subject")}</span>
                        <strong>{selectedLetter.subject || t("mail.noSubject")}</strong>
                      </div>
                      <div>
                        <span>{t("massMail.viewer.from")}</span>
                        <strong>{selectedLetter.from}</strong>
                      </div>
                      <div>
                        <span>{t("massMail.viewer.date")}</span>
                        <strong>{formatDate(selectedLetter.date)}</strong>
                      </div>
                    </div>

                    {selectedLetter.preview ? (
                      <div className={styles.viewerPreview}>
                        <span>{t("massMail.viewer.preview")}</span>
                        <p>{selectedLetter.preview}</p>
                      </div>
                    ) : null}

                    {selectedLetterHtml ? (
                      <>
                        <span className={styles.sectionTitle}>{t("massMail.viewer.htmlLabel")}</span>
                        <iframe
                          className={styles.viewerFrame}
                          sandbox=""
                          srcDoc={selectedLetterHtml}
                          title={selectedLetter.subject || t("mail.noSubject")}
                        />
                      </>
                    ) : (
                      <>
                        <span className={styles.sectionTitle}>{t("massMail.viewer.details")}</span>
                        <pre className={styles.viewerText}>
                          {selectedLetter.body || t("massMail.viewer.emptyBody")}
                        </pre>
                      </>
                    )}
                  </>
                ) : (
                  <div className={styles.viewerEmpty}>
                    <Inbox size={30} />
                    <span>{t("massMail.viewer.empty")}</span>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
