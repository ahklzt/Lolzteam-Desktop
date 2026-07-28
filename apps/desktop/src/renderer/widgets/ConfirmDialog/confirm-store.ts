import { create } from "zustand";

type AskOpts = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  resolve: ((v: boolean) => void) | null;
  ask: (opts: AskOpts) => Promise<boolean>;
  close: (result: boolean) => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  title: "Подтверждение",
  message: "",
  confirmText: "Подтвердить",
  cancelText: "Отказаться",
  resolve: null,
  ask: (opts) =>
    new Promise<boolean>((resolve) => {
      const prev = get().resolve;
      if (prev) prev(false);
      set({
        open: true,
        title: opts.title ?? "Подтверждение",
        message: opts.message,
        confirmText: opts.confirmText ?? "Подтвердить",
        cancelText: opts.cancelText ?? "Отказаться",
        resolve,
      });
    }),
  close: (result) => {
    const { resolve } = get();
    if (resolve) resolve(result);
    set({ open: false, resolve: null });
  },
}));

export const askConfirm = (opts: AskOpts) =>
  useConfirmStore.getState().ask(opts);
