import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import {
  MARKET_CURRENCIES,
  getForumWebBase,
  type MarketCurrency,
  type PersonalInfo,
  type PersonalInfoUpdate,
} from "@lzt/shared";
import { currencyFlagUrl, localeFlagUrl } from "~/lib/flags";
import { useSession } from "~/stores/session";
import { useSettingsStore } from "~/stores/settings";
import { Dropdown } from "~/widgets/Dropdown/Dropdown";
import { Toggle } from "~/widgets/Toggle/Toggle";
import { CurrencyModal } from "~/features/profile/CurrencyModal";
import { LanguageModal } from "~/features/profile/LanguageModal";
import { IconInfoCircle } from "../icons";
import styles from "./PersonalInfoPanel.module.scss";
import { pushToast } from "~/stores/toast";

const DOB_MIN_YEAR = 1920;

const buildUpdate = (a: PersonalInfo, b: PersonalInfo): PersonalInfoUpdate => {
  const u: PersonalInfoUpdate = {};
  if (a.username !== b.username) u.username = b.username;
  if (a.userTitle !== b.userTitle) u.userTitle = b.userTitle;
  if (a.shortLink !== b.shortLink) u.shortLink = b.shortLink;
  if (a.displayGroupId !== b.displayGroupId)
    u.displayGroupId = b.displayGroupId;
  if (a.gender !== b.gender) u.gender = b.gender;
  if (a.dobDay !== b.dobDay) u.dobDay = b.dobDay;
  if (a.dobMonth !== b.dobMonth) u.dobMonth = b.dobMonth;
  if (a.dobYear !== b.dobYear) u.dobYear = b.dobYear;
  if (a.showDobDate !== b.showDobDate) u.showDobDate = b.showDobDate;
  if (a.showDobYear !== b.showDobYear) u.showDobYear = b.showDobYear;
  if (a.location !== b.location) u.location = b.location;
  if (a.occupation !== b.occupation) u.occupation = b.occupation;
  if (a.homepage !== b.homepage) u.homepage = b.homepage;
  if (a.interests !== b.interests) u.interests = b.interests;
  return u;
};

