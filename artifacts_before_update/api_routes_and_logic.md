# API Routes & Business Logic Structure

The backend of FlavorStack uses **Express.js** to handle HTTP requests. The architecture strictly follows the MVC (Model-View-Controller) pattern, decoupling the routing layer from the actual business logic layer.

## Overview
1.  **`server/index.ts`**: The entry point. It sets up middlewares (CORS, body-parser) and mounts all route modules to their specific `/api/*` base paths.
2.  **`server/routes/*.ts`**: Define the specific endpoints (GET, POST, PATCH, etc.) and attach any necessary middlewares (like `protect` for authenticating JWTs, or `admin` for authorization). They then pass the request to a controller.
3.  **`server/controllers/*.ts`**: Contains the core business logic. They receive the Request/Response objects, interact with Mongoose models, handle third-party services (like Stripe), and return JSON.

---

## 1. Authentication (`/api/auth`)
**Router:** `authRoutes.ts` | **Controller:** `authController.ts`
*   **POST `/register`**: Validates input, hashes passwords, creates `User`, generates an OTP, and sends a verification email.
*   **POST `/login`**: Verifies email/password, generates a JWT token, and sets it in an HTTP-only cookie.
*   **POST `/verify-email`**: Compares user-submitted OTP against the DB to activate the account.
*   **POST `/logout`**: Clears the JWT cookie.
*   **GET `/check-auth`**: Returns the current logged-in user based on the JWT cookie.

## 2. User Management (`/api/users`)
**Router:** `userRoutes.ts` | **Controller:** `userController.ts`
*   **GET `/profile`**: Fetches the currently authenticated user's profile.
*   **PATCH `/profile`**: Allows a user to update their details (bio, phone, etc.).
*   **GET `/`** (Admin only): Fetches all users registered on the platform.

## 3. Order Processing (`/api/orders`)
**Router:** `orderRoutes.ts` | **Controller:** `orderController.ts`
*   **POST `/`**: Validates cart data, creates an `Order` in MongoDB, updates user loyalty points, and records a `LoyaltyTransaction`.
*   **GET `/`**: Retrieves order history for the authenticated user.
*   **GET `/:orderId`**: Fetches a single specific order by its MongoDB `_id`.
*   **GET `/by-order-id/:orderId`**: Fetches an order using the human-readable string ID (e.g., `ORD-123`).
*   **PATCH `/:orderId/cancel`**: Allows users to cancel an order if its status is still 'pending'. Reverts loyalty points.
*   **PATCH `/:orderId/status`** (Admin): Updates the status of an order (e.g., to "out-for-delivery").

## 4. Restaurant Management (`/api/restaurants`)
**Router:** `restaurantRoutes.ts` | **Controller:** `restaurantController.ts`
*   **GET `/`**: Lists all restaurants, potentially with pagination/filtering.
*   **GET `/:id`**: Gets full details for a specific restaurant.
*   **POST `/`** (Admin): Creates a new restaurant profile.
*   **PATCH `/:id`** (Admin): Updates a restaurant's info (hours, cuisine, etc.).

## 5. Menu Management (`/api/menu`)
**Router:** `menuRoutes.ts` | **Controller:** `menuController.ts`
*   **GET `/:restaurantId`**: Fetches all `MenuItems` belonging to a specific restaurant.
*   **POST `/`** (Admin): Creates a new dish and links it to a restaurant.

## 6. Review System (`/api/reviews`)
**Router:** `reviewRoutes.ts` | **Controller:** `reviewController.ts`
*   **POST `/`**: Submits a new review. The controller checks if the user has already reviewed this order to prevent duplicates.
*   **GET `/restaurant/:id`**: Fetches all reviews for a specific restaurant.

## 7. Chat & Support (`/api/chat`)
**Router:** `ChatRoutes.ts`
*   Provides REST endpoints to fetch previous `Messages` and `Conversations` from MongoDB. Real-time delivery of new messages is handled separately in `server/socket.ts` using Socket.io.

## 8. Miscellaneous Endpoints
*   **Coupons (`/api/coupons`)**: Logic to validate discount codes during checkout.
*   **Loyalty (`/api/loyalty`)**: Logic to view user points and past transaction history.
*   **Favorites (`/api/favorites`)**: Logic to save/remove restaurants or recipes from a user's wishlist.
*   **Addresses (`/api/addresses`)**: CRUD operations for a user's delivery address book.
*   **Uploads (`/api/upload`)**: Middleware configuration (`multer`) that accepts images and uploads them to Cloudinary.

---

### Example Flow (Creating an Order)
1.  **Client** sends `POST /api/orders` with cart JSON and JWT cookie.
2.  **`server/index.ts`** intercepts request, parses JSON, and routes to `/api/orders`.
3.  **`orderRoutes.ts`** runs the `protect` middleware. `protect` verifies the JWT. If valid, it attaches the `User` object to `req.user` and calls `createOrder`.
4.  **`orderController.ts` (`createOrder`)** extracts `req.body` and `req.user._id`. It calculates the total, saves the `Order` to MongoDB, updates the user's `loyaltyPoints`, and responds with `201 Created` and the new order data.
