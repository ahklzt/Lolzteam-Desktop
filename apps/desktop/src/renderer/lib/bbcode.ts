
import { getEmojiByCode } from "../data/emoji";

export interface BbcodeOptions {
  lang?: string;
  visitorName?: string;
}

const escapeHtml = (raw: string): string =>
  raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const safeUrl = (url: string): string => {
  const u = url.trim();
  if (/^(https?:\/\/|mailto:)/i.test(u)) return u;
  if (/^www\./i.test(u)) return "https://" + u;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) return "mailto:" + u;
  return "#";
};

const currencySymbol = (code: string): string => {
  const c = code.trim().toUpperCase();
  const map: Record<string, string> = {
    USD: "$",
    EUR: "\u20AC",
    RUB: "\u20BD",
    UAH: "\u20B4",
    GBP: "\u00A3",
  };
  return map[c] ?? c;
};

interface MediaService {
  label: string;
  color: string;
  badge: string;
  url: (id: string) => string;
  frame?: (id: string) => string;
}

const MEDIA_SERVICES: Record<string, MediaService> = {
  youtube: { label: "YouTube", color: "#ff0000", badge: "YT", url: (id) => `https://youtu.be/${id}`, frame: (id) => `https://www.youtube-nocookie.com/embed/${id}` },
  vimeo: { label: "Vimeo", color: "#19b7ea", badge: "V", url: (id) => `https://vimeo.com/${id}`, frame: (id) => `https://player.vimeo.com/video/${id}` },
  coub: { label: "Coub", color: "#00c4b3", badge: "C", url: (id) => `https://coub.com/view/${id}`, frame: (id) => `https://coub.com/embed/${id}?autostart=false` },
  streamable: { label: "Streamable", color: "#0f90fa", badge: "S", url: (id) => `https://streamable.com/${id}`, frame: (id) => `https://streamable.com/e/${id}` },
  soundcloud: { label: "SoundCloud", color: "#ff5500", badge: "SC", url: (id) => `https://soundcloud.com/${id}` },
  imgur: { label: "Imgur", color: "#1bb76e", badge: "IM", url: (id) => `https://imgur.com/${id}` },
  telegram: { label: "Telegram", color: "#29a9eb", badge: "TG", url: (id) => `https://t.me/${id}` },
  twitter: { label: "X (Twitter)", color: "#1d9bf0", badge: "X", url: (id) => `https://twitter.com/i/status/${id}` },
  tiktok: { label: "TikTok", color: "#fe2c55", badge: "TT", url: (id) => `https://www.tiktok.com/t/${id}` },
  vk: { label: "VK", color: "#0077ff", badge: "VK", url: (id) => `https://vk.com/video${id}` },
  instagram: { label: "Instagram", color: "#e4405f", badge: "IG", url: (id) => `https://instagram.com/p/${id}` },
};

const encPath = (s: string): string => encodeURIComponent(s.trim());

const buildPlayer = (svc: MediaService, id: string): string =>
  '<span class="bb-embed bb-embed--player">' +
  '<iframe class="bb-embed-frame" src="' + svc.frame!(encPath(id)) + '" ' +
  'title="' + escapeHtml(svc.label) + '" loading="lazy" allowfullscreen ' +
  'referrerpolicy="no-referrer" ' +
  'allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"></iframe>' +
  '</span>';

const buildMediaCard = (svc: MediaService, id: string, href?: string): string =>
  '<a class="bb-embed bb-embed--card" style="--svc:' + svc.color + '" ' +
  'href="' + safeUrl(href ?? svc.url(id)) + '" target="_blank" rel="noreferrer noopener">' +
  '<span class="bb-embed-badge">' + escapeHtml(svc.badge) + '</span>' +
  '<span class="bb-embed-meta">' +
  '<span class="bb-embed-title">' + escapeHtml(svc.label) + '</span>' +
  '<span class="bb-embed-sub">' + escapeHtml(id) + '</span>' +
  '</span><span class="bb-embed-open">\u2197</span></a>';

const buildMedia = (site: string, rawId: string): string => {
  const id = String(rawId).trim();
  const svc = MEDIA_SERVICES[site.trim().toLowerCase()];
  if (!svc) {
    return '<a class="bb-embed bb-embed--card" style="--svc:#3ba55d" href="#">' +
      '<span class="bb-embed-badge">\u25B6</span><span class="bb-embed-meta">' +
      '<span class="bb-embed-title">' + escapeHtml(site) + '</span>' +
      '<span class="bb-embed-sub">' + escapeHtml(id) + '</span></span></a>';
  }
  return svc.frame ? buildPlayer(svc, id) : buildMediaCard(svc, id);
};

