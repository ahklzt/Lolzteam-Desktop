import type { TelegramTestResult } from '@lzt/shared'
import log from 'electron-log/main'
import { getSettings } from '../settings/settings-store'
import { appFetch } from './app-fetch'

const API_ORIGIN = 'https' + '://' + 'api.telegram.org'
const REQ_TIMEOUT_MS = 12_000

export type AlertKind = 'notification' | 'message' | 'bump'

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

const strOf = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null)

const callApi = async (
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<{ ok: boolean; status: number; result: unknown; description: string | null }> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQ_TIMEOUT_MS)
  try {
    const res = await appFetch(`${API_ORIGIN}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
      signal: controller.signal,
    })
    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = null
    }
    const rec = asRecord(parsed)
    return {
      ok: res.ok && rec?.ok === true,
      status: res.status,
      result: rec?.result ?? null,
      description: strOf(rec?.description),
    }
  } finally {
    clearTimeout(timer)
  }
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const testTelegram = async (): Promise<TelegramTestResult> => {
  const settings = await getSettings()
  const token = settings.telegramBotToken.trim()
  const chatId = settings.telegramChatId.trim()

  if (!token) {
    return {
      ok: false,
      reason: 'no_token',
      message: 'Укажите токен бота, полученный у @BotFather.',
    }
  }
  if (!chatId) {
    return {
      ok: false,
      reason: 'no_chat',
      message: 'Укажите chat ID. Получить его можно у @userinfobot.',
    }
  }

  try {
    const me = await callApi(token, 'getMe')
    if (!me.ok) {
      const unauthorized = me.status === 401 || me.status === 404
      return {
        ok: false,
        reason: unauthorized ? 'unauthorized' : 'bad_response',
        message: unauthorized
          ? 'Токен отклонён Telegram. Проверьте, что скопирован он целиком.'
          : (me.description ?? 'Telegram вернул неожиданный ответ.'),
      }
    }

    const sent = await callApi(token, 'sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
    text: '<b>Lolzteam Desktop</b>\nПроверка связи прошла успешно.',
    })
    if (!sent.ok) {
      return {
        ok: false,
        reason: 'bad_response',
        message:
          sent.description ??
          'Не удалось отправить сообщение. Проверьте chat ID и напишите боту первым.',
      }
    }

    const botUsername = strOf(asRecord(me.result)?.username)
    const chat = asRecord(asRecord(sent.result)?.chat)
    const chatTitle = strOf(chat?.title) ?? strOf(chat?.username) ?? strOf(chat?.first_name)
    log.info(`[telegram] test ok (bot=${botUsername ?? '-'})`)
    return { ok: true, botUsername, chatTitle }
  } catch (err) {
    log.warn('[telegram] test failed', err)
    return {
      ok: false,
      reason: 'network',
      message: 'Не удалось связаться с Telegram. Проверьте подключение к сети.',
    }
  }
}

export const sendAlert = async (kind: AlertKind, title: string, body?: string): Promise<void> => {
  try {
    const settings = await getSettings()
    if (!settings.telegramAlertsEnabled) return

    const allowed =
      kind === 'notification'
        ? settings.telegramAlertNotifications
        : kind === 'message'
          ? settings.telegramAlertMessages
          : settings.telegramAlertBumps
    if (!allowed) return

    const token = settings.telegramBotToken.trim()
    const chatId = settings.telegramChatId.trim()
    if (!token || !chatId) return

    const text = body
      ? `<b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`
      : `<b>${escapeHtml(title)}</b>`

    const res = await callApi(token, 'sendMessage', {
      chat_id: chatId,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      text,
    })
    if (!res.ok) {
      log.warn(`[telegram] alert (${kind}) not delivered: ${res.description ?? res.status}`)
    }
  } catch (err) {
    log.warn(`[telegram] alert (${kind}) failed`, err)
  }
}
