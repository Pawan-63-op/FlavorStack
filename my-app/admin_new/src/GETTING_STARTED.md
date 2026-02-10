# Getting Started with Admin Dashboard

This is a quick start guide to understand and use the refactored admin dashboard.

## 🚀 Quick Start (3 steps)

### 1. Understand the Structure
```
The app is now split into:
- Components (UI) → /components/admin/
- State (Data) → /store/
- No Context Providers needed!
```

### 2. How Zustand Works (No Context!)
```typescript
// ✅ Simply import and use - No providers needed!
import { useRestaurantStore } from "./store/restaurantStore";

function MyComponent() {
  // Select exactly what you need
  const restaurants = useRestaurantStore((state) => state.restaurants);
  const addRestaurant = useRestaurantStore((state) => state.addRestaurant);
  
  // Use it!
  const handleAdd = async () => {
    await addRestaurant({ name: "New Restaurant", ... });
  };
}
```

### 3. Run the App
```bash
npm install
npm run dev
```

That's it! The dashboard works with mock data until you connect your backend.

---

## 📚 Understanding the Components

### Main Dashboard (`/components/AdminDashboard.tsx`)
The container that holds all tabs:
- Overview
- Restaurants
- Menus
- Coupons
- Orders
- Users

### Individual Modules (`/components/admin/`)
Each tab is a separate component:

1. **OverviewDashboard** - Shows stats and recent orders
2. **RestaurantManagement** - Add/edit/delete restaurants with images
3. **MenuManagement** - Manage menu items with images
4. **CouponManagement** - Create promotional codes
5. **OrderManagement** - Track and update order status
6. **UserManagement** - Placeholder for future features

---

## 🗃️ Understanding the Stores

### What is Zustand?
Zustand is a lightweight state management library that:
- ✅ Doesn't need Context Providers
- ✅ Works like hooks
- ✅ Very simple API
- ✅ Great TypeScript support

### Available Stores

#### 1. Restaurant Store (`/store/restaurantStore.ts`)
Manages restaurant data and API calls:

```typescript
import { useRestaurantStore } from "./store/restaurantStore";

// Get data
const restaurants = useRestaurantStore((state) => state.restaurants);
const isLoading = useRestaurantStore((state) => state.isLoading);

// Call functions
const fetchRestaurants = useRestaurantStore((state) => state.fetchRestaurants);
const addRestaurant = useRestaurantStore((state) => state.addRestaurant);
const updateRestaurant = useRestaurantStore((state) => state.updateRestaurant);
const deleteRestaurant = useRestaurantStore((state) => state.deleteRestaurant);
```

#### 2. Menu Store (`/store/menuStore.ts`)
Manages menu items:

```typescript
import { useMenuStore } from "./store/menuStore";

const menuItems = useMenuStore((state) => state.menuItems);
const addMenuItem = useMenuStore((state) => state.addMenuItem);
```

#### 3. Cart Store (`/store/cartStore.ts`)
Manages cart AND orders:

```typescript
import { useCartStore } from "./store/cartStore";

// Cart operations
const cart = useCartStore((state) => state.cart);
const addToCart = useCartStore((state) => state.addToCart);

// Order operations
const orders = useCartStore((state) => state.orders);
const updateOrderStatus = useCartStore((state) => state.updateOrderStatus);
```

#### 4. Coupon Store (`/store/couponStore.ts`)
Manages discount coupons:

```typescript
import { useCouponStore } from "./store/couponStore";

const coupons = useCouponStore((state) => state.coupons);
const addCoupon = useCouponStore((state) => state.addCoupon);
const applyCoupon = useCouponStore((state) => state.applyCoupon);
```

---

## 🎯 Common Tasks

### Task 1: Add a New Restaurant
```typescript
import { useRestaurantStore } from "./store/restaurantStore";

function AddRestaurant() {
  const addRestaurant = useRestaurantStore((state) => state.addRestaurant);
  
  const handleSubmit = async () => {
    await addRestaurant({
      name: "Italian Bistro",
      cuisine: "Italian",
      city: "New York",
      country: "USA",
      rating: 4.5,
      deliveryTime: "30-40 min",
      priceRange: "$$",
      isOpen: true,
      imageUrl: "https://..."
    });
  };
}
```

### Task 2: Update Order Status
```typescript
import { useCartStore } from "./store/cartStore";

function UpdateOrder() {
  const updateOrderStatus = useCartStore((state) => state.updateOrderStatus);
  
  const markAsDelivered = async (orderId: string) => {
    await updateOrderStatus(orderId, "delivered");
  };
}
```

### Task 3: Create a Coupon
```typescript
import { useCouponStore } from "./store/couponStore";

function CreateCoupon() {
  const addCoupon = useCouponStore((state) => state.addCoupon);
  
  const createDiscount = () => {
    addCoupon({
      code: "SAVE20",
      discount: 20,
      type: "percentage",
      description: "20% off all orders",
      minOrder: 25,
      isActive: true
    });
  };
}
```

### Task 4: Upload an Image
The `ImageUpload` component handles this:

