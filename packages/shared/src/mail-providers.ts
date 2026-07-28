export interface MailProvider {
  key: string;
  label: string;
  imapHost: string;
  imapPort: number;
  domains: string[];
}

export const MAIL_PROVIDERS: MailProvider[] = [
  {
    key: "rambler",
    label: "Rambler",
    imapHost: "imap.rambler.ru",
    imapPort: 993,
    domains: [
      "rambler.ru",
      "lenta.ru",
      "ro.ru",
      "myrambler.ru",
      "autorambler.ru",
    ],
  },
  {
    key: "smakmail",
    label: "SmakMail",
    imapHost: "imap.smakmail.com",
    imapPort: 993,
    domains: [],
  },
  {
    key: "outlook",
    label: "Outlook / Hotmail",
    imapHost: "imap-mail.outlook.com",
    imapPort: 993,
    domains: [
      "outlook.com",
      "hotmail.com",
      "live.com",
      "msn.com",
      "hotmail.co.uk",
      "outlook.de",
    ],
  },
  {
    key: "gmx",
    label: "GMX",
    imapHost: "imap.gmx.com",
    imapPort: 993,
    domains: [
      "gmx.com",
      "gmx.net",
      "gmx.de",
      "gmx.co.uk",
      "gmx.us",
      "gmx.fr",
      "gmx.at",
      "gmx.ch",
    ],
  },
  {
    key: "mailru",
    label: "Mail.ru",
    imapHost: "imap.mail.ru",
    imapPort: 993,
    domains: [
      "mail.ru",
      "bk.ru",
      "inbox.ru",
      "list.ru",
      "internet.ru",
      "mail.ua",
    ],
  },
];

export const mailProviderByKey = (key: string): MailProvider | null =>
  MAIL_PROVIDERS.find((p) => p.key === key) ?? null;

export const detectMailProvider = (email: string): MailProvider | null => {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email
    .slice(at + 1)
    .trim()
    .toLowerCase();
  if (domain === "") return null;
  for (const p of MAIL_PROVIDERS) {
    for (const d of p.domains) {
      if (domain === d || domain.endsWith("." + d)) return p;
    }
  }
  return null;
};

export const mailProviderOptions = (): Array<{ key: string; label: string }> =>
  MAIL_PROVIDERS.map((p) => ({ key: p.key, label: p.label }));