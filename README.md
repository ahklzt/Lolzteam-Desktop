<img width="1266" height="793" alt="image" src="https://nztcdn.com/files/bf79ba0d-182f-4a0c-8b36-464e42f94fd3.webp" />

# Lolzteam-Desktop
Приложение для использования lolz.team и lzt.market посредственно через ПК приложение с новым функционалом;

## Установка

Скачайте установщик со страницы [Releases](https://github.com/ahklzt/Lolzteam-Desktop/releases) и запустите.

## Сборка из исходников

Требуется [Node.js](https://nodejs.org) ≥ 20.18 и [pnpm](https://pnpm.io) 10.

Если `pnpm` не установлено, установите его через npm:

```bash
npm install -g pnpm
```

или включите Corepack (если он доступен):

```bash
corepack enable pnpm
```

```bash
pnpm install
pnpm dev      # запуск в режиме разработки
pnpm dist     # сборка установщика для Windows (папка release/)
```

## Стек

Electron 33 · React 19 · TypeScript · electron-vite · TanStack Query · Zustand · pnpm workspaces

## Лицензия

[MIT](LICENSE)
