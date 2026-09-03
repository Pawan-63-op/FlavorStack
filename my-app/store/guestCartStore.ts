import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Guest cart buffer (Batch 5.4). The server `/cart` is auth-only, so a
 * logged-out shopper stages lines here (localStorage); on login they are
 * replayed into the server cart (`lib/api/cart/replayGuestCart.ts`) and the
 * buffer is cleared.
 *
 * Each line carries the exact server `addToCart` wire shape — `restaurantId`,
 * `menuItemId`, optional `selectedOptionIds`, `quantity`, and `unitPrice` in
 * **integer minor units** — so replay needs no re-derivation. `name`/`image`
 * are display-only (the server cart has no image). The buffer is
 * single-restaurant, mirroring the server cart rule.
 */
export interface GuestCartUnitPrice {
  /** Integer minor units (paise/cents) — `addToCartSchema.unitPrice`. */
  amount: number;
  currency: string;
}

export interface GuestCartLine {
  restaurantId: string;
  restaurantName?: string;
  menuItemId: string;
  selectedOptionIds?: string[];
  quantity: number;
  unitPrice: GuestCartUnitPrice;
  name: string;
  image?: string;
}

export type GuestAddResult = { ok: true } | { ok: false; reason: "cross-restaurant" };

/**
 * A guest line's identity. Two lines are the same line only when they are the same menu
 * item **with the same set of selected options** — the rule the server cart applies in
 * `LineItemSelection.hasSameSelection`. Keying on `menuItemId` alone would merge a
 * "Pizza (Large)" into a "Pizza (Small)" once the variant picker exists.
 */
export function guestLineKey(line: Pick<GuestCartLine, "menuItemId" | "selectedOptionIds">): string {
  const options = [...(line.selectedOptionIds ?? [])].sort().join(",");
  return options ? `${line.menuItemId}|${options}` : line.menuItemId;
}

interface GuestCartState {
  lines: GuestCartLine[];
  /**
   * Stage a line. Same-restaurant adds merge by {@link guestLineKey}; a line from a
   * different restaurant is refused (single-restaurant rule) and the caller
   * decides whether to {@link replaceWith}.
   */
  addLine: (line: GuestCartLine) => GuestAddResult;
  /** Replace the whole buffer with a single line ("start a new cart"). */
  replaceWith: (line: GuestCartLine) => void;
  /** Set an absolute quantity by {@link guestLineKey}; `<= 0` removes the line. */
  setQuantity: (lineKey: string, quantity: number) => void;
  removeLine: (lineKey: string) => void;
  clear: () => void;
  getCount: () => number;
}

export const useGuestCartStore = create<GuestCartState>()(
  persist(
    (set, get) => ({
      lines: [],

      addLine: (line) => {
        const lines = get().lines;
        if (lines.length > 0 && lines[0].restaurantId !== line.restaurantId) {
          return { ok: false, reason: "cross-restaurant" };
        }
        const key = guestLineKey(line);
        const existing = lines.find((l) => guestLineKey(l) === key);
        if (existing) {
          set({
            lines: lines.map((l) =>
              guestLineKey(l) === key ? { ...l, quantity: l.quantity + line.quantity } : l,
            ),
          });
        } else {
          set({ lines: [...lines, line] });
        }
        return { ok: true };
      },

      replaceWith: (line) => set({ lines: [line] }),

      setQuantity: (lineKey, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { lines: state.lines.filter((l) => guestLineKey(l) !== lineKey) };
          }
          return {
            lines: state.lines.map((l) =>
              guestLineKey(l) === lineKey ? { ...l, quantity } : l,
            ),
          };
        }),

      removeLine: (lineKey) =>
        set((state) => ({
          lines: state.lines.filter((l) => guestLineKey(l) !== lineKey),
        })),

      clear: () => set({ lines: [] }),

      getCount: () => get().lines.reduce((n, l) => n + l.quantity, 0),
    }),
    {
      name: "guest-cart-storage",
      partialize: (state) => ({ lines: state.lines }),
    },
  ),
);

/** The buffer's single active restaurant id (or null when empty). */
export function guestCartRestaurantId(lines: GuestCartLine[]): string | null {
  return lines[0]?.restaurantId ?? null;
}
