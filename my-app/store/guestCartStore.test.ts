import { beforeEach, describe, expect, it } from "vitest";
import {
  useGuestCartStore,
  guestCartRestaurantId,
  guestLineKey,
  type GuestCartLine,
} from "./guestCartStore";

function line(overrides: Partial<GuestCartLine> = {}): GuestCartLine {
  return {
    restaurantId: "r1",
    restaurantName: "Diner One",
    menuItemId: "m1",
    quantity: 1,
    unitPrice: { amount: 29999, currency: "INR" },
    name: "Margherita Pizza",
    ...overrides,
  };
}

describe("guestCartStore", () => {
  beforeEach(() => {
    useGuestCartStore.setState({ lines: [] });
    localStorage.clear();
  });

  it("stages a new line", () => {
    const result = useGuestCartStore.getState().addLine(line());
    expect(result).toEqual({ ok: true });
    expect(useGuestCartStore.getState().lines).toHaveLength(1);
  });

  it("merges quantity when the same menu item is added again", () => {
    const add = useGuestCartStore.getState().addLine;
    add(line({ quantity: 2 }));
    add(line({ quantity: 3 }));
    const lines = useGuestCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(5);
  });

  it("refuses a line from a different restaurant (single-restaurant rule)", () => {
    useGuestCartStore.getState().addLine(line());
    const result = useGuestCartStore
      .getState()
      .addLine(line({ restaurantId: "r2", menuItemId: "m2" }));
    expect(result).toEqual({ ok: false, reason: "cross-restaurant" });
    expect(useGuestCartStore.getState().lines).toHaveLength(1);
  });

  it("replaceWith starts a fresh single-line buffer", () => {
    useGuestCartStore.getState().addLine(line());
    useGuestCartStore.getState().replaceWith(line({ restaurantId: "r2", menuItemId: "m2" }));
    const lines = useGuestCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].restaurantId).toBe("r2");
  });

  it("setQuantity updates, and removes the line at 0", () => {
    useGuestCartStore.getState().addLine(line());
    useGuestCartStore.getState().setQuantity("m1", 4);
    expect(useGuestCartStore.getState().lines[0].quantity).toBe(4);
    useGuestCartStore.getState().setQuantity("m1", 0);
    expect(useGuestCartStore.getState().lines).toHaveLength(0);
  });

  it("removeLine and clear empty the buffer", () => {
    const add = useGuestCartStore.getState().addLine;
    add(line());
    add(line({ menuItemId: "m2" }));
    useGuestCartStore.getState().removeLine("m1");
    expect(useGuestCartStore.getState().lines).toHaveLength(1);
    useGuestCartStore.getState().clear();
    expect(useGuestCartStore.getState().lines).toHaveLength(0);
  });

  it("getCount sums line quantities", () => {
    const add = useGuestCartStore.getState().addLine;
    add(line({ quantity: 2 }));
    add(line({ menuItemId: "m2", quantity: 3 }));
    expect(useGuestCartStore.getState().getCount()).toBe(5);
  });

  it("guestCartRestaurantId returns the buffer's restaurant or null", () => {
    expect(guestCartRestaurantId([])).toBeNull();
    expect(guestCartRestaurantId([line()])).toBe("r1");
  });
});

/**
 * Variant lines (Phase 10-4.3). The server cart keys a line on menu item + option set
 * (`LineItemSelection.hasSameSelection`); the guest buffer must agree, or replaying it
 * on login would collapse two different configurations into one.
 */
describe("guestCartStore variant lines", () => {
  beforeEach(() => {
    useGuestCartStore.setState({ lines: [] });
    localStorage.clear();
  });

  it("keys a line on menu item + option set, order-insensitively", () => {
    expect(guestLineKey({ menuItemId: "m1", selectedOptionIds: [] })).toBe("m1");
    expect(guestLineKey({ menuItemId: "m1" })).toBe("m1");
    expect(guestLineKey({ menuItemId: "m1", selectedOptionIds: ["b", "a"] })).toBe(
      guestLineKey({ menuItemId: "m1", selectedOptionIds: ["a", "b"] }),
    );
    expect(guestLineKey({ menuItemId: "m1", selectedOptionIds: ["a"] })).not.toBe("m1");
  });

  it("keeps two option sets of the same item as separate lines", () => {
    const add = useGuestCartStore.getState().addLine;
    add(line({ selectedOptionIds: ["small"], quantity: 1 }));
    add(line({ selectedOptionIds: ["large"], quantity: 2 }));

    const lines = useGuestCartStore.getState().lines;
    expect(lines).toHaveLength(2);
    expect(useGuestCartStore.getState().getCount()).toBe(3);
  });

  it("merges quantity only when the option set matches", () => {
    const add = useGuestCartStore.getState().addLine;
    add(line({ selectedOptionIds: ["a", "b"], quantity: 1 }));
    add(line({ selectedOptionIds: ["b", "a"], quantity: 2 }));

    const lines = useGuestCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it("removes only the addressed variant line", () => {
    const add = useGuestCartStore.getState().addLine;
    add(line({ selectedOptionIds: ["small"] }));
    add(line({ selectedOptionIds: ["large"] }));

    useGuestCartStore.getState().removeLine(
      guestLineKey({ menuItemId: "m1", selectedOptionIds: ["small"] }),
    );

    const lines = useGuestCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0].selectedOptionIds).toEqual(["large"]);
  });
});
