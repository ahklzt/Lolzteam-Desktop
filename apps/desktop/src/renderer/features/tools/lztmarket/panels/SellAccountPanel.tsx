import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ExternalLink, Loader2, Upload } from "lucide-react";
import { LZT_CONFIG, MARKET_CURRENCIES } from "@lzt/shared";
import type {
  MarketCurrency,
  MarketProxyEntry,
  MarketSellUploadInput,
  MarketTag,
} from "@lzt/shared";
import { MARKET_ICONS } from "~/features/market/market-icons";
import { useSession } from "~/stores/session";
import {
  SELL_CATEGORIES,
  SELL_ORIGINS,
  STEAM_PLAY_FLAGS,
  type SellCategoryDef,
} from "./sell-forms";
import styles from "./panels.module.scss";

type View = "grid" | "form";

interface SellData {
  login: string;
  password: string;
  loginPassword: string;
  mmr: string;
  tfa: string;
  cookies: string;
  token: string;
  authKey: string;
  dcId: string;
  authKeyDc: string;
  telegramPassword: string;
  tdataPath: string;
}

const EMPTY_DATA: SellData = {
  login: "",
  password: "",
  loginPassword: "",
  mmr: "",
  tfa: "",
  cookies: "",
  token: "",
  authKey: "",
  dcId: "",
  authKeyDc: "",
  telegramPassword: "",
  tdataPath: "",
};

const FALLBACK_CURRENCY: MarketCurrency = MARKET_CURRENCIES[0];

interface Notice {
  kind: "done" | "error" | "info";
  text: string;
}

interface FilePayload {
  name: string;
  content: string;
}

