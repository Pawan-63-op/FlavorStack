import { describe, expect, it } from "vitest";
import {
  adminDashboardItemAdapter,
  deriveFulfillmentEligibility,
  fulfillmentAdminAdapter,
  type AdminDashboardItemResponse,
  type FulfillmentAdminResponse,
} from "./fulfillmentAdmin";

function makeItem(
  overrides: Partial<AdminDashboardItemResponse> = {},
): AdminDashboardItemResponse {
  return {
    fulfillmentId: "ful1",
    orderRequestId: "ord1",
    customerId: "cust1",
    restaurantId: "rest1",
    status: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    riderId: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:05:00.000Z",
    slaBreached: false,
    exceptionFlag: false,
    cancellation: null,
    failureReason: null,
    total: { amount: 1599, currency: "USD" },
    ...overrides,
  };
}

function makeFulfillment(
  overrides: Partial<FulfillmentAdminResponse> = {},
): FulfillmentAdminResponse {
  return {
    fulfillmentId: "ful1",
    orderRequestId: "ord1",
    customerId: "cust1",
    restaurantId: "rest1",
    status: "PREPARING",
    deliveryStatus: "UNASSIGNED",
    total: { amount: 1599, currency: "USD" },
    currentAssignment: null,
    cancellation: null,
    failureReason: null,
    createdAt: "2026-06-22T10:00:00.000Z",
    updatedAt: "2026-06-22T10:05:00.000Z",
    ...overrides,
  };
}

describe("deriveFulfillmentEligibility", () => {
  it.each(["CREATED", "PREPARING", "READY_FOR_PICKUP"])(
    "marks %s cancellable and reassignable",
    (status) => {
      expect(deriveFulfillmentEligibility(status)).toEqual({
        isCancellable: true,
        isReassignable: true,
      });
    },
  );

  it("marks PICKED_UP/OUT_FOR_DELIVERY reassignable but not cancellable", () => {
    expect(deriveFulfillmentEligibility("PICKED_UP")).toEqual({
      isCancellable: false,
      isReassignable: true,
    });
    expect(deriveFulfillmentEligibility("OUT_FOR_DELIVERY")).toEqual({
      isCancellable: false,
      isReassignable: true,
    });
  });

  it.each(["DELIVERED", "CANCELLED", "FAILED"])(
    "marks terminal status %s neither cancellable nor reassignable",
    (status) => {
      expect(deriveFulfillmentEligibility(status)).toEqual({
        isCancellable: false,
        isReassignable: false,
      });
    },
  );
});

describe("adminDashboardItemAdapter", () => {
  it("renames ids, converts money to major units, and labels statuses", () => {
    const view = adminDashboardItemAdapter(makeItem());

    expect(view.fulfillmentId).toBe("ful1");
    expect(view.orderRequestId).toBe("ord1");
    expect(view.total).toEqual({ amount: 15.99, currency: "USD" });
    expect(view.formattedTotal).toBe("$15.99");
    expect(view.statusLabel).toBe("Preparing");
    expect(view.deliveryStatusLabel).toBe("Awaiting rider");
    expect(view.formattedAge).toMatch(/ago|now/);
  });

  it("derives eligibility flags from the row status", () => {
    expect(adminDashboardItemAdapter(makeItem({ status: "PREPARING" })).isCancellable).toBe(true);
    expect(adminDashboardItemAdapter(makeItem({ status: "DELIVERED" })).isReassignable).toBe(false);
  });

  it("passes SLA/exception flags and cancellation/failure through", () => {
    const cancellation = { cancelledBy: "SYSTEM", reason: "out of stock", at: "2026-06-22T11:00:00.000Z" };
    const view = adminDashboardItemAdapter(
      makeItem({ slaBreached: true, exceptionFlag: true, cancellation, failureReason: "no rider" }),
    );

    expect(view.slaBreached).toBe(true);
    expect(view.exceptionFlag).toBe(true);
    expect(view.cancellation).toEqual(cancellation);
    expect(view.failureReason).toBe("no rider");
  });
});

describe("fulfillmentAdminAdapter", () => {
  it("maps the full aggregate, money, labels, and eligibility", () => {
    const view = fulfillmentAdminAdapter(
      makeFulfillment({
        currentAssignment: { riderId: "rider1", status: "ASSIGNED", attempt: 1, expiresAt: "2026-06-22T10:10:00.000Z" },
      }),
    );

    expect(view.fulfillmentId).toBe("ful1");
    expect(view.total).toEqual({ amount: 15.99, currency: "USD" });
    expect(view.formattedTotal).toBe("$15.99");
    expect(view.statusLabel).toBe("Preparing");
    expect(view.currentAssignment?.riderId).toBe("rider1");
    expect(view.isCancellable).toBe(true);
    expect(view.isReassignable).toBe(true);
  });

  it("omits optional prepEstimateMinutes/readyAt when absent", () => {
    const view = fulfillmentAdminAdapter(makeFulfillment());
    expect(view.prepEstimateMinutes).toBeUndefined();
    expect(view.readyAt).toBeUndefined();
    expect("prepEstimateMinutes" in view).toBe(false);
    expect("readyAt" in view).toBe(false);
  });

  it("includes optional prepEstimateMinutes/readyAt when present", () => {
    const view = fulfillmentAdminAdapter(
      makeFulfillment({ prepEstimateMinutes: 20, readyAt: "2026-06-22T10:20:00.000Z" }),
    );
    expect(view.prepEstimateMinutes).toBe(20);
    expect(view.readyAt).toBe("2026-06-22T10:20:00.000Z");
  });

  it("surfaces order lines so the owner sees what to prepare (G18)", () => {
    const view = fulfillmentAdminAdapter(
      makeFulfillment({
        lines: [
          {
            menuItemId: "m1",
            name: "Margherita Pizza",
            quantity: 2,
            selectedOptions: [{ optionId: "o1", label: "Extra cheese" }],
            lineTotal: { amount: 5998, currency: "USD" },
          },
        ],
      }),
    );

    expect(view.lines).toHaveLength(1);
    expect(view.lines[0]).toMatchObject({
      menuItemId: "m1",
      name: "Margherita Pizza",
      quantity: 2,
      formattedLineTotal: "$59.98",
    });
    expect(view.lines[0].selectedOptions).toEqual([{ optionId: "o1", label: "Extra cheese" }]);
  });

  it("defaults lines to an empty array when the wire payload omits them", () => {
    const view = fulfillmentAdminAdapter(makeFulfillment());
    expect(view.lines).toEqual([]);
  });

  it("surfaces the delivery address so the owner knows where it's going (G18)", () => {
    const view = fulfillmentAdminAdapter(
      makeFulfillment({
        deliveryAddress: {
          label: "Home",
          street: "123 MG Road",
          city: "Bengaluru",
          state: "KA",
          pinCode: "560001",
        },
      }),
    );

    expect(view.deliveryAddress).toEqual({
      label: "Home",
      street: "123 MG Road",
      city: "Bengaluru",
      state: "KA",
      pinCode: "560001",
    });
    expect(view.formattedAddress).toBe("123 MG Road, Bengaluru, KA 560001");
  });

  it("leaves deliveryAddress/formattedAddress undefined when absent", () => {
    const view = fulfillmentAdminAdapter(makeFulfillment());
    expect(view.deliveryAddress).toBeUndefined();
    expect(view.formattedAddress).toBeUndefined();
  });
});
