import {
  IPC,
  type MailFetchResult,
  type MassMailRunInput,
  type MassMailRunResult,
  type MassMailStopResult,
} from "@lzt/shared";
import { ipcMain } from "electron";
import { fetchInbox } from "../services/mail-imap";
import { runMassMail, stopMassMail } from "../services/mail-mass";

export const registerMailIpc = (): void => {
  ipcMain.handle(
    IPC.MAIL_GET_LETTERS,
    async (
      _e,
      payload?: {
        email?: unknown;
        password?: unknown;
        provider?: unknown;
        limit?: unknown;
      },
    ): Promise<MailFetchResult> => {
      const email =
        typeof payload?.email === "string" ? payload.email.trim() : "";
      const password =
        typeof payload?.password === "string" ? payload.password : "";
      const provider =
        typeof payload?.provider === "string" ? payload.provider : undefined;
      const limit =
        typeof payload?.limit === "number" ? payload.limit : undefined;
      return fetchInbox(email, password, provider, limit);
    },
  );
  ipcMain.handle(
    IPC.MASS_MAIL_START,
    async (event, input: MassMailRunInput): Promise<MassMailRunResult> =>
      runMassMail(input, (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC.MASS_MAIL_PROGRESS, progress);
        }
      }),
  );
  ipcMain.handle(
    IPC.MASS_MAIL_STOP,
    (): MassMailStopResult => stopMassMail(),
  );
};