const detectMedia = (
  url: string,
): { svc: MediaService; id: string; href: string } | null => {
  const u = url.trim();
  let m: RegExpMatchArray | null;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i)))
    return { svc: MEDIA_SERVICES.youtube, id: m[1], href: u };
  if ((m = u.match(/vimeo\.com\/(\d+)/i)))
    return { svc: MEDIA_SERVICES.vimeo, id: m[1], href: u };
  if ((m = u.match(/coub\.com\/view\/(\w+)/i)))
    return { svc: MEDIA_SERVICES.coub, id: m[1], href: u };
  if ((m = u.match(/streamable\.com\/(\w+)/i)))
    return { svc: MEDIA_SERVICES.streamable, id: m[1], href: u };
  if ((m = u.match(/imgur\.com\/(?:a\/|gallery\/)?(\w+)/i)))
    return { svc: MEDIA_SERVICES.imgur, id: m[1], href: u };
  if ((m = u.match(/t\.me\/([\w+/]+)/i)))
    return { svc: MEDIA_SERVICES.telegram, id: m[1], href: u };
  return null;
};

const mediaFromUrl = (media: {
  svc: MediaService;
  id: string;
  href: string;
}): string =>
  media.svc.frame
    ? buildPlayer(media.svc, media.id)
    : buildMediaCard(media.svc, media.id, media.href);

const SIMPLE_TAGS: Array<{ bb: string; open: string; close: string }> = [
  { bb: "b", open: "<strong>", close: "</strong>" },
  { bb: "i", open: "<em>", close: "</em>" },
  { bb: "u", open: "<u>", close: "</u>" },
  { bb: "s", open: "<s>", close: "</s>" },
  { bb: "sub", open: "<sub>", close: "</sub>" },
  { bb: "sup", open: "<sup>", close: "</sup>" },
  { bb: "left", open: '<div style="text-align:left">', close: "</div>" },
  { bb: "center", open: '<div style="text-align:center">', close: "</div>" },
  { bb: "right", open: '<div style="text-align:right">', close: "</div>" },
];

const HIDE_TAGS: Array<{ bb: string; hasOpt: boolean; label: (o: string) => string }> = [
  { bb: "club", hasOpt: true, label: () => "\u0422\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f \u043a\u043e\u043c\u0430\u043d\u0434\u044b \u0444\u043e\u0440\u0443\u043c\u0430" },
  { bb: "days", hasOpt: true, label: (o) => "\u0421\u043a\u0440\u044b\u0442\u043e \u0434\u043e " + o + " \u0434\u043d. \u0441 \u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u0438" },
  { bb: "likes", hasOpt: true, label: (o) => "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u0441\u0438\u043c\u043f\u0430\u0442\u0438\u0439: " + o },
  { bb: "likes2", hasOpt: true, label: (o) => "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044f \u043b\u0430\u0439\u043a\u043e\u0432: " + o },
  { bb: "userids", hasOpt: true, label: (o) => "\u0422\u043e\u043b\u044c\u043a\u043e \u0434\u043b\u044f ID: " + o },
  { bb: "exceptids", hasOpt: true, label: (o) => "\u0421\u043a\u0440\u044b\u0442\u043e \u043e\u0442 ID: " + o },
];

interface Placeholder {
  token: string;
  html: string;
}

