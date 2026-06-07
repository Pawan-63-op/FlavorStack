# FlavorStack Database Design

The FlavorStack application utilizes MongoDB with Mongoose ODM. Below is the detailed schema design and relationships for all the collections within the database.

## 1. User Collection (`users`)
Stores both customers and system administrators. Includes loyalty tier data.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique user identifier |
| `name` | String | Required | Full name of the user |
| `email` | String | Required, Unique | Login email address |
| `password` | String | Required, Select: false | Hashed password |
| `role` | String | Enum | `'user'` or `'admin'` (default: `'user'`) |
| `phone` | String | Optional | Contact number |
| `location` | String | Optional | General location |
| `avatar` | String | Optional | URL to profile picture |
| `loyaltyPoints`| Number | Default: `500` | Points accumulated from orders |
| `loyaltyTier` | String | Enum | `'Bronze'`, `'Silver'`, `'Gold'`, `'Platinum'` |
| `isActive` | Boolean | Default: `true` | Account status |
| `isVerified` | Boolean | Default: `false`| Email verification status |

---

## 2. Restaurant Collection (`restaurants`)
Stores the profiles of restaurants listed on the platform.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique restaurant identifier |
| `owner` | ObjectId | Ref: `User` | The user (admin) who owns/manages this |
| `restaurantName`| String | Required | Name of the restaurant |
| `cuisine` | String | Required | E.g., Italian, Indian, Mexican |
| `imageUrl` | String | Optional | URL to restaurant cover image |
| `rating` | Number | Min: `0`, Max: `5` | Average rating based on reviews |
| `totalReviews`| Number | Default: `0` | Count of reviews |
| `city` / `country`| String | Required | Location details |
| `priceRange` | String | Enum | `'$'`, `'$$'`, `'$$$'` |
| `isOpen` | Boolean | Default: `true` | Open for orders |
| `menus` | [ObjectId]| Ref: `MenuItem` | Array of references to menu items |

---

## 3. MenuItem Collection (`menuitems`)
Stores the individual dishes/items offered by a restaurant.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique item identifier |
| `restaurant` | ObjectId | Ref: `Restaurant` | The restaurant this item belongs to |
| `name` | String | Required | Name of the dish |
| `description` | String | Required | Brief description |
| `price` | Number | Required | Cost of the item |
| `category` | String | Enum | `'Appetizer'`, `'Main Course'`, `'Dessert'`, `'Beverage'`, `'Side'` |
| `image` | String | Optional | Image URL |
| `isVegetarian`| Boolean | Default: `false`| Dietary flag |
| `isSpicy` | Boolean | Default: `false`| Dietary flag |
| `isAvailable` | Boolean | Default: `true` | Can be ordered |
| `calorie` | Number | Default: `0` | Nutritional info |

---

## 4. Order Collection (`orders`)
Stores the details of a customer's purchase.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique MongoDB ID |
| `orderId` | String | Unique | Human-readable ID (e.g., `ORD-1234XYZ`) |
| `user` | ObjectId | Ref: `User` | Customer who placed the order |
| `restaurant` | ObjectId | Ref: `Restaurant` | Restaurant fulfilling the order |
| `items` | Array | Embedded | List of items ordered. Contains `menuItem` (Ref), `name`, `price`, `quantity` |
| `subtotal` | Number | Required | Cost before taxes and fees |
| `tax` / `deliveryFee`| Number | Required | Additional charges |
| `discount` | Number | Default: `0` | Amount discounted via coupon |
| `total` | Number | Required | Final amount paid |
| `couponApplied`| Object | Embedded | `{ code: String, discount: Number }` |
| `deliveryAddress`| Object | Embedded | `{ name, phone, address }` |
| `paymentMethod`| String | Enum | `'card'`, `'cash'`, `'wallet'` |
| `status` | String | Enum | `'pending'`, `'confirmed'`, `'preparing'`, `'out-for-delivery'`, `'Delivered'`, `'cancelled'` |
| `pointsEarned`| Number | Default: `0` | Loyalty points awarded for this order |
| `hasReview` | Boolean | Default: `false`| Has the user reviewed this order? |

---

## 5. Address Collection (`addresses`)
Stores delivery addresses saved by users.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique address ID |
| `user` | ObjectId | Ref: `User` | The owner of the address |
| `label` | String | Default: `'Home'` | e.g., "Home", "Work", "Other" |
| `name` | String | Required | Recipient's name |
| `phone` | String | Required | Contact number for delivery |
| `address` | String | Required | Full address string |
| `isDefault` | Boolean | Default: `false`| Is this the primary address? |

---

## 6. Review Collection (`reviews`)
Stores ratings and feedback for orders/restaurants.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique review ID |
| `user` | ObjectId | Ref: `User` | The author of the review |
| `restaurant` | ObjectId | Ref: `Restaurant` | The restaurant being reviewed |
| `order` | ObjectId | Ref: `Order` | The specific order this review relates to |
| `rating` | Number | Min: `1`, Max: `5` | Star rating |
| `comment` | String | Required | Text feedback |
| `photos` | [String] | Array of URLs | Attached images |
| `isApproved` | Boolean | Default: `true` | Moderation flag |

*Note: A compound unique index exists on `{ user, order }` to prevent duplicate reviews for the same order.*

---

## 7. Coupon Collection (`coupons`)
Stores promotional codes and discounts.

| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `_id` | ObjectId | Primary Key | Unique coupon ID |
| `code` | String | Unique | The actual code (e.g., `SUMMER20`) |
| `type` | String | Enum | `'percentage'`, `'fixed'`, `'shipping'` |
| `discount` | Number | Required | Value of discount |
| `minOrder` | Number | Default: `0` | Minimum order value to apply |
| `validFrom` / `validUntil` | Date | Required | Expiration window |
| `usageLimit` | Number | Optional | Max times this can be used globally |
| `usedCount` | Number | Default: `0` | Times successfully used |

---

## 8. Chat & Support (`messages` / `conversations`)
Handles real-time customer support.

### Messages Collection
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `room` | String | Index | Matches a user's ID for routing |
| `text` | String | Required | Message content |
| `senderRole` | String | Enum | `'customer'` or `'admin'` |
| `senderName` | String | Default: `""` | Display name of sender |
| `isRead` | Boolean | Default: `false`| Read receipt |

### Conversations Collection
*Acts as a summary to list active chat threads.*
| Field | Type | Attributes | Description |
| :--- | :--- | :--- | :--- |
| `userId` | String | Unique | The customer's ID |
| `status` | String | Enum | `'open'` or `'resolved'` |
| `lastMessage` | String | | Preview of latest text |
| `unreadCount` | Number | | Counter for unread messages |
