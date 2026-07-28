import type { MouseEvent } from "react";

export const handleBbInteraction = (e: MouseEvent<HTMLElement>): void => {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  const img = target.closest("img");
  if (
    img &&
    !img.closest("a") &&
    !img.matches(".bb-smilie, .chat-smilie, .mceSmilie")
  ) {
    const src = img.getAttribute("src");
    if (src) {
      window.dispatchEvent(
        new CustomEvent("lzt:image-preview", { detail: { src } }),
      );
    }
    return;
  }

  const spoilerBtn = target.closest(".bbCodeSpoilerButton");
  if (spoilerBtn) {
    const container = spoilerBtn.closest(".bbCodeSpoilerContainer");
    const body = container?.querySelector<HTMLElement>(".SpoilerTarget");
    if (container && body) {
      const opened = container.classList.toggle("open");
      body.style.display = opened ? "block" : "none";
      body.style.opacity = opened ? "1" : "0";
    }
    return;
  }

  const censor = target.closest(".CensorSpoiler");
  if (censor) {
    censor.classList.add("revealed");
  }
};
