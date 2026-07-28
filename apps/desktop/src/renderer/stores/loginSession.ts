import type { AccountLoginService, LoginStep } from '@lzt/shared'
import { create } from 'zustand'

interface LoginSessionState {
  itemId: number | null
  accountTitle: string
  service: AccountLoginService | null
  step: LoginStep | null
  detail: string | undefined
  error: string | null
  isOpen: boolean
  start: (itemId: number, title: string, service: AccountLoginService | null) => void
  setStep: (step: LoginStep, detail?: string) => void
  fail: (error: string) => void
  close: () => void
}

export const useLoginSession = create<LoginSessionState>((set) => ({
  itemId: null,
  accountTitle: '',
  service: null,
  step: null,
  detail: undefined,
  error: null,
  isOpen: false,
  start: (itemId, title, service) =>
    set({
      itemId,
      accountTitle: title,
      service,
      step: 'fetching-credentials',
      detail: undefined,
      error: null,
      isOpen: true,
    }),
  setStep: (step, detail) => set({ step, detail }),
  fail: (error) => set({ error }),
  close: () =>
    set({
      itemId: null,
      accountTitle: '',
      service: null,
      step: null,
      detail: undefined,
      error: null,
      isOpen: false,
    }),
}))
