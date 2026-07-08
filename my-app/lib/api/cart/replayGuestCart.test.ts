import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../errors/ApiError";
import { cartService } from "../services/cart";
import { useGuestCartStore, type GuestCartLine } from "../../../store/guestCartStore";
import { replayGuestCart } from "./replayGuestCart";

vi.mock("../services/cart", () => ({
  cartService: { addItem: vi.fn() },
}));

const addItem = vi.mocked(cartService.addItem);

function line(overrides: Partial<GuestCartLine> = {}): GuestCartLine {
  return {
    restaurantId: "r1",
    menuItemId: "m1",
    quantity: 1,
    unitPrice: { amount: 29999, currency: "INR" },
    name: "Margherita Pizza",
    ...overrides,
  };
}

function seed(lines: GuestCartLine[]): void {
  useGuestCartStore.setState({ lines });
}

describe("replayGuestCart", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useGuestCartStore.setState({ lines: [] });
    localStorage.clear();
  });

  it("adds every staged line in order and clears the buffer", async () => {
    addItem.mockResolvedValue({} as never);
    seed([line({ menuItemId: "m1" }), line({ menuItemId: "m2" })]);

    const report = await replayGuestCart();

    expect(addItem).toHaveBeenCalledTimes(2);
    expect(addItem).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ menuItemId: "m1", restaurantId: "r1", unitPrice: { amount: 29999, currency: "INR" } }),
    );
    expect(report).toEqual({ total: 2, added: 2, skipped: 0, failed: 0 });
    expect(useGuestCartStore.getState().lines).toHaveLength(0);
  });

  it("skips a cross-restaurant conflict (server cart from another restaurant)", async () => {
    addItem
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new ApiError({ status: 409, code: "conflict", message: "different restaurant" }));
    seed([line({ menuItemId: "m1" }), line({ menuItemId: "m2" })]);

    const report = await replayGuestCart();

    expect(report).toEqual({ total: 2, added: 1, skipped: 1, failed: 0 });
    expect(useGuestCartStore.getState().lines).toHaveLength(0);
  });

  it("keeps the buffer when a line fails transiently", async () => {
    addItem.mockRejectedValue(new ApiError({ status: 500, code: "server_error", message: "boom" }));
    seed([line()]);

    const report = await replayGuestCart();

    expect(report).toEqual({ total: 1, added: 0, skipped: 0, failed: 1 });
    expect(useGuestCartStore.getState().lines).toHaveLength(1);
  });

  it("is a no-op for an empty buffer", async () => {
    const report = await replayGuestCart();
    expect(addItem).not.toHaveBeenCalled();
    expect(report).toEqual({ total: 0, added: 0, skipped: 0, failed: 0 });
  });
});