export const SellAccountPanel = () => {
  const { t } = useTranslation();
  const status = useSession((s) => s.status);
  const profile =
    status && status.authenticated && status.offline === false
      ? status.profile
      : null;
  const authenticated = profile !== null;

  const initialCurrency = useMemo<MarketCurrency>(() => {
    const cur = profile?.currency;
    return cur && (MARKET_CURRENCIES as readonly string[]).includes(cur)
      ? (cur as MarketCurrency)
      : FALLBACK_CURRENCY;
  }, [profile]);

  const [view, setView] = useState<View>("grid");
  const [category, setCategory] = useState<SellCategoryDef | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const [title, setTitle] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<MarketCurrency>(initialCurrency);
  const [origin, setOrigin] = useState("");
  const [hasEmail, setHasEmail] = useState(false);
  const [emailData, setEmailData] = useState("");
  const [description, setDescription] = useState("");
  const [information, setInformation] = useState("");
  const [proxyId, setProxyId] = useState("");
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  const [data, setData] = useState<SellData>(EMPTY_DATA);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [mafile, setMafile] = useState<FilePayload | null>(null);
  const [sessionFile, setSessionFile] = useState<FilePayload | null>(null);

  const [proxies, setProxies] = useState<MarketProxyEntry[]>([]);
  const [tags, setTags] = useState<MarketTag[]>([]);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (view !== "form" || !category || !category.implemented) return;
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const [pr, tg] = await Promise.all([
        window.moderator.market.getProxies(),
        window.moderator.market.getTags(),
      ]);
      if (pr.ok) setProxies(pr.proxies);
      if (tg.ok) setTags(tg.tags);
    })();
  }, [view, category]);

  const resetForm = useCallback(() => {
    setStep(1);
    setTitle("");
    setTitleEn("");
    setPrice("");
    setCurrency(initialCurrency);
    setOrigin("");
    setHasEmail(false);
    setEmailData("");
    setDescription("");
    setInformation("");
    setProxyId("");
    setSelectedTags([]);
    setData(EMPTY_DATA);
    setFlags({});
    setMafile(null);
    setSessionFile(null);
    setNotice(null);
  }, [initialCurrency]);

  const openCategory = useCallback(
    (cat: SellCategoryDef) => {
      resetForm();
      setCategory(cat);
      setView("form");
    },
    [resetForm],
  );

  const backToGrid = useCallback(() => {
    setView("grid");
    setCategory(null);
    setNotice(null);
  }, []);

  const openInMarket = useCallback((slug: string) => {
    const url = `${LZT_CONFIG.marketWebUrl}/${slug}/item/add`;
    void window.moderator.app.openExternal(url, { forceExternal: true });
  }, []);

  const setField = useCallback((key: keyof SellData, value: string) => {
    setData((d) => ({ ...d, [key]: value }));
  }, []);

  const pickFile = useCallback(
    async (
      extensions: string[],
      onOk: (payload: FilePayload) => void,
      useBase64: boolean,
    ) => {
      const path = await window.moderator.app.pickFile({ extensions });
      if (!path) return;
      const res = await window.moderator.app.readFile(path);
      if (res.ok) {
        onOk({ name: res.name, content: useBase64 ? res.base64 : res.text });
      } else {
        setNotice({ kind: "error", text: res.message });
      }
    },
    [],
  );

  const pickTdata = useCallback(async () => {
    const path = await window.moderator.app.pickDirectory(
      t("lztmarket.sellAccount.tdata"),
    );
    if (path) setField("tdataPath", path);
  }, [setField, t]);

  const toggleTag = useCallback((tagId: number) => {
    setSelectedTags((cur) =>
      cur.includes(tagId) ? cur.filter((id) => id !== tagId) : [...cur, tagId],
    );
  }, []);

  const buildExtra = useCallback((): Record<
    string,
    string | number | boolean
  > => {
    const extra: Record<string, string | number | boolean> = {};
    const slug = category?.slug;
    if (slug === "steam") {
      if (data.mmr.trim()) extra.mmr = data.mmr.trim();
      for (const flag of STEAM_PLAY_FLAGS) {
        if (flags[flag]) extra[flag] = 1;
      }
    } else if (slug === "telegram") {
      if (data.authKeyDc.trim()) {
        extra.telegram_auth_key_dc = data.authKeyDc.trim();
      } else {
        if (data.authKey.trim()) extra.telegram_auth_key = data.authKey.trim();
        if (data.dcId.trim()) extra.telegram_dc_id = data.dcId.trim();
      }
      if (data.telegramPassword.trim()) {
        extra.telegram_password = data.telegramPassword.trim();
      }
      if (data.tdataPath.trim()) extra.telegram_tdata_path = data.tdataPath.trim();
      if (sessionFile) extra.telegram_session = sessionFile.content;
    } else if (slug === "roblox") {
      if (data.tfa.trim()) extra.tfa = data.tfa.trim();
    } else if (slug === "tiktok") {
      if (data.cookies.trim()) extra.cookies = data.cookies.trim();
    } else if (slug === "instagram") {
      if (data.cookies.trim()) extra.cookies = data.cookies.trim();
      if (data.tfa.trim()) extra.tfa = data.tfa.trim();
    } else if (slug === "discord") {
      if (data.token.trim()) extra.discord_token = data.token.trim();
    } else if (slug === "epicgames") {
      if (data.cookies.trim()) extra.cookies = data.cookies.trim();
    }
    return extra;
  }, [category, data, flags, sessionFile]);

  const goNext = useCallback(() => {
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setNotice({ kind: "error", text: t("lztmarket.sellAccount.reqPrice") });
      return;
    }
    if (!origin) {
      setNotice({ kind: "error", text: t("lztmarket.sellAccount.reqOrigin") });
      return;
    }
    setNotice(null);
    setStep(2);
  }, [price, origin, t]);

  const publish = useCallback(async () => {
    if (!category) return;
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setNotice({ kind: "error", text: t("lztmarket.sellAccount.reqPrice") });
      return;
    }
    setRunning(true);
    setNotice(null);
    try {
      const extra = buildExtra();
      const input: MarketSellUploadInput = {
        categoryId: category.categoryId,
        price: priceNum,
        currency,
        itemOrigin: origin,
      };
      if (title.trim()) input.title = title.trim();
      if (titleEn.trim()) input.titleEn = titleEn.trim();
      if (description.trim()) input.description = description.trim();
      if (information.trim()) input.information = information.trim();
      if (hasEmail) {
        input.hasEmailLoginData = true;
        if (emailData.trim()) input.emailLoginData = emailData.trim();
      }
      const login = data.login.trim();
      const password = data.password.trim();
      const loginPassword = data.loginPassword.trim();
      if (loginPassword) input.loginPassword = loginPassword;
      if (login) input.login = login;
      if (password) input.password = password;
      if (proxyId === "random") {
        input.randomProxy = true;
      } else if (proxyId) {
        const pid = Number(proxyId);
        if (Number.isFinite(pid)) input.proxyId = pid;
      }
      if (Object.keys(extra).length > 0) input.extra = extra;
      if (selectedTags.length > 0) input.tagIds = selectedTags;
      if (mafile) input.mafile = mafile.content;
      const res = await window.moderator.market.sellUpload(input);
      if (res.ok) {
        let text = t("lztmarket.sellAccount.done", { id: res.itemId ?? "?" });
        if (res.warnings && res.warnings.length > 0) {
          text = `${text}. ${t("lztmarket.sellAccount.warnings", {
            list: res.warnings.join(", "),
          })}`;
        }
        setNotice({ kind: "done", text });
      } else {
        setNotice({
          kind: "error",
          text: res.message ?? t("lztmarket.sellAccount.error"),
        });
      }
    } catch {
      setNotice({ kind: "error", text: t("lztmarket.sellAccount.error") });
    } finally {
      setRunning(false);
    }
  }, [
    category,
    price,
    currency,
    origin,
    title,
    titleEn,
    description,
    information,
    hasEmail,
    emailData,
    data,
    proxyId,
    selectedTags,
    mafile,
    buildExtra,
    t,
  ]);

  const renderLoginBlock = () => (
    <>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>
          {t("lztmarket.sellAccount.login")}
        </label>
        <input
          className={styles.num}
          value={data.login}
          onChange={(e) => setField("login", e.target.value)}
        />
      </div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>
          {t("lztmarket.sellAccount.password")}
        </label>
        <input
          className={styles.num}
          value={data.password}
          onChange={(e) => setField("password", e.target.value)}
        />
      </div>
      <div className={styles.sellSep}>{t("lztmarket.sellAccount.or")}</div>
      <div className={styles.field}>
        <label className={styles.fieldLabel}>
          {t("lztmarket.sellAccount.loginPassword")}
        </label>
        <input
          className={styles.num}
          value={data.loginPassword}
          onChange={(e) => setField("loginPassword", e.target.value)}
        />
      </div>
    </>
  );

  const renderData = () => {
    if (!category) return null;
    switch (category.slug) {
      case "steam":
        return (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.mmr")}
              </label>
              <input
                className={styles.num}
                value={data.mmr}
                onChange={(e) => setField("mmr", e.target.value)}
              />
            </div>
            {renderLoginBlock()}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.mafile")}
              </label>
              <div className={styles.sellFileRow}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() =>
                    void pickFile(
                      ["maFile", "mafile", "json", "txt"],
                      setMafile,
                      false,
                    )
                  }
                >
                  <Upload size={13} /> {t("lztmarket.sellAccount.pickFile")}
                </button>
                {mafile ? (
                  <span className={styles.sellFileName}>
                    {t("lztmarket.sellAccount.fileSelected", {
                      name: mafile.name,
                    })}
                  </span>
                ) : null}
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.canPlay")}
              </label>
              <div className={styles.sellFlags}>
                {STEAM_PLAY_FLAGS.map((flag) => (
                  <label key={flag} className={styles.sellFlag}>
                    <input
                      type="checkbox"
                      className={styles.switch}
                      checked={flags[flag] === true}
                      onChange={(e) =>
                        setFlags((f) => ({ ...f, [flag]: e.target.checked }))
                      }
                    />
                    {t(`lztmarket.sellAccount.play.${flag}`)}
                  </label>
                ))}
              </div>
            </div>
          </>
        );
      case "telegram":
        return (
          <>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.authKey")}
              </label>
              <input
                className={styles.num}
                value={data.authKey}
                onChange={(e) => setField("authKey", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.dcId")}
              </label>
              <input
                className={styles.num}
                value={data.dcId}
                onChange={(e) => setField("dcId", e.target.value)}
              />
            </div>
            <div className={styles.sellSep}>{t("lztmarket.sellAccount.or")}</div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.authKeyDc")}
              </label>
              <input
                className={styles.num}
                value={data.authKeyDc}
                onChange={(e) => setField("authKeyDc", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.password")}
              </label>
              <input
                className={styles.num}
                value={data.telegramPassword}
                onChange={(e) => setField("telegramPassword", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.tdata")}
              </label>
              <div className={styles.sellFileRow}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => void pickTdata()}
                >
                  <Upload size={13} /> {t("lztmarket.sellAccount.pickFolder")}
                </button>
                {data.tdataPath ? (
                  <span className={styles.sellFileName}>{data.tdataPath}</span>
                ) : null}
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.session")}
              </label>
              <div className={styles.sellFileRow}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() =>
                    void pickFile(["session"], setSessionFile, true)
                  }
                >
                  <Upload size={13} /> {t("lztmarket.sellAccount.pickFile")}
                </button>
                {sessionFile ? (
                  <span className={styles.sellFileName}>
                    {t("lztmarket.sellAccount.fileSelected", {
                      name: sessionFile.name,
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          </>
        );
      case "roblox":
        return (
          <>
            {renderLoginBlock()}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.tfa")}
              </label>
              <input
                className={styles.num}
                value={data.tfa}
                onChange={(e) => setField("tfa", e.target.value)}
              />
            </div>
          </>
        );
      case "tiktok":
        return (
          <>
            {renderLoginBlock()}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.cookies")}
              </label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={data.cookies}
                onChange={(e) => setField("cookies", e.target.value)}
              />
            </div>
          </>
        );
      case "instagram":
        return (
          <>
            {renderLoginBlock()}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.cookies")}
              </label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={data.cookies}
                onChange={(e) => setField("cookies", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.tfa")}
              </label>
              <input
                className={styles.num}
                value={data.tfa}
                onChange={(e) => setField("tfa", e.target.value)}
              />
            </div>
          </>
        );
      case "discord":
        return (
          <>
            {renderLoginBlock()}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.token")}
              </label>
              <input
                className={styles.num}
                value={data.token}
                onChange={(e) => setField("token", e.target.value)}
              />
            </div>
          </>
        );      case "epicgames":
        return (
          <>
            {renderLoginBlock()}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                {t("lztmarket.sellAccount.cookies")}
              </label>
              <textarea
                className={styles.textarea}
                rows={4}
                value={data.cookies}
                onChange={(e) => setField("cookies", e.target.value)}
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  if (view === "grid") {
    return (
      <div className={styles.sell}>
        <div className={styles.sellGrid}>
          {SELL_CATEGORIES.map((cat) => {
            const icon = cat.icon ?? MARKET_ICONS[cat.slug];
            const name = cat.labelKey ? t(cat.labelKey) : cat.label;
            return (
              <button
                key={cat.slug}
                type="button"
                className={styles.sellCard}
                onClick={() => openCategory(cat)}
              >
                {icon ? (
                  <img className={styles.sellIcon} src={icon} alt="" />
                ) : (
                  <span className={styles.sellIcon} />
                )}
                <span className={styles.sellName}>{name}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (!category) return null;
  const catName = category.labelKey ? t(category.labelKey) : category.label;
  const catIcon = category.icon ?? MARKET_ICONS[category.slug];

  return (
    <div className={styles.sellWizard}>
      <div className={styles.sellTopbar}>
        <button
          type="button"
          className={styles.sellBackBtn}
          onClick={backToGrid}
        >
          <ArrowLeft size={14} /> {t("lztmarket.sellAccount.back")}
        </button>
      </div>
      <div className={styles.sellHead}>
        {catIcon ? (
          <img className={styles.sellHeadIcon} src={catIcon} alt="" />
        ) : null}
        <span className={styles.sellHeadName}>{catName}</span>
      </div>

      {!category.implemented ? (
        <div className={styles.sellNotImpl}>
          <p>
            {t("lztmarket.sellAccount.notImplemented", { name: catName })}
          </p>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => openInMarket(category.slug)}
          >
            <ExternalLink size={14} /> {t("lztmarket.sellAccount.openMarket")}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.sellSteps}>
            <span
              className={`${styles.sellStep} ${step === 1 ? styles.sellStepActive : ""}`}
            >
              <span
                className={`${styles.sellStepNum} ${step === 1 ? styles.sellStepNumActive : ""}`}
              >
                1
              </span>
              {t("lztmarket.sellAccount.step1")}
            </span>
            <span
              className={`${styles.sellStep} ${step === 2 ? styles.sellStepActive : ""}`}
            >
              <span
                className={`${styles.sellStepNum} ${step === 2 ? styles.sellStepNumActive : ""}`}
              >
                2
              </span>
              {t("lztmarket.sellAccount.step2")}
            </span>
          </div>

          {step === 1 ? (
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.titleRu")}
                </label>
                <input
                  className={styles.num}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.titleEn")}
                </label>
                <input
                  className={styles.num}
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.price")}
                </label>
                <input
                  className={styles.num}
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.currency")}
                </label>
                <select
                  className={styles.select}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as MarketCurrency)}
                >
                  {MARKET_CURRENCIES.map((cur) => (
                    <option key={cur} value={cur}>
                      {cur.toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.origin")}
                </label>
                <select
                  className={styles.select}
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                >
                  <option value="">
                    {t("lztmarket.sellAccount.originPlaceholder")}
                  </option>
                  {SELL_ORIGINS.map((o) => (
                    <option key={o} value={o}>
                      {t(`lztmarket.sellAccount.origins.${o}`)}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.emailAccess")}
                </label>
                <label className={styles.switchRow}>
                  <input
                    type="checkbox"
                    className={styles.switch}
                    checked={hasEmail}
                    onChange={(e) => setHasEmail(e.target.checked)}
                  />
                  <span>{t("lztmarket.sellAccount.emailYes")}</span>
                </label>
              </div>
              {hasEmail ? (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>
                    {t("lztmarket.sellAccount.emailData")}
                  </label>
                  <input
                    className={styles.num}
                    value={emailData}
                    placeholder="email:password"
                    onChange={(e) => setEmailData(e.target.value)}
                  />
                </div>
              ) : null}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.description")}
                </label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.information")}
                </label>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={information}
                  onChange={(e) => setInformation(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.proxy")}
                </label>
                <select
                  className={styles.select}
                  value={proxyId}
                  onChange={(e) => setProxyId(e.target.value)}
                >
                  <option value="">
                    {t("lztmarket.sellAccount.proxyNone")}
                  </option>
                  <option value="random">
                    {t("lztmarket.sellAccount.proxyRandom")}
                  </option>
                  {proxies.map((p) => (
                    <option key={p.proxyId} value={String(p.proxyId)}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  {t("lztmarket.sellAccount.tags")}
                </label>
                {tags.length === 0 ? (
                  <span className={styles.muted}>
                    {t("lztmarket.sellAccount.tagsEmpty")}
                  </span>
                ) : (
                  <div className={styles.sellTagList}>
                    {tags.map((tag) => (
                      <button
                        key={tag.tag_id}
                        type="button"
                        className={`${styles.sellTag} ${selectedTags.includes(tag.tag_id) ? styles.sellTagOn : ""}`}
                        onClick={() => toggleTag(tag.tag_id)}
                      >
                        {tag.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.applyBar}>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  onClick={goNext}
                >
                  {t("lztmarket.sellAccount.next")}
                </button>
                {notice ? (
                  <span
                    className={
                      notice.kind === "error" ? styles.error : styles.muted
                    }
                  >
                    {notice.text}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <div className={styles.formGrid}>
              {renderData()}
              <div className={styles.applyBar}>
                <button
                  type="button"
                  className={styles.btn}
                  onClick={() => {
                    setStep(1);
                    setNotice(null);
                  }}
                >
                  {t("lztmarket.sellAccount.back")}
                </button>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  disabled={running || !authenticated}
                  onClick={() => void publish()}
                >
                  {running ? (
                    <Loader2 className={styles.spin} size={14} />
                  ) : null}
                  {running
                    ? t("lztmarket.sellAccount.publishing")
                    : t("lztmarket.sellAccount.publish")}
                </button>
                {!authenticated ? (
                  <span className={styles.error}>
                    {t("lztmarket.sellAccount.needAuth")}
                  </span>
                ) : null}
                {notice ? (
                  <span
                    className={
                      notice.kind === "error" ? styles.error : styles.muted
                    }
                  >
                    {notice.text}
                  </span>
                ) : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
