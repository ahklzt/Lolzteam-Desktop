import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  Check,
  ChevronDown,
  CloudDownload,
  Loader2,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Wifi,
} from 'lucide-react'
import type { ProxyEntry, ProxyTestResult } from '@lzt/shared'
import { parseProxyLine, proxyKey } from '~/lib/proxy'
import { formatAgo } from '~/lib/time'
import { useSettingsStore } from '~/stores/settings'
import { Modal } from '~/widgets/Modal/Modal'
import { Toggle } from '~/widgets/Toggle/Toggle'
import styles from './ProxyView.module.scss'

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `p_${Date.now()}_${Math.random().toString(36).slice(2)}`

interface ProxyViewProps {
  onBack: () => void
}

export const ProxyView = ({ onBack }: ProxyViewProps) => {
  const { t } = useTranslation()
  const snapshot = useSettingsStore((s) => s.snapshot)
  const patch = useSettingsStore((s) => s.patch)

  const settings = snapshot?.settings
  const locale = settings?.locale ?? 'ru'
  const proxies = useMemo(() => settings?.proxies ?? [], [settings?.proxies])

  const [draft, setDraft] = useState('')
  const [checkOnAdd, setCheckOnAdd] = useState(true)
  const [appMenuOpen, setAppMenuOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set())
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [editing, setEditing] = useState<ProxyEntry | null>(null)
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  if (!settings) return null

  const showFlash = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2500)
  }

  const saveProxies = async (next: ProxyEntry[], extra?: Partial<typeof settings>) => {
    await patch({ proxies: next, ...extra })
  }

  const setAppProxy = async (id: string | null) => {
    setAppMenuOpen(false)
    await patch({ appProxyId: id })
  }

  const appProxy = proxies.find((p) => p.id === settings.appProxyId) ?? null

  const runTest = async (entry: ProxyEntry): Promise<ProxyTestResult> => {
    const result = await window.moderator.proxy.test({
      protocol: entry.protocol,
      host: entry.host,
      port: entry.port,
      ...(entry.username ? { username: entry.username } : {}),
      ...(entry.password ? { password: entry.password } : {}),
    })
    return result
  }

  const markTesting = (id: string, on: boolean) => {
    setTestingIds((prev) => {
      const next = new Set(prev)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const testOne = async (entry: ProxyEntry) => {
    markTesting(entry.id, true)
    try {
      const test = await runTest(entry)
      await saveProxies(
        proxies.map((p) =>
          p.id === entry.id
            ? { ...p, test, ...(test.ok && test.protocol ? { protocol: test.protocol } : {}) }
            : p,
        ),
      )
    } finally {
      markTesting(entry.id, false)
    }
  }

  const addFromDraft = async () => {
    const lines = draft.split('\n').map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return

    const existing = new Set(proxies.map(proxyKey))
    const added: ProxyEntry[] = []
    for (const line of lines) {
      const parsed = parseProxyLine(line)
      if (!parsed) continue
      const key = proxyKey(parsed)
      if (existing.has(key)) continue
      existing.add(key)
      added.push({ id: newId(), ...parsed })
    }
    if (added.length === 0) {
      showFlash(t('settings.proxy.nothingAdded'))
      return
    }

    const next = [...proxies, ...added]
    await saveProxies(next)
    setDraft('')
    showFlash(t('settings.proxy.added', { count: added.length }))

    if (checkOnAdd) await checkMany(added.map((p) => p.id), next)
  }

  const checkMany = async (ids: string[], base: ProxyEntry[]) => {
    if (ids.length === 0) return
    const idSet = new Set(ids)
    setProgress({ done: 0, total: ids.length })
    setTestingIds((prev) => new Set([...prev, ...ids]))

    const results = new Map<string, ProxyTestResult>()
    const queue = base.filter((p) => idSet.has(p.id))
    let cursor = 0
    let done = 0
    const CONCURRENCY = 6

    const worker = async () => {
      while (cursor < queue.length) {
        const entry = queue[cursor++]
        if (!entry) break
        try {
          results.set(entry.id, await runTest(entry))
        } finally {
          done += 1
          setProgress({ done, total: queue.length })
          markTesting(entry.id, false)
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker))

    await saveProxies(
      base.map((p) => {
        const test = results.get(p.id)
        if (!test) return p
        return { ...p, test, ...(test.ok && test.protocol ? { protocol: test.protocol } : {}) }
      }),
    )
    setProgress(null)
  }

  const checkAll = () => void checkMany(proxies.map((p) => p.id), proxies)

  const loadFromForum = async () => {
    setBusy(true)
    try {
      const res = await window.moderator.proxy.fetchMarket()
      if (!res.ok) {
        showFlash(t('settings.proxy.forumFailed'))
        return
      }
      const existing = new Set(proxies.map(proxyKey))
      const added = res.proxies.filter((p) => !existing.has(proxyKey(p)))
      if (added.length === 0) {
        showFlash(t('settings.proxy.nothingAdded'))
        return
      }
      await saveProxies([...proxies, ...added])
      showFlash(t('settings.proxy.forumAdded', { count: added.length }))
    } finally {
      setBusy(false)
    }
  }

  const deleteOne = (id: string) =>
    void saveProxies(
      proxies.filter((p) => p.id !== id),
      id === settings.appProxyId ? { appProxyId: null } : undefined,
    )

  const deleteInvalid = () => {
    const invalidIds = new Set(proxies.filter((p) => p.test && !p.test.ok).map((p) => p.id))
    if (invalidIds.size === 0) return
    const next = proxies.filter((p) => !invalidIds.has(p.id))
    void saveProxies(
      next,
      settings.appProxyId && invalidIds.has(settings.appProxyId) ? { appProxyId: null } : undefined,
    )
  }

  const deleteAll = () => {
    setConfirmDeleteAll(false)
    void saveProxies([], { appProxyId: null })
  }

  const invalidCount = proxies.filter((p) => p.test && !p.test.ok).length

  const statusLabel = (entry: ProxyEntry): string => {
    if (testingIds.has(entry.id)) return t('settings.proxy.testing')
    if (!entry.test) return ''
    return entry.test.ok ? t('settings.proxy.statusValid') : t('settings.proxy.statusInvalid')
  }

  return (
    <div className={styles.wrap}>
      <header className={styles.head}>
        <button type="button" className={styles.back} onClick={onBack}>
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className={styles.title}>{t('settings.proxy.menuLabel')}</h1>
          <p className={styles.subtitle}>{t('settings.proxy.subtitle')}</p>
        </div>
      </header>

      {}
      <section className={styles.card}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>{t('settings.proxy.appLabel')}</span>
          <span className={styles.fieldHint}>{t('settings.proxy.appHint')}</span>
          <div className={styles.dropdown}>
            <button type="button" className={styles.dropdownBtn} onClick={() => setAppMenuOpen((v) => !v)}>
              <span>
                {appProxy
                  ? `${appProxy.host}:${appProxy.port}`
                  : t('settings.proxy.appNone')}
              </span>
              <ChevronDown size={16} />
            </button>
            {appMenuOpen && (
              <div className={styles.menu}>
                <button type="button" className={styles.menuItem} onClick={() => void setAppProxy(null)}>
                  {t('settings.proxy.appNone')}
                  {!settings.appProxyId && <Check size={14} />}
                </button>
                {proxies.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={styles.menuItem}
                    onClick={() => void setAppProxy(p.id)}
                  >
                    {p.host}:{p.port}
                    {settings.appProxyId === p.id && <Check size={14} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.toggleRow}>
          <div>
            <span className={styles.fieldLabel}>{t('settings.proxy.toggleLabel')}</span>
            <span className={styles.fieldHint}>{t('settings.proxy.toggleHint')}</span>
          </div>
          <Toggle
            checked={settings.proxyEnabled}
            onChange={(v) => void patch({ proxyEnabled: v })}
          />
        </div>
      </section>

      {}
      <section className={styles.card}>
        <span className={styles.fieldLabel}>{t('settings.proxy.addTitle')}</span>
        <textarea
          ref={taRef}
          className={styles.textarea}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('settings.proxy.bulkPlaceholder')}
          rows={4}
          spellCheck={false}
        />
        <span className={styles.hint}>{t('settings.proxy.formatsHint')}</span>
        <Toggle
          checked={checkOnAdd}
          onChange={setCheckOnAdd}
          label={t('settings.proxy.checkOnAdd')}
        />
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={() => void addFromDraft()} disabled={busy}>
            <Plus size={16} /> {t('settings.proxy.addBtn')}
          </button>
          <button type="button" className={styles.secondary} onClick={checkAll} disabled={proxies.length === 0}>
            <ShieldCheck size={16} /> {t('settings.proxy.checkAll')}
          </button>
          <button type="button" className={styles.secondary} onClick={() => void loadFromForum()} disabled={busy}>
            {busy ? <Loader2 size={16} className={styles.spin} /> : <CloudDownload size={16} />}{' '}
            {t('settings.proxy.loadFromForum')}
          </button>
        </div>
        {progress && (
          <div className={styles.progress}>
            {t('settings.proxy.checkAllProgress', { done: progress.done, total: progress.total })}
          </div>
        )}
      </section>

      {}
      <section className={styles.card}>
        <div className={styles.listHead}>
          <span className={styles.fieldLabel}>{t('settings.proxy.listCount', { count: proxies.length })}</span>
          <div className={styles.listActions}>
            <button type="button" className={styles.linkBtn} onClick={deleteInvalid} disabled={invalidCount === 0}>
              {t('settings.proxy.deleteInvalid', { count: invalidCount })}
            </button>
            <button
              type="button"
              className={styles.linkDanger}
              onClick={() => setConfirmDeleteAll(true)}
              disabled={proxies.length === 0}
            >
              {t('settings.proxy.deleteAll')}
            </button>
          </div>
        </div>

        {proxies.length === 0 ? (
          <p className={styles.empty}>{t('settings.proxy.listEmpty')}</p>
        ) : (
          <ul className={styles.list}>
            {proxies.map((p) => {
              const testing = testingIds.has(p.id)
              const ok = p.test?.ok === true
              const bad = p.test && !p.test.ok
              return (
                <li key={p.id} className={styles.row}>
                  <span
                    className={`${styles.dot} ${ok ? styles.dotOk : bad ? styles.dotBad : styles.dotIdle}`}
                  />
                  <div className={styles.rowMain}>
                    <span className={styles.rowAddr}>
                      {p.host}:{p.port}
                      {p.username ? <span className={styles.rowAuth}> · {p.username}</span> : null}
                      {p.label ? <span className={styles.rowTag}>{p.label}</span> : null}
                    </span>
                    <span className={styles.rowStatus}>
                      {statusLabel(p)}
                      {p.test?.ok ? (
                        <>
                          {' · '}
                          {t('settings.proxy.ping', { ms: p.test.ms })} · {p.test.ip}
                        </>
                      ) : null}
                      {p.test ? <span className={styles.rowAgo}> · {formatAgo(p.test.checkedAt, locale)}</span> : null}
                      {p.test && !p.test.ok ? <span className={styles.rowErr}> · {p.test.message}</span> : null}
                    </span>
                  </div>
                  <div className={styles.rowBtns}>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('settings.proxy.testLabel')}
                      onClick={() => void testOne(p)}
                      disabled={testing}
                    >
                      {testing ? <Loader2 size={16} className={styles.spin} /> : <Wifi size={16} />}
                    </button>
                    <button
                      type="button"
                      className={styles.iconBtn}
                      title={t('settings.proxy.editLabel')}
                      onClick={() => setEditing(p)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className={`${styles.iconBtn} ${styles.iconDanger}`}
                      title={t('settings.proxy.deleteLabel')}
                      onClick={() => deleteOne(p.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {flash && <div className={styles.flash}>{flash}</div>}

      {editing && (
        <ProxyEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={async (updated) => {
            await saveProxies(proxies.map((p) => (p.id === updated.id ? updated : p)))
            setEditing(null)
          }}
        />
      )}

      <Modal
        title={t('settings.proxy.deleteAllConfirmTitle')}
        open={confirmDeleteAll}
        onClose={() => setConfirmDeleteAll(false)}
      >
        <p className={styles.confirmBody}>{t('settings.proxy.deleteAllConfirmBody')}</p>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.secondary} onClick={() => setConfirmDeleteAll(false)}>
            {t('common.cancel')}
          </button>
          <button type="button" className={styles.danger} onClick={deleteAll}>
            {t('settings.proxy.deleteAll')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

interface ProxyEditModalProps {
  entry: ProxyEntry
  onClose: () => void
  onSave: (entry: ProxyEntry) => void | Promise<void>
}

const ProxyEditModal = ({ entry, onClose, onSave }: ProxyEditModalProps) => {
  const { t } = useTranslation()
  const [host, setHost] = useState(entry.host)
  const [port, setPort] = useState(String(entry.port))
  const [username, setUsername] = useState(entry.username ?? '')
  const [password, setPassword] = useState(entry.password ?? '')

  const save = () => {
    const portNum = Number(port)
    if (!host.trim() || !Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) return
    void onSave({
      ...entry,
      host: host.trim(),
      port: portNum,
      ...(username.trim() ? { username: username.trim() } : { username: undefined }),
      ...(password ? { password } : { password: undefined }),
      test: undefined,
    })
  }

  return (
    <Modal title={t('settings.proxy.editTitle')} open onClose={onClose}>
      <div className={styles.form}>
        <label className={styles.formField}>
          <span>{t('settings.proxy.fieldHost')}</span>
          <input value={host} onChange={(e) => setHost(e.target.value)} />
        </label>
        <label className={styles.formField}>
          <span>{t('settings.proxy.fieldPort')}</span>
          <input value={port} onChange={(e) => setPort(e.target.value)} inputMode="numeric" />
        </label>
        <label className={styles.formField}>
          <span>{t('settings.proxy.fieldUser')}</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className={styles.formField}>
          <span>{t('settings.proxy.fieldPass')}</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </label>
        <div className={styles.confirmActions}>
          <button type="button" className={styles.secondary} onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button type="button" className={styles.primary} onClick={save}>
            {t('settings.proxy.save')}
          </button>
        </div>
      </div>
    </Modal>
  )
}