const extractRaw = (input: string, placeholders: Placeholder[]): string => {
  let text = input;
  const push = (html: string): string => {
    const token = "\u0000PH" + placeholders.length + "\u0000";
    placeholders.push({ token, html });
    return token;
  };

  text = text.replace(/\[plain\]([\s\S]*?)\[\/plain\]/gi, (_m, inner) =>
    push(escapeHtml(String(inner))),
  );

  text = text.replace(
    /\[srci(?:="?([\w+#.-]+)"?)?\]([\s\S]*?)\[\/srci\]/gi,
    (_m, lang, inner) => {
      const label = lang ? String(lang).toLowerCase() : "";
      const attr = label ? ' data-lang="' + escapeHtml(label) + '"' : "";
      return push(
        '<code class="bb-inline-code"' + attr + ">" + escapeHtml(String(inner)) + "</code>",
      );
    },
  );

  text = text.replace(
    /\[src(?:="?([\w+#.-]+)"?)?\]([\s\S]*?)\[\/src\]/gi,
    (_m, lang, inner) => {
      const label = lang ? String(lang).toUpperCase() : "CODE";
      const code = escapeHtml(String(inner).replace(/^\n+|\n+$/g, ""));
      return push(
        '<pre class="bb-code" data-lang="' + label + '"><code>' + code + "</code></pre>",
      );
    },
  );

  text = text.replace(
    /\[(code|php|html)\]([\s\S]*?)\[\/\1\]/gi,
    (_m, lang, inner) => {
      const label = String(lang).toUpperCase();
      const code = escapeHtml(String(inner).replace(/^\n+|\n+$/g, ""));
      return push(
        '<pre class="bb-code" data-lang="' + label + '"><code>' + code + "</code></pre>",
      );
    },
  );

  return text;
};

