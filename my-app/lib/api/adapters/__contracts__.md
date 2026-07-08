# Adapter contracts: server DTO → view-model

Adapters in this folder are the single boundary where **server_2 DTOs** are
translated into the app's **view-models**. They are pure functions — no
network, no React — so they unit-test trivially per phase.

**Mapping source of truth:** `INTEGRATION_BLUEPRINT.md` §3.1 (DTO shapes) and
§7 (DTO → view-model mappings) at the repo root.

Each adapter ships as a **typed stub** that throws `not implemented` until its
consuming phase fills it in. This guarantees nothing silently ships a
half-mapped object.

| Adapter             | View-model            | Filled in |
| ------------------- | --------------------- | --------- |
| `userAdapter`       | `UserViewModel`       | Phase 1   |
| `restaurantAdapter` | `RestaurantViewModel` | Phase 4   |
| `menuAdapter`       | `MenuViewModel`       | Phase 4   |
| `cartAdapter`       | `CartViewModel`       | Phase 5   |
| `orderConfirmationAdapter` | `OrderConfirmationVM` | Phase 6 |
| `trackingAdapter`   | `TrackingView`        | Phase 7   |
| `reviewAdapter`     | `ReviewViewModel`     | Phase 9   |

When implementing an adapter, add co-located `*.test.ts` fixtures derived from
real server_2 responses (see the blueprint sections above).