export const PersonalInfoPanel = () => {
  const { t } = useTranslation();

  const status = useSession((s) => s.status);
  const locale = useSettingsStore((s) => s.snapshot?.settings.locale ?? "ru");
  const currentCurrency =
    status?.authenticated && !status.offline
      ? (status.profile.currency ?? null)
      : null;
  const curLower = currentCurrency ? currentCurrency.toLowerCase() : null;
  const knownCur =
    curLower && (MARKET_CURRENCIES as readonly string[]).includes(curLower)
      ? (curLower as MarketCurrency)
      : null;
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);

  const [info, setInfo] = useState<PersonalInfo | null>(null);
  const [draft, setDraft] = useState<PersonalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [claimOpen, setClaimOpen] = useState(false);
  const [dobDayRaw, setDobDayRaw] = useState("");
  const [dobYearRaw, setDobYearRaw] = useState("");

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const res = await window.moderator.profile.getPersonal();
    setLoading(false);
    if (res.ok) {
      setInfo(res.info);
      setDraft(res.info);
      setDobDayRaw(res.info.dobDay ? String(res.info.dobDay) : "");
      setDobYearRaw(res.info.dobYear ? String(res.info.dobYear) : "");
    } else {
      setLoadError(
        res.reason === "no_token"
          ? t("settings.personal.form.notAuthed")
          : t("settings.personal.form.loadFailed"),
      );
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patchDraft = (partial: Partial<PersonalInfo>) =>
    setDraft((d) => (d ? { ...d, ...partial } : d));

  const update = info && draft ? buildUpdate(info, draft) : {};
  const dirty = Object.keys(update).length > 0;

  const yearNow = new Date().getFullYear();
  const dayError =
    dobDayRaw.trim() !== "" &&
    (!/^\d{1,2}$/.test(dobDayRaw.trim()) ||
      Number(dobDayRaw) < 1 ||
      Number(dobDayRaw) > 31);
  const yearError =
    dobYearRaw.trim() !== "" &&
    (!/^\d{4}$/.test(dobYearRaw.trim()) ||
      Number(dobYearRaw) < DOB_MIN_YEAR ||
      Number(dobYearRaw) > yearNow);
  const dobError = dayError || yearError;

  const homepageError =
    draft !== null &&
    draft.homepage.trim() !== "" &&
    !/^https?:\/\/.+/i.test(draft.homepage.trim());

  const onDobDayChange = (v: string) => {
    setDobDayRaw(v);
    const trimmed = v.trim();
    const n = Number(trimmed);
    const valid = /^\d{1,2}$/.test(trimmed) && n >= 1 && n <= 31;
    patchDraft({ dobDay: trimmed === "" ? null : valid ? n : null });
  };
  const onDobYearChange = (v: string) => {
    setDobYearRaw(v);
    const trimmed = v.trim();
    const n = Number(trimmed);
    const valid = /^\d{4}$/.test(trimmed) && n >= DOB_MIN_YEAR && n <= yearNow;
    patchDraft({ dobYear: trimmed === "" ? null : valid ? n : null });
  };

  const save = async () => {
    if (!info || !draft || !dirty) return;
    setSaving(true);
    const res = await window.moderator.profile.updatePersonal(update);
    setSaving(false);
    if (res.ok) {
      setInfo(res.info);
      setDraft(res.info);
      setDobDayRaw(res.info.dobDay ? String(res.info.dobDay) : "");
      setDobYearRaw(res.info.dobYear ? String(res.info.dobYear) : "");
      pushToast({
        kind: "success",
        title: t("toast.savedTitle"),
        message: t("toast.personalSaved"),
      });
    } else {
      pushToast({
        kind: "error",
        title: t("toast.errorTitle"),
        message: t("toast.saveError"),
      });
    }
  };

  const monthsRaw = t("settings.personal.form.months", { returnObjects: true });
  const months = Array.isArray(monthsRaw) ? (monthsRaw as string[]) : [];

  return (
    <div className={styles.panel}>
      {}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t("settings.personal.form.appSection")}
        </h3>

        <div className={styles.field}>
          <div className={styles.labelCol}>
            <span className={styles.label}>
              {t("settings.personal.form.currency")}
            </span>
          </div>
          <div className={styles.controlCol}>
            <button
              type="button"
              className={styles.selector}
              onClick={() => setCurrencyOpen(true)}
            >
              {knownCur && (
                <img
                  className={styles.selFlag}
                  src={currencyFlagUrl(knownCur)}
                  alt=""
                />
              )}
              <span className={styles.selText}>
                {knownCur
                  ? t(`settings.currency.names.${knownCur}`)
                  : t("settings.personal.form.currencyNotSet")}
              </span>
              <ChevronDown size={16} className={styles.selChevron} />
            </button>
            <p className={styles.hint}>
              {t("settings.personal.form.currencyHint")}
            </p>
          </div>
        </div>

        <div className={styles.field}>
          <div className={styles.labelCol}>
            <span className={styles.label}>
              {t("settings.personal.form.language")}
            </span>
          </div>
          <div className={styles.controlCol}>
            <button
              type="button"
              className={styles.selector}
              onClick={() => setLanguageOpen(true)}
            >
              <img
                className={styles.selFlag}
                src={localeFlagUrl(locale)}
                alt=""
              />
              <span className={styles.selText}>
                {t(`settings.language.${locale}`)}
              </span>
              <ChevronDown size={16} className={styles.selChevron} />
            </button>
            <p className={styles.hint}>
              {t("settings.personal.form.languageHint")}
            </p>
          </div>
        </div>
      </section>

      {}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>
          {t("settings.personal.form.profileSection")}
        </h3>

        {loading && (
          <p className={styles.loading}>
            {t("settings.personal.form.loading")}
          </p>
        )}
        {!loading && loadError && (
          <div className={styles.errorBox}>
            <span>{loadError}</span>
            <button
              type="button"
              className={styles.retryBtn}
              onClick={() => void load()}
            >
              {t("settings.personal.form.retry")}
            </button>
          </div>
        )}

        {!loading && draft && (
          <>
            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.personal.form.status")}
                </span>
              </div>
              <div className={styles.controlCol}>
                <input
                  className={styles.input}
                  value={draft.userTitle}
                  maxLength={100}
                  placeholder={t("settings.personal.form.statusPlaceholder")}
                  onChange={(e) => patchDraft({ userTitle: e.target.value })}
                />
                <p className={styles.hint}>
                  {t("settings.personal.form.statusHint")}
                </p>
              </div>
            </div>

            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.personal.form.profileAddress")}
                </span>
              </div>
              <div className={styles.controlCol}>
                <div className={styles.prefixInput}>
                  <span className={styles.prefix}>
                    {getForumWebBase().replace(/^https?:\/\//, "")}/
                  </span>
                  <input
                    className={styles.prefixField}
                    value={draft.shortLink}
                    placeholder={draft.username}
                    onChange={(e) => patchDraft({ shortLink: e.target.value })}
                  />
                </div>
                <p className={styles.hint}>
                  {t("settings.personal.form.permanentLink")}{" "}
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() =>
                      void window.moderator.app.openExternal(
                        `${getForumWebBase()}/members/${draft.userId}/`,
                      )
                    }
                  >
                    {`${getForumWebBase()}/members/${draft.userId}/`}
                  </button>
                </p>
                <p className={styles.hint}>
                  {t("settings.personal.form.profileAddressHint")}
                </p>
              </div>
            </div>

            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.personal.form.nick")}
                </span>
              </div>
              <div className={styles.controlCol}>
                <input
                  className={styles.input}
                  value={draft.username}
                  onChange={(e) => patchDraft({ username: e.target.value })}
                />
                <div className={styles.spoiler}>
                  <button
                    type="button"
                    className={styles.spoilerToggle}
                    onClick={() => setClaimOpen((v) => !v)}
                  >
                    <IconInfoCircle size={16} />
                    <span>{t("settings.personal.form.claimNickToggle")}</span>
                    <ChevronDown
                      size={14}
                      className={`${styles.spoilerChevron} ${claimOpen ? styles.open : ""}`}
                    />
                  </button>
                  {claimOpen && (
                    <div className={styles.spoilerBody}>
                      {t("settings.personal.form.claimNickBody")}
                    </div>
                  )}
                </div>
                <p className={styles.hint}>
                  {t("settings.personal.form.nickHint")}
                </p>
              </div>
            </div>

            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.personal.form.displayGroup")}
                </span>
              </div>
              <div className={styles.controlCol}>
                <Dropdown
                  value={draft.displayGroupId ?? 0}
                  placeholder="—"
                  onChange={(v) => patchDraft({ displayGroupId: v })}
                  options={[
                    ...(draft.displayGroupId != null &&
                    !draft.displayGroups.some(
                      (g) => g.id === draft.displayGroupId,
                    )
                      ? [
                          {
                            value: draft.displayGroupId,
                            label: `#${draft.displayGroupId}`,
                          },
                        ]
                      : []),
                    ...draft.displayGroups.map((g) => ({
                      value: g.id,
                      label: g.title,
                    })),
                  ]}
                />
                <p className={styles.hint}>
                  {t("settings.personal.form.displayGroupHint")}
                </p>
              </div>
            </div>

            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.personal.form.gender")}
                </span>
              </div>
              <div className={styles.controlCol}>
                <div className={styles.radioGroup}>
                  {(["male", "female", ""] as const).map((g) => (
                    <label key={g || "none"} className={styles.radio}>
                      <input
                        type="radio"
                        name="gender"
                        checked={draft.gender === g}
                        onChange={() => patchDraft({ gender: g })}
                      />
                      <span>
                        {t(
                          `settings.personal.form.gender${
                            g === "male"
                              ? "Male"
                              : g === "female"
                                ? "Female"
                                : "None"
                          }`,
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {}
            <div className={styles.field}>
              <div className={styles.labelCol}>
                <span className={styles.label}>
                  {t("settings.personal.form.dob")}
                  <span className={styles.infoWrap}>
                    <IconInfoCircle size={16} />
                    <span className={styles.tooltip}>
                      {t("settings.personal.form.dobPrivacyHint")}{" "}
                      {t("settings.privacy.title")}
                    </span>
                  </span>
                </span>
              </div>
              <div className={styles.controlCol}>
                <div className={styles.dobRow}>
                  {}
                  <input
                    className={`${styles.dobDay}${
                      dayError ? " " + styles.inputError : ""
                    }`}
                    value={dobDayRaw}
                    inputMode="numeric"
                    maxLength={2}
                    placeholder={t("settings.personal.form.dobDayPlaceholder")}
                    onChange={(e) => onDobDayChange(e.target.value)}
                  />
                  {}
                  <Dropdown
                    value={draft.dobMonth ?? 0}
                    placeholder={t("settings.personal.form.dobMonthPlaceholder")}
                    onChange={(v) => patchDraft({ dobMonth: v })}
                    options={months.map((m, i) => ({
                      value: i + 1,
                      label: m,
                    }))}
                  />
                  {}
                  <input
                    className={`${styles.dobYear}${
                      yearError ? " " + styles.inputError : ""
                    }`}
                    value={dobYearRaw}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder={t("settings.personal.form.dobYearPlaceholder")}
                    onChange={(e) => onDobYearChange(e.target.value)}
                  />
                </div>
                {dobError && (
                  <p className={styles.dobError}>
                    {t("settings.personal.form.dobError")}
                  </p>
                )}
                <p className={styles.dobLimit}>
                  {t("settings.personal.form.dobYearlyLimit")}
                </p>
                <p className={styles.hint}>
                  {t("settings.personal.form.dobHint")}
                </p>
                <Toggle
                  checked={draft.showDobDate}
                  onChange={(v) => patchDraft({ showDobDate: v })}
                  label={t("settings.personal.form.showDobDate")}
                />
                <Toggle
                  checked={draft.showDobYear}
                  onChange={(v) => patchDraft({ showDobYear: v })}
                  label={t("settings.personal.form.showDobYear")}
                />
                <p className={styles.hint}>
                  {t("settings.personal.form.showDobHint")}
                </p>
              </div>
            </div>

            {}
            {(
              [
                ["location", "address"],
                ["occupation", "occupation"],
                ["homepage", "website"],
                ["interests", "interests"],
              ] as const
            ).map(([field, key]) => (
              <div className={styles.field} key={field}>
                <div className={styles.labelCol}>
                  <span className={styles.label}>
                    {t(`settings.personal.form.${key}`)}
                  </span>
                </div>
                <div className={styles.controlCol}>
                  <input
                    className={`${styles.input}${
                      field === "homepage" && homepageError
                        ? " " + styles.inputError
                        : ""
                    }`}
                    value={draft[field]}
                    placeholder={field === "homepage" ? "https://" : undefined}
                    onChange={(e) => patchDraft({ [field]: e.target.value })}
                  />
                  {field === "homepage" && homepageError && (
                    <p className={styles.dobError}>
                      {t("settings.personal.form.websiteError")}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.saveBtn}
                disabled={!dirty || saving || dobError || homepageError}
                onClick={() => void save()}
              >
                {saving
                  ? t("settings.personal.form.saving")
                  : t("settings.personal.form.save")}
              </button>
            </div>
          </>
        )}
      </section>

      <CurrencyModal
        open={currencyOpen}
        onClose={() => setCurrencyOpen(false)}
        current={currentCurrency}
      />
      <LanguageModal
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        current={locale}
      />
    </div>
  );
};
