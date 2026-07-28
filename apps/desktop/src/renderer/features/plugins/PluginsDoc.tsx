import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import styles from "./PluginsPanel.module.scss";

export const PluginsDoc = () => {
  const [open, setOpen] = useState(false);
  return (
    <section className={styles.doc}>
      <button
        type="button"
        className={styles.docToggle}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span>Документация: как писать плагины</span>
      </button>

      {open && (
        <div className={styles.docBody}>
          <p>
            Плагин — это обычный JavaScript, который выполняется внутри приложения
            (как скрипт Tampermonkey). Весь функционал доступен через глобальный
            объект <code>lzt</code>.
          </p>

          <h4 className={styles.docHead}>Данные через API</h4>
          <p>
            <code>lzt.api</code> — весь API приложения (то же, что{" "}
            <code>window.moderator</code>). Примеры:
          </p>
          <ul className={styles.docList}>
            <li>
              <code>await lzt.api.market.getPayments({"{ page: 1 }"})</code> —
              история платежей
            </li>
            <li>
              <code>await lzt.api.forum.getThread(id)</code> — тема форума
            </li>
            <li>
              <code>await lzt.api.profile.getMe()</code> — текущий профиль
            </li>
          </ul>

          <h4 className={styles.docHead}>Добавление вкладки в сайдбар</h4>
          <pre className={styles.docCode}>{`lzt.ui.addTab({
  id: 'my-tab',
  label: 'Моя вкладка',
  icon: '⭐', // эмодзи
  async render(root) {
    // root — DOM-контейнер вкладки
    root.innerHTML = '<h2>Привет!</h2>';
  }
});`}</pre>

          <h4 className={styles.docHead}>Стили (CSS)</h4>
          <pre className={styles.docCode}>{`lzt.css('.my-class { color: #00ba78 }');`}</pre>

          <h4 className={styles.docHead}>Перевод фраз</h4>
          <pre className={styles.docCode}>{`// переопределить любой ключ i18n
lzt.i18n.set('ru', 'nav.market', 'Мой Маркет');`}</pre>

          <h4 className={styles.docHead}>Хранилище и прочее</h4>
          <ul className={styles.docList}>
            <li>
              <code>lzt.storage.get(key)</code> / <code>lzt.storage.set(key, value)</code>{" "}
              — персональное хранилище плагина
            </li>
            <li>
              <code>lzt.notify(title, message)</code> — тост-уведомление
            </li>
            <li>
              <code>lzt.log(...)</code> — лог в консоль
            </li>
            <li>
              <code>lzt.onUnload(fn)</code> — очистка при выключении плагина
            </li>
          </ul>

          <p className={styles.docNote}>
            В одном плагине можно совмещать всё: и вкладки, и CSS, и переводы, и
            работу с API. Изменения применяются сразу после сохранения/включения.
          </p>
        </div>
      )}
    </section>
  );
};
