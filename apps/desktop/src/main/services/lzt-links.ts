const INTERNAL_PATTERNS: RegExp[] = [
  /lolz\.(?:team|live)\/members\//i,
  /lzt\.market\/\d+/i,
  /lolz\.(?:team|live)\/threads\/(?:[^/]*?\.)?\d+/i,
  /lolz\.(?:team|live)\/forums\/(?:[^/]*?\.)?\d+/i,
  /^https?:\/\/lolz\.(?:team|live)\/?(?:[?#]|$)/i,
  /^https?:\/\/lolz\.(?:team|live)\/(?!(?:account|members|threads|forums|posts|chat|chatbox|conversations|search|whats-new|find-new|online|help|misc|pages|tags|categories|articles|login|logout|register|lost-password|market|goto|attachments|watched|notifications|new-features|guarantor|antipublic|banned|support-tickets|rules|payment|balance|upgrades)(?:[/?#]|$))[a-zA-Z0-9][\w.-]*\/?(?:[?#]|$)/i,
];

export const isInternalLztLink = (url: string): boolean =>
  typeof url === "string" && INTERNAL_PATTERNS.some((re) => re.test(url));
