# Zustand State Management (Frontend Stores)

The Next.js frontend uses **Zustand** for global state management. The state is highly modularized, split into separate stores based on their specific domain or feature. This approach keeps the code clean, makes testing easier, and prevents unnecessary re-renders.

Below is the detailed logic and responsibility for each store located in `my-app/store`.

---

## 1. Authentication Store (`authStore.ts`)
**Purpose**: Manages the user's session, profile data, and authentication status.
*   **Key State**: `user` object, `isAuthenticated` boolean, `isLoading` flag.
*   **Key Logic**:
    *   **API Interactions**: Contains async functions (`register`, `login`, `verifyEmail`, `logout`) that make requests to the Express backend (`/api/auth`).
    *   **Persistence**: Uses Zustand's `persist` middleware. The `user` and `isAuthenticated` states are saved directly to the browser's `localStorage` under the key `"auth-session-storage"`. This ensures the user remains logged in even if they refresh the page.

## 2. Cart Store (`cartStore.ts`)
**Purpose**: Handles the user's shopping cart before they check out.
*   **Key State**: `cart` array (current items), `orders` array (local snapshot of recent orders).
*   **Key Logic**:
    *   **Local Mutations**: Actions like `addToCart`, `removeFromCart`, and `updateQuantity` modify the local array. If an item already exists, it intelligently increments the quantity instead of adding a duplicate row.
    *   **Calculations**: Includes getter functions like `getCartTotal()` which iterates over the cart to dynamically calculate the total price in real-time.

## 3. Address Store (`addressStore.ts`)
**Purpose**: Manages the user's saved delivery addresses.
*   **Key State**: `addresses` array, `isLoading` flag.
*   **Key Logic**:
    *   **Optimistic UI Updates**: Functions like `setDefault(id)` and `deleteAddress(id)` update the local UI *immediately* before the backend confirms it. If the `fetch` request fails, they roll back the state and show an error via `toast`.
    *   **CRUD Operations**: Connects to `/api/addresses` to Fetch, Add, Update, and Delete address records.

## 4. Favorites Store (`favoritesStore.ts`)
**Purpose**: Tracks which restaurants and recipes the user has "liked" or "saved".
*   **Key State**: `favorites` (Restaurants), `favoritesRecipe` (Recipes).
*   **Key Logic**:
    *   **Dual Behavior**: 
        *   **Restaurants**: Are synced with the MongoDB database via the `/api/favorites` endpoint. Toggling a favorite sends an HTTP request.
        *   **Recipes**: Managed purely locally (hardcoded arrays for the demo/frontend), no backend calls are made.

## 5. Loyalty Store (`loyaltyStore.ts`)
**Purpose**: Manages the gamification and rewards system (Points and Tiers).
*   **Key State**: `points` (total), `transactions` (history of earned/redeemed), `tier` (current level).
*   **Key Logic**:
    *   **Tier Calculation**: The `recalcTier()` function automatically evaluates the total points against predefined thresholds (Bronze 0, Silver 500, Gold 1500, Platinum 5000) and updates the user's tier.
    *   **Data Fetching**: Fetches transaction history from `/api/loyalty/transactions` and computes the total points locally based on the returned history.

## 6. Review Store (`reviewStore.ts`)
**Purpose**: Handles user ratings and feedback for restaurants.
*   **Key State**: `reviews` (for a specific viewed restaurant), `userReviews` (reviews authored by the logged-in user).
*   **Key Logic**:
    *   **Dynamic Fetching**: `fetchRestaurantReviews(id)` pulls the specific reviews for whatever restaurant profile the user is currently viewing.
    *   **Derived State**: Uses `getAverageRating(id)` to dynamically calculate the star rating based on the currently loaded reviews array.

## 7. Coupon Store (`couponStore.ts`)
**Purpose**: Manages promotional codes and discount application.
*   **Key State**: `coupons` (available codes), `appliedCoupon` (currently active code).
*   **Key Logic**:
    *   **Validation Logic**: `validateCoupon(code, orderTotal)` checks multiple conditions before allowing a coupon: Is it active? Has it expired? Does the cart meet the `minOrder` threshold?
    *   **Discount Calculation**: `calculateDiscount(orderTotal)` checks if the applied coupon is a "fixed" amount (e.g., $5 off) or a "percentage" (e.g., 10% off), respecting the `maxDiscount` cap if one exists.

## 8. Recipe Store (`recipeStore.ts`)
**Purpose**: Fetches and stores cooking recipes for the blog/discovery section.
*   **Key State**: `recipes` array.
*   **Key Logic**: Uses `axios` to fetch all recipes or filter them based on query parameters (`category`, `difficulty`).

## 9. Theme Store (`themeStore.ts`)
**Purpose**: Manages the UI's Dark Mode vs Light Mode setting.
*   **Key State**: `theme` ("light" or "dark").
*   **Key Logic**:
    *   **DOM Manipulation**: When toggled, it physically adds or removes the `"dark"` class from the HTML document's `root` element (`document.documentElement`). This triggers Tailwind's `dark:` utility classes.
    *   **System Preference**: On initial load (`initializeTheme`), it checks `localStorage` first. If no preference is saved, it checks the user's OS settings using `window.matchMedia("(prefers-color-scheme: dark)")`.
