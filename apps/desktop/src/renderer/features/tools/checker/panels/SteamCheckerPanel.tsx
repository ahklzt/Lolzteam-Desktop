import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Boxes,
  Gamepad2,
  Info,
  ListChecks,
  Loader2,
  Paperclip,
  ScanSearch,
  ShieldCheck,
  X,
} from "lucide-react";
import type { CheckerSteamResult, SteamCheckData, SteamGameEntry } from "@lzt/shared";
import { MARKET_ICONS } from "~/features/market/market-icons";
import { useSettingsStore } from "~/stores/settings";
import styles from "../CheckerTool.module.scss";

type ResultTab = "info" | "inventory" | "transactions";

const DASH = "\u2014";

const fmtNum = (n?: number): string =>
  typeof n === "number" ? n.toLocaleString("ru-RU") : DASH;

const CUR_SYMBOL: Record<string, string> = {
  RUB: "\u20bd",
  UAH: "\u20b4",
  KZT: "\u20b8",
  EUR: "\u20ac",
  GBP: "\u00a3",
  USD: "$",
};

const fmtMoney = (n?: number, currency?: string): string => {
  if (typeof n !== "number") return DASH;
  const sym = currency ? (CUR_SYMBOL[currency] ?? currency) : "";
  const num = n.toLocaleString("ru-RU");
  return sym ? `${num} ${sym}` : num;
};

const fmtDate = (ts?: number | null): string => {
  if (!ts) return DASH;
  const d = new Date(ts * 1000);
  return Number.isNaN(d.getTime()) ? DASH : d.toLocaleDateString("ru-RU");
};

const fmtHours = (minutes?: number): string =>
  typeof minutes === "number" ? `${(minutes / 60).toFixed(2)} \u0447` : DASH;

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className={styles.row}>
    <span className={styles.rowLabel}>{label}</span>
    <span className={styles.rowValue}>{value}</span>
  </div>
);

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className={styles.section}>
    <h3 className={styles.sectionTitle}>{title}</h3>
    <div className={styles.rows}>{children}</div>
  </div>
);

const GameGrid = ({ games }: { games: SteamGameEntry[] }) => (
  <div className={styles.gameGrid}>
    {games.map((g) => (
      <div key={`${g.appId}-${g.name}`} className={styles.gameCard}>
        {g.iconUrl ? (
          <img className={styles.gameImg} src={g.iconUrl} alt="" loading="lazy" />
        ) : (
          <span className={styles.gameImg} />
        )}
        <span className={styles.gameName}>{g.name}</span>
        {typeof g.playtimeMinutes === "number" ? (
          <span className={styles.gameTime}>{fmtHours(g.playtimeMinutes)}</span>
        ) : null}
      </div>
    ))}
  </div>
);

