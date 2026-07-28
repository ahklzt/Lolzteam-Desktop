import { Menu, Tray, app, type NativeImage } from "electron";
import { getBundledIcon } from "./app-icon";
import { getMainWindow, setQuitting, showMainWindow } from "./main-window";

let tray: Tray | null = null;

export const ensureTray = (): Tray => {
  if (tray && !tray.isDestroyed()) return tray;

  const image = getBundledIcon().resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip("Lolzteam Desktop");

  const menu = Menu.buildFromTemplate([
    { label: "Открыть", click: () => showMainWindow() },
    { type: "separator" },
    {
      label: "Выход",
      click: () => {
        setQuitting(true);
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => {
    const win = getMainWindow();
    if (win && win.isVisible()) win.hide();
    else showMainWindow();
  });

  return tray;
};

export const setTrayImage = (img: NativeImage): void => {
  if (tray && !tray.isDestroyed())
    tray.setImage(img.resize({ width: 16, height: 16 }));
};

export const destroyTray = (): void => {
  if (tray && !tray.isDestroyed()) tray.destroy();
  tray = null;
};