```typescript
import { ImageUpload } from "./components/ImageUpload";

function MyForm() {
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  
  const handleImageChange = (file: File | null, previewUrl: string | null) => {
    setImageFile(file);
    setImageUrl(previewUrl || "");
    
    // In production, upload to server here
    // const formData = new FormData();
    // formData.append('image', file);
    // const response = await axios.post('/api/upload', formData);
    // setImageUrl(response.data.url);
  };
  
  return (
    <ImageUpload
      value={imageUrl}
      onChange={handleImageChange}
      label="Restaurant Image"
    />
  );
}
```

---

## 🔌 Connecting to Your Backend

### Step 1: Create API Endpoints
Follow the guide in `/API_INTEGRATION_GUIDE.md` to set up:
- MongoDB database
- Express.js routes
- Image upload endpoint

### Step 2: Test Endpoints
Use Postman or Thunder Client to test:
```
GET    /api/restaurants
POST   /api/restaurants
PATCH  /api/restaurants/:id
DELETE /api/restaurants/:id
```

### Step 3: Enable Data Fetching
In `App.tsx`, uncomment the initialization:

```typescript
import { useInitializeStores } from "./hooks/useInitializeStores";

export default function App() {
  const { isLoading } = useInitializeStores(); // Uncomment this!
  
  return (
    <div className="min-h-screen bg-background">
      {isLoading ? <p>Loading...</p> : <AdminDashboard />}
      <Toaster />
    </div>
  );
}
```

### Step 4: Test Everything
- Add a restaurant → Check MongoDB
- Upload an image → Check your CDN
- Create an order → Check orders collection
- Apply a coupon → Verify discount calculation

---

## 🧪 Testing Without Backend

All stores work with local state before connecting to backend:

```typescript
// The stores automatically handle both scenarios:

// With backend
fetchRestaurants: async () => {
  const { data } = await axios.get("/api/restaurants");
  set({ restaurants: data });
}

// Without backend (local state only)
addRestaurant: (restaurant) => {
  set((state) => ({
    restaurants: [...state.restaurants, restaurant]
  }));
}
```

---

## 💡 Pro Tips

### 1. Select Only What You Need
```typescript
// ❌ Don't do this (subscribes to all changes)
const store = useRestaurantStore();

// ✅ Do this (only subscribes to restaurants)
const restaurants = useRestaurantStore((state) => state.restaurants);
```

### 2. Use Loading States
```typescript
const isLoading = useRestaurantStore((state) => state.isLoading);
const error = useRestaurantStore((state) => state.error);

if (isLoading) return <p>Loading...</p>;
if (error) return <p>Error: {error}</p>;
```

### 3. Handle Errors
```typescript
try {
  await addRestaurant(data);
  toast.success("Restaurant added!");
} catch (error) {
  toast.error("Failed to add restaurant");
  console.error(error);
}
```

### 4. Optimistic Updates
```typescript
// Update UI immediately, revert if backend fails
const optimisticUpdate = async () => {
  const originalData = useRestaurantStore.getState().restaurants;
  
  // Update UI
  set({ restaurants: [...originalData, newRestaurant] });
  
  try {
    await axios.post("/api/restaurants", newRestaurant);
  } catch (error) {
    // Revert on error
    set({ restaurants: originalData });
    toast.error("Failed to save");
  }
};
```

---

## 📖 Documentation Files

We've created several guides:

1. **GETTING_STARTED.md** (this file) - Quick overview
2. **ADMIN_DASHBOARD_README.md** - Detailed component docs
3. **API_INTEGRATION_GUIDE.md** - Backend setup guide
4. **REFACTORING_SUMMARY.md** - What changed and why

---

## 🆘 Troubleshooting

### Problem: Store not updating
**Solution:** Make sure you're using `set()` to update state:
```typescript
// ❌ Wrong
state.restaurants.push(newRestaurant);

// ✅ Correct
set((state) => ({
  restaurants: [...state.restaurants, newRestaurant]
}));
```

### Problem: Component not re-rendering
**Solution:** Make sure you're selecting state correctly:
```typescript
// ✅ This will trigger re-renders
const restaurants = useRestaurantStore((state) => state.restaurants);
```

### Problem: TypeScript errors
**Solution:** Check the type definitions in `/types/index.ts`

### Problem: API calls failing
**Solution:** Check the network tab, verify:
- Backend is running
- CORS is configured
- Endpoints match the store URLs

---

## 🎓 Learning Resources

### Zustand
- [Official Docs](https://zustand-demo.pmnd.rs/)
- No Context needed!
- Similar to Redux but simpler

### TypeScript
- All stores are fully typed
- Use `Ctrl+Space` for autocomplete

### React Best Practices
- One component per file
- Separate concerns (UI vs Logic)
- Use custom hooks for complex logic

---

## ✅ Checklist for Production

Before deploying:

- [ ] Backend API endpoints are working
- [ ] Image upload is configured
- [ ] MongoDB is set up
- [ ] Environment variables are set
- [ ] Error handling is comprehensive
- [ ] Loading states are shown
- [ ] CORS is configured
- [ ] Authentication is added (if needed)
- [ ] All forms validate input
- [ ] Toast notifications work

---

## 🎉 You're Ready!

You now have:
- ✅ Clean, modular code
- ✅ Type-safe state management
- ✅ Backend integration ready
- ✅ Image upload support
- ✅ Complete documentation

Start building amazing features! 🚀
