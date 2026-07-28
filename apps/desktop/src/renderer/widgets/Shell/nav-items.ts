import {
  MessagesSquare,
  Settings,
  ShoppingCart,
  User,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ViewId } from "~/stores/view";

export type NavItem = { id: ViewId; icon: LucideIcon; labelKey: string };

export const NAV_ITEMS: NavItem[] = [
  { id: "market", icon: ShoppingCart, labelKey: "nav.market" },
  { id: "forum", icon: MessagesSquare, labelKey: "nav.forum" },
  { id: "tools", icon: Wrench, labelKey: "nav.tools" },
  { id: "profile", icon: User, labelKey: "nav.profile" },
  { id: "settings", icon: Settings, labelKey: "nav.settings" },
];

export const NAV_ALWAYS_VISIBLE: ViewId = "settings";

export const orderedNavIds = (order: string[]): ViewId[] => {
  const seen = new Set<string>();
  const result: ViewId[] = [];
  for (const id of order) {
    const item = NAV_ITEMS.find((i) => i.id === id);
    if (item && !seen.has(item.id)) {
      result.push(item.id);
      seen.add(item.id);
    }
  }
  for (const item of NAV_ITEMS) {
    if (!seen.has(item.id)) result.push(item.id);
  }
  return result;
};

export const visibleNavItems = (
  order: string[],
  hidden: string[],
): NavItem[] => {
  const hiddenSet = new Set(hidden);
  const result: NavItem[] = [];
  for (const id of orderedNavIds(order)) {
    const item = NAV_ITEMS.find((i) => i.id === id);
    if (!item) continue;
    if (item.id !== NAV_ALWAYS_VISIBLE && hiddenSet.has(item.id)) continue;
    result.push(item);
  }
  return result;
};
