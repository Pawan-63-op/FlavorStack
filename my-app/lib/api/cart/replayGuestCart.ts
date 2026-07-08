import { ApiError } from "../errors/ApiError";
import { cartService } from "../services/cart";
import { useGuestCartStore } from "../../../store/guestCartStore";

/** Per-line outcome of a guest-cart merge. */
export interface GuestReplayReport {
  total: number;
  /** Lines successfully POSTed into the server cart. */
  added: number;
  /** Lines skipped because the server cart belongs to another restaurant. */
  skipped: number;
  /** Lines that failed for a transient/other reason (buffer is kept). */
  failed: number;
}

/**
 * Best-effort, sequential replay of the staged guest cart into the server cart
 * on login (Batch 5.4). Each line is POSTed via `cartService.addItem` in order.
 *
 * Merge-conflict policy (Phase_5.md §5.4 task 3): **append the guest lines into
 * the existing server cart, skipping cross-restaurant lines**. A `conflict`
 * (the server cart already holds another restaurant's items) is therefore
 * counted as `skipped`, not fatal; any other error is `failed`.
 *
 * The buffer is cleared only when nothing `failed`, so a transient network
 * error leaves the items staged for the next login (no silent data loss).
 * This function is React-free and unit-testable; the caller invalidates the
 * `['cart']` query once it resolves.
 */
export async function replayGuestCart(): Promise<GuestReplayReport> {
  const { lines } = useGuestCartStore.getState();
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const line of lines) {
    try {
      await cartService.addItem({
        restaurantId: line.restaurantId,
        menuItemId: line.menuItemId,
        selectedOptionIds: line.selectedOptionIds,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
      });
      added += 1;
    } catch (err) {
      if (err instanceof ApiError && err.category === "conflict") {
        skipped += 1;
      } else {
        failed += 1;
      }
    }
  }

  if (failed === 0) {
    useGuestCartStore.getState().clear();
  }

  return { total: lines.length, added, skipped, failed };
}
