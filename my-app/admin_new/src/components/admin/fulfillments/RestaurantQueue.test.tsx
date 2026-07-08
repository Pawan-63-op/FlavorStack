import { describe, expect, it } from "vitest";
import { ownerActionsForStatus, resolveQueueView } from "./RestaurantQueue";

describe("resolveQueueView", () => {
  it("shows the no-restaurants state when the owner has none (ownership gate)", () => {
    expect(
      resolveQueueView({ ownedCount: 0, restaurantId: "rest1", isLoading: false, resultCount: 5 }),
    ).toBe("no-restaurants");
  });

  it("prompts for a selection when restaurants exist but none is picked", () => {
    expect(
      resolveQueueView({ ownedCount: 2, restaurantId: "", isLoading: false, resultCount: 0 }),
    ).toBe("no-selection");
  });

  it("shows loading once a restaurant is selected and the query is in flight", () => {
    expect(
      resolveQueueView({ ownedCount: 2, restaurantId: "rest1", isLoading: true, resultCount: 0 }),
    ).toBe("loading");
  });

  it("shows the empty state for a selected restaurant with no fulfillments", () => {
    expect(
      resolveQueueView({ ownedCount: 2, restaurantId: "rest1", isLoading: false, resultCount: 0 }),
    ).toBe("empty");
  });

  it("shows the list when a selected restaurant has fulfillments", () => {
    expect(
      resolveQueueView({ ownedCount: 2, restaurantId: "rest1", isLoading: false, resultCount: 3 }),
    ).toBe("list");
  });

  it("prioritises the ownership gate over a stale selection", () => {
    expect(
      resolveQueueView({ ownedCount: 0, restaurantId: "rest1", isLoading: true, resultCount: 9 }),
    ).toBe("no-restaurants");
  });
});

describe("ownerActionsForStatus", () => {
  it("offers Mark Preparing from CREATED", () => {
    expect(ownerActionsForStatus("CREATED")).toEqual(["preparing"]);
  });

  it("offers Mark Ready from PREPARING", () => {
    expect(ownerActionsForStatus("PREPARING")).toEqual(["ready"]);
  });

  it("offers nothing once READY_FOR_PICKUP", () => {
    expect(ownerActionsForStatus("READY_FOR_PICKUP")).toEqual([]);
  });

  it("offers nothing on terminal/other statuses", () => {
    expect(ownerActionsForStatus("DELIVERED")).toEqual([]);
    expect(ownerActionsForStatus("CANCELLED")).toEqual([]);
  });
});