export const SteamCheckerPanel = ({ onBack }: { onBack: () => void }) => {
  const { t } = useTranslation();
  const snapshot = useSettingsStore((s) => s.snapshot);
  const proxies = snapshot?.settings.proxies ?? [];
  const proxyCount = proxies.length;
  const steamIcon = MARKET_ICONS.steam;

  const [raw, setRaw] = useState("");
  const [noTwoFactor, setNoTwoFactor] = useState(false);
  const [maFileName, setMaFileName] = useState<string | null>(null);
  const [maFileText, setMaFileText] = useState<string | null>(null);
  const [maFileError, setMaFileError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<CheckerSteamResult | null>(null);
  const [tab, setTab] = useState<ResultTab>("info");
  const [invCat, setInvCat] = useState<string | null>(null);

  const credentials = useMemo(() => {
    const sep = raw.indexOf(":");
    if (sep <= 0) return null;
    return { login: raw.slice(0, sep).trim(), password: raw.slice(sep + 1).trim() };
  }, [raw]);

  const canRun =
    !running &&
    credentials !== null &&
    credentials.login !== "" &&
    credentials.password !== "" &&
    (noTwoFactor || maFileText !== null);

  const pickMaFile = async (): Promise<void> => {
    setMaFileError(null);
    const path = await window.moderator.app.pickFile({
      title: t("checker.steam.maFilePick"),
      extensions: ["maFile", "mafile", "json", "txt"],
    });
    if (!path) return;
    const read = await window.moderator.app.readFile(path);
    if (!read.ok) {
      setMaFileError(read.message);
      return;
    }
    setMaFileText(read.text);
    setMaFileName(read.name);
  };

  const clearMaFile = (): void => {
    setMaFileText(null);
    setMaFileName(null);
    setMaFileError(null);
  };

  const run = async (): Promise<void> => {
    if (!canRun || credentials === null) return;
    setRunning(true);
    setResult(null);
    setTab("info");
    setInvCat(null);
    try {
      const res = await window.moderator.checker.steam({
        raw: raw.trim(),
        kind: "credentials",
        noTwoFactor,
        ...(noTwoFactor ? {} : { maFile: maFileText ?? undefined }),
      });
      setResult(res);
    } catch {
      setResult({ ok: false, reason: "network", message: t("checker.steam.error") });
    } finally {
      setRunning(false);
    }
  };

  const yesNo = (v?: boolean): string =>
    v === undefined ? DASH : v ? t("checker.yes") : t("checker.no");

  const avail = (restricted?: boolean): string =>
    restricted === undefined
      ? DASH
      : restricted
        ? t("checker.steam.unavailable")
        : t("checker.steam.available");

  const renderInfoTab = (data: SteamCheckData): ReactNode => (
    <div className={styles.sections}>
      <Section title={t("checker.steam.sec.profile")}>
        <Row label={t("checker.steam.f.country")} value={data.country ?? DASH} />
        <Row
          label={t("checker.steam.f.registered")}
          value={data.registeredText ?? fmtDate(data.registeredAt)}
        />
        <Row label={t("checker.steam.f.lastLogoff")} value={data.lastOnlineText ?? DASH} />
        <Row label={t("checker.steam.f.level")} value={fmtNum(data.profileLevel)} />
        <Row label={t("checker.steam.f.friends")} value={fmtNum(data.friendsCount)} />
        <Row label={t("checker.steam.f.points")} value={fmtNum(data.points)} />
        <Row label={t("checker.steam.f.gamesCount")} value={fmtNum(data.gamesCount)} />
        <Row label={t("checker.steam.f.playtime2w")} value={fmtHours(data.playtimeTwoWeeksMinutes)} />
      </Section>

      <Section title={t("checker.steam.sec.balance")}>
        <Row
          label={t("checker.steam.f.balance")}
          value={data.balanceText ?? fmtMoney(data.balance, data.currency)}
        />
        <Row label={t("checker.steam.f.balanceHold")} value={fmtMoney(data.balanceOnHold, data.currency)} />
      </Section>

      <Section title={t("checker.steam.sec.limits")}>
        <Row label={t("checker.steam.f.guard")} value={yesNo(data.steamGuardEnabled)} />
        <Row label={t("checker.steam.f.vac")} value={yesNo(data.vacBanned)} />
        <Row label={t("checker.steam.f.limited")} value={yesNo(data.limitedAccount)} />
        <Row label={t("checker.steam.f.market")} value={avail(data.marketRestricted)} />
        <Row label={t("checker.steam.f.trade")} value={avail(data.tradeRestricted)} />
      </Section>

      {data.cs2 ? (
        <Section title="CS2">
          <Row label={t("checker.steam.f.cs2Wins")} value={fmtNum(data.cs2.wins)} />
          <Row label={t("checker.steam.f.cs2Elo")} value={fmtNum(data.cs2.premierElo)} />
          <Row label={t("checker.steam.f.cs2Mm")} value={data.cs2.rankCompetitive ?? DASH} />
          <Row label={t("checker.steam.f.cs2Wingman")} value={data.cs2.rankWingman ?? DASH} />
        </Section>
      ) : null}

      {data.games && data.games.length > 0 ? (
        <div className={styles.gamesBlock}>
          <h3 className={styles.sectionTitle}>{t("checker.steam.sec.games")}</h3>
          <GameGrid games={(data.recentGames ?? data.games).slice(0, 12)} />
        </div>
      ) : null}
    </div>
  );

  const renderInventoryTab = (data: SteamCheckData): ReactNode => {
    const cats = data.inventoryCategories ?? [];
    if (
      cats.length === 0 &&
      data.inventoryItemsTotal === undefined &&
      data.inventoryValueTotal === undefined
    ) {
      return <div className={styles.empty}>{t("checker.steam.emptyInventory")}</div>;
    }
    const unit = t("checker.steam.f.invItems");
    const activeKey = invCat ?? cats[0]?.key ?? null;
    const active = cats.find((c) => c.key === activeKey) ?? null;
    return (
      <div className={styles.sections}>
        <Section title={t("checker.steam.sec.inventory")}>
          {data.inventoryItemsTotal !== undefined ? (
            <Row
              label={t("checker.steam.f.invItemsTotal")}
              value={`${fmtNum(data.inventoryItemsTotal)} ${unit}`}
            />
          ) : null}
          {data.inventoryValueTotal !== undefined ? (
            <Row
              label={t("checker.steam.f.invTotal")}
              value={fmtMoney(data.inventoryValueTotal, data.currency)}
            />
          ) : null}
        </Section>

        {cats.length > 0 ? (
          <div className={styles.invCats}>
            {cats.map((c) => (
              <button
                key={c.key}
                type="button"
                className={c.key === activeKey ? styles.invCatActive : styles.invCat}
                onClick={() => setInvCat(c.key)}
              >
                <span>{c.label}</span>
                <span className={styles.invCatCount}>{`${fmtNum(c.itemCount)} ${unit}`}</span>
              </button>
            ))}
          </div>
        ) : null}

        {active && active.items && active.items.length > 0 ? (
          <div className={styles.invGrid}>
            {active.items.map((it, idx) => (
              <div key={`${active.key}-${idx}-${it.name}`} className={styles.invItem}>
                {it.iconUrl ? (
                  <img className={styles.invItemImg} src={it.iconUrl} alt="" loading="lazy" />
                ) : (
                  <span className={styles.invItemImg} />
                )}
                <span className={styles.invItemName} title={it.name}>
                  {it.name}
                </span>
                {it.amount > 1 ? <span className={styles.invItemAmt}>{`\u00d7${it.amount}`}</span> : null}
              </div>
            ))}
          </div>
        ) : active ? (
          <div className={styles.empty}>{t("checker.steam.emptyInventory")}</div>
        ) : null}
      </div>
    );
  };

  const renderTransactionsTab = (data: SteamCheckData): ReactNode => {
    const txns = data.transactions ?? [];
    const hasAny =
      data.totalSpent !== undefined ||
      data.gamesValue !== undefined ||
      data.inGamePurchases !== undefined ||
      data.transactionsCount !== undefined ||
      data.transactionsSum !== undefined ||
      txns.length > 0;
    if (!hasAny) return <div className={styles.empty}>{t("checker.steam.emptyTransactions")}</div>;
    return (
      <div className={styles.sections}>
        <Section title={t("checker.steam.sec.transactions")}>
          <Row label={t("checker.steam.f.transactions")} value={fmtNum(data.transactionsCount)} />
          <Row
            label={t("checker.steam.f.transactionsSum")}
            value={fmtMoney(data.transactionsSum, data.currency)}
          />
          <Row
            label={t("checker.steam.f.purchasesSum")}
            value={fmtMoney(data.purchasesSum ?? data.totalSpent, data.currency)}
          />
          <Row label={t("checker.steam.f.gamesValue")} value={fmtMoney(data.gamesValue, data.currency)} />
          <Row label={t("checker.steam.f.inGame")} value={fmtMoney(data.inGamePurchases, data.currency)} />
          <Row label={t("checker.steam.f.giftsRefunds")} value={fmtMoney(data.giftsRefunds, data.currency)} />
        </Section>

        {txns.length > 0 ? (
          <div className={styles.gamesBlock}>
            <h3 className={styles.sectionTitle}>{t("checker.steam.sec.purchases")}</h3>
            <div className={styles.txnList}>
              {txns.map((tx, idx) => (
                <div key={`tx-${idx}`} className={styles.txnRow}>
                  <div className={styles.txnMain}>
                    <span className={styles.txnType}>{tx.type ?? DASH}</span>
                    {tx.items ? <span className={styles.txnItems}>{tx.items}</span> : null}
                  </div>
                  <div className={styles.txnMeta}>
                    {tx.date ? <span className={styles.txnDate}>{tx.date}</span> : null}
                    <span className={tx.refunded ? styles.txnRefund : styles.txnTotal}>
                      {fmtMoney(tx.total, tx.currency ?? data.currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  };

  const renderData = (data: SteamCheckData): ReactNode => (
    <div className={styles.results}>
      <div className={styles.headerCard}>
        {data.avatarUrl ? (
          <img className={styles.avatar} src={data.avatarUrl} alt="" />
        ) : (
          <span className={styles.avatar} />
        )}
        <div className={styles.identity}>
          <span className={styles.persona}>{data.personaName ?? data.steamId}</span>
          {credentials ? (
            <span className={styles.cred}>
              {credentials.login}
              <span className={styles.credSep}>:</span>
              {credentials.password}
            </span>
          ) : (
            <span className={styles.steamId}>{data.steamId}</span>
          )}
        </div>
        <div className={styles.chips}>
          {data.country ? <span className={styles.chip}>{data.country}</span> : null}
          {typeof data.profileLevel === "number" ? (
            <span className={styles.chip}>
              {t("checker.steam.level")} {data.profileLevel}
            </span>
          ) : null}
          {data.vacBanned ? <span className={styles.chipDanger}>VAC</span> : null}
          {data.limitedAccount ? (
            <span className={styles.chipWarn}>{t("checker.steam.f.limited")}</span>
          ) : null}
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={tab === "info" ? styles.tabActive : styles.tab}
          onClick={() => setTab("info")}
        >
          <Info size={15} />
          <span>{t("checker.steam.tab.info")}</span>
        </button>
        <button
          type="button"
          className={tab === "inventory" ? styles.tabActive : styles.tab}
          onClick={() => setTab("inventory")}
        >
          <Boxes size={15} />
          <span>{t("checker.steam.tab.inventory")}</span>
        </button>
        <button
          type="button"
          className={tab === "transactions" ? styles.tabActive : styles.tab}
          onClick={() => setTab("transactions")}
        >
          <ListChecks size={15} />
          <span>{t("checker.steam.tab.transactions")}</span>
        </button>
      </div>

      <div className={styles.tabBody}>
        {tab === "info" ? renderInfoTab(data) : null}
        {tab === "inventory" ? renderInventoryTab(data) : null}
        {tab === "transactions" ? renderTransactionsTab(data) : null}
      </div>
    </div>
  );

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeft size={18} />
          <span>{t("checker.back")}</span>
        </button>
        <div className={styles.headTitle}>
          {steamIcon ? <img className={styles.headIcon} src={steamIcon} alt="" /> : null}
          <h1 className={styles.title}>{t("checker.steam.title")}</h1>
        </div>
      </header>
      <p className={styles.lead}>{t("checker.steam.lead")}</p>

      <div className={styles.formCard}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>{t("checker.steam.inputLabel")}</label>
          <textarea
            className={styles.textarea}
            rows={2}
            value={raw}
            placeholder={t("checker.steam.placeholder")}
            onChange={(e) => setRaw(e.target.value)}
          />
        </div>

        <label className={styles.toggleRow}>
          <input
            type="checkbox"
            className={styles.toggleInput}
            checked={noTwoFactor}
            onChange={(e) => setNoTwoFactor(e.target.checked)}
          />
          <span className={styles.toggleTrack}>
            <span className={styles.toggleThumb} />
          </span>
          <span className={styles.toggleLabel}>{t("checker.steam.no2fa")}</span>
        </label>

        {!noTwoFactor ? (
          <div className={styles.field}>
            <label className={styles.fieldLabel}>{t("checker.steam.maFileLabel")}</label>
            {maFileName ? (
              <div className={styles.fileChip}>
                <Paperclip size={15} />
                <span className={styles.fileName}>{maFileName}</span>
                <button type="button" className={styles.fileRemove} onClick={clearMaFile}>
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button type="button" className={styles.fileBtn} onClick={() => void pickMaFile()}>
                <Paperclip size={15} />
                <span>{t("checker.steam.maFilePick")}</span>
              </button>
            )}
            {maFileError ? <span className={styles.hintWarn}>{maFileError}</span> : null}
          </div>
        ) : null}

        <div className={styles.privacy}>
          <ShieldCheck size={16} className={styles.privacyIcon} />
          <div className={styles.privacyText}>
            <span>{t("checker.steam.privacy")}</span>
            <span
              className={proxyCount >= 10 ? styles.proxyOk : styles.proxyWarn}
            >
              {proxyCount === 0
                ? t("checker.steam.proxyNone")
                : t("checker.steam.proxyCount", { count: proxyCount })}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={styles.checkBtn}
          onClick={() => void run()}
          disabled={!canRun}
        >
          {running ? <Loader2 size={16} className={styles.spin} /> : <ScanSearch size={16} />}
          <span>{running ? t("checker.steam.checking") : t("checker.steam.check")}</span>
        </button>
      </div>

      {running ? (
        <div className={styles.loading}>
          <div className={styles.loadingIcon}>
            {steamIcon ? <img src={steamIcon} alt="" /> : <Gamepad2 size={30} />}
            <span className={styles.loadingRing} />
          </div>
          <span className={styles.loadingText}>{t("checker.steam.loadingText")}</span>
        </div>
      ) : null}

      {!running && result && !result.ok ? (
        <div className={styles.noticeErr}>{result.message}</div>
      ) : null}

      {!running && result && result.ok ? (
        <>
          {result.warnings && result.warnings.length > 0 ? (
            <div className={styles.notice}>{result.warnings.join(" \u00b7 ")}</div>
          ) : null}
          {renderData(result.data)}
        </>
      ) : null}
    </div>
  );
};