export const bbcodeToHtml = (
  source: string | null | undefined,
  opts: BbcodeOptions = {},
): string => {
  if (!source) return "";

  const placeholders: Placeholder[] = [];
  let text = extractRaw(source, placeholders);

  text = escapeHtml(text);

  text = text.replace(/:([\wа-яё+-]+):/gi, (match, code: string) => {
    const emoji = getEmojiByCode(code);
    if (!emoji) return match;
    return (
      '<img class="bb-smilie" src="' + emoji.url + '" alt="' + match +
      '" title="' + escapeHtml(emoji.title) + '" loading="lazy" />'
    );
  });

  for (const { bb, open, close } of SIMPLE_TAGS) {
    const re = new RegExp("\\[" + bb + "\\]([\\s\\S]*?)\\[\\/" + bb + "\\]", "gi");
    text = text.replace(re, (_m, inner) => open + inner + close);
  }

  text = text.replace(
    /\[color=([#\w(),.\s%]+)\]([\s\S]*?)\[\/color\]/gi,
    (_m, color, inner) => {
      const c = String(color).trim();
      const ok = /^(#[0-9a-f]{3,8}|[a-z]+|rgba?\([\d\s,.%]+\))$/i.test(c);
      return ok ? '<span style="color:' + c + '">' + inner + "</span>" : inner;
    },
  );

  text = text.replace(
    /\[size=(\d{1,3})\]([\s\S]*?)\[\/size\]/gi,
    (_m, size, inner) => {
      const n = Number(size);
      const px = n <= 7 ? 10 + n * 3 : Math.min(n, 48);
      return '<span style="font-size:' + px + 'px">' + inner + "</span>";
    },
  );

  text = text.replace(
    /\[font=([\w\s,'-]+)\]([\s\S]*?)\[\/font\]/gi,
    (_m, font, inner) =>
      '<span style="font-family:' + String(font).replace(/"/g, "") + '">' + inner + "</span>",
  );

  text = text.replace(
    /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
    (_m, url, inner) =>
      '<a href="' + safeUrl(String(url)) + '" target="_blank" rel="noreferrer noopener">' + inner + "</a>",
  );
  text = text.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, (_m, url) => {
    const u = String(url).trim();
    const media = detectMedia(u);
    if (media) return mediaFromUrl(media);
    return '<a href="' + safeUrl(u) + '" target="_blank" rel="noreferrer noopener">' + u + "</a>";
  });

  text = text.replace(
    /\[email=([^\]]+)\]([\s\S]*?)\[\/email\]/gi,
    (_m, mail, inner) => '<a href="mailto:' + String(mail).trim() + '">' + inner + "</a>",
  );
  text = text.replace(/\[email\]([\s\S]*?)\[\/email\]/gi, (_m, mail) => {
    const e = String(mail).trim();
    return '<a href="mailto:' + e + '">' + e + "</a>";
  });

  text = text.replace(/\[user=(\d+)\]([\s\S]*?)\[\/user\]/gi, (_m, id, inner) => {
    const href = "https://lolz.team/members/" + String(id).trim() + "/";
    return '<a class="bb-user" href="' + href + '" target="_blank" rel="noreferrer noopener">@' + inner + "</a>";
  });

  text = text.replace(
    /\[img\]([\s\S]*?)\[\/img\]/gi,
    (_m, url) => '<img class="bb-img" src="' + safeUrl(String(url).trim()) + '" alt="" loading="lazy" />',
  );

  text = text.replace(
    /\[list(=1)?\]([\s\S]*?)\[\/list\]/gi,
    (_m, ordered, inner) => {
      const tag = ordered ? "ol" : "ul";
      const items = String(inner)
        .split(/\[\*\]/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => "<li>" + s + "</li>")
        .join("");
      return '<' + tag + ' class="bb-list">' + items + "</" + tag + ">";
    },
  );

  text = text.replace(
    /\[media=(\w+)\]([\s\S]*?)\[\/media\]/gi,
    (_m, site, id) => buildMedia(String(site), String(id)),
  );

  text = text.replace(
    /\[quote=([^\]]+)\]([\s\S]*?)\[\/quote\]/gi,
    (_m, author, inner) =>
      '<blockquote class="bb-quote"><span class="bb-quote-author">' +
      escapeHtml(String(author).replace(/,.*$/, "").trim()) +
      "</span>" + inner + "</blockquote>",
  );
  text = text.replace(
    /\[quote\]([\s\S]*?)\[\/quote\]/gi,
    (_m, inner) => '<blockquote class="bb-quote">' + inner + "</blockquote>",
  );

  text = text.replace(
    /\[spoiler=([^\]]+)\]([\s\S]*?)\[\/spoiler\]/gi,
    (_m, title, inner) =>
      '<details class="bb-spoiler"><summary>' + escapeHtml(String(title).trim()) + "</summary>" + inner + "</details>",
  );
  text = text.replace(
    /\[spoiler\]([\s\S]*?)\[\/spoiler\]/gi,
    (_m, inner) => '<details class="bb-spoiler"><summary>\u0421\u043f\u043e\u0439\u043b\u0435\u0440</summary>' + inner + "</details>",
  );

  text = text.replace(
    /\[censor\]([\s\S]*?)\[\/censor\]/gi,
    (_m, inner) => '<span class="bb-censor">' + inner + "</span>",
  );

  text = text.replace(
    /\[button=([^\]]+)\]([\s\S]*?)\[\/button\]/gi,
    (_m, url, inner) =>
      '<a class="bb-button" href="' + safeUrl(String(url)) + '" target="_blank" rel="noreferrer noopener">' + inner + "</a>",
  );

  text = text.replace(
    /\[tooltip=([^\]]+)\]([\s\S]*?)\[\/tooltip\]/gi,
    (_m, tip, inner) =>
      '<span class="bb-tooltip" title="' + escapeHtml(String(tip).trim()) + '">' + inner + "</span>",
  );

  text = text.replace(
    /\[price(?:=([\w]+))?\]([\s\S]*?)\[\/price\]/gi,
    (_m, cur, amount) => {
      const sym = cur ? currencySymbol(String(cur)) : "\u20BD";
      return '<span class="bb-price">' + escapeHtml(String(amount).trim()) + " " + sym + "</span>";
    },
  );

  text = text.replace(
    /\[lang=([\w-]+)\]([\s\S]*?)\[\/lang\]/gi,
    (_m, code, inner) => {
      const viewer = (opts.lang ?? "").toLowerCase().split("-")[0];
      const tag = String(code).toLowerCase().split("-")[0];
      if (!viewer) return inner;
      return viewer === tag ? inner : "";
    },
  );

  text = text.replace(
    /\[visitor\](?:\[\/visitor\])?/gi,
    () => escapeHtml(opts.visitorName ?? "\u0413\u043e\u0441\u0442\u044c"),
  );

  for (const { bb, hasOpt, label } of HIDE_TAGS) {
    const re = hasOpt
      ? new RegExp("\\[" + bb + "(?:=([^\\]]+))?\\]([\\s\\S]*?)\\[\\/" + bb + "\\]", "gi")
      : new RegExp("\\[" + bb + "\\]([\\s\\S]*?)\\[\\/" + bb + "\\]", "gi");
    text = text.replace(re, (...args: string[]) => {
      const opt = hasOpt ? String(args[1] ?? "").trim() : "";
      const inner = hasOpt ? args[2] : args[1];
      const cap = escapeHtml(label(opt));
      return (
        '<div class="bb-hide"><span class="bb-hide-label">\uD83D\uDD12 ' +
        cap +
        '</span><div class="bb-hide-body">' +
        inner +
        "</div></div>"
      );
    });
  }

  text = text.replace(/\r?\n/g, "<br />");

  for (const { token, html } of placeholders) {
    text = text.split(token).join(html);
  }

  return text;
};
