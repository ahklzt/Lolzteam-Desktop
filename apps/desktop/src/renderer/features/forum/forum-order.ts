import type { ForumNode } from "@lzt/shared";

const CATEGORY_ORDER = [
  "основная категория",
  "тематическая категория",
  "игровая категория",
  "общая категория",
  "пользовательские разделы",
];

const FORUM_ORDER = [
  "халява",
  "торговля",
  "работа и услуги",
  "арбитраж",
  "тематические вопросы",
  "спроси у claude opus",
  "статьи",
  "софт",
  "pubg",
  "counter-strike 2",
  "dota 2",
  "overwatch",
  "fortnite",
  "valorant",
  "gta",
  "world of tanks",
  "mihoyo",
  "deadlock",
  "survival игры",
  "остальные игры",
  "сова со скакалкой",
  "компьютеры",
  "телефоны",
  "веб-разработка",
  "программирование",
  "графика",
  "жизнь форума",
  "тестовый раздел",
  "нора хомиака",
  "babybong вещает",
  "раздел билли",
  "раздел jacka",
  "анонимные темы",
  "бункер roblox",
];

const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

const rankIn = (list: string[], title: string): number => {
  const index = list.indexOf(normalize(title));
  return index === -1 ? list.length : index;
};

const rootRank = (node: ForumNode): number =>
  node.isCategory
    ? rankIn(CATEGORY_ORDER, node.title)
    : CATEGORY_ORDER.length + rankIn(FORUM_ORDER, node.title);

export const sortForumTree = (nodes: ForumNode[]): ForumNode[] => {
  const roots = [...nodes].sort((a, b) => rootRank(a) - rootRank(b));
  return roots.map((node) => {
    if (node.children.length === 0) return node;
    const children = [...node.children].sort(
      (a, b) => rankIn(FORUM_ORDER, a.title) - rankIn(FORUM_ORDER, b.title),
    );
    return { ...node, children };
  });
};
