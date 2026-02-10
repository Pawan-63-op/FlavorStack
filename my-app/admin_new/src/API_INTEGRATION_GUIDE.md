# API Integration Guide

This guide shows how to integrate the admin dashboard with your MongoDB backend.

## Quick Start

1. **Set up your backend** with the API endpoints listed below
2. **Update axios base URL** if needed (currently defaults to `/api`)
3. **Uncomment the initialization hook** in `App.tsx`
4. **Test each endpoint** using the admin dashboard

## Required API Endpoints

### Restaurants

#### GET /api/restaurants
Fetch all restaurants
```json
Response: [
  {
    "id": 1,
    "name": "Restaurant Name",
    "cuisine": "Italian",
    "city": "New York",
    "country": "USA",
    "rating": 4.5,
    "deliveryTime": "25-35 min",
    "priceRange": "$$",
    "isOpen": true,
    "imageUrl": "https://..."
  }
]
```

#### POST /api/restaurants
Create a new restaurant
```json
Request: {
  "name": "New Restaurant",
  "cuisine": "Italian",
  "city": "New York",
  "country": "USA",
  "rating": 4.5,
  "deliveryTime": "25-35 min",
  "priceRange": "$$",
  "isOpen": true,
  "imageUrl": "https://..."
}

Response: { ...restaurant object with id }
```

#### PATCH /api/restaurants/:id
Update a restaurant
```json
Request: {
  "name": "Updated Name",
  // ... any fields to update
}

Response: { ...updated restaurant object }
```

#### DELETE /api/restaurants/:id
Delete a restaurant
```json
Response: { success: true }
```

---

### Menu Items

#### GET /api/menu
Fetch all menu items (optional: filter by restaurantId)
```json
Query params: ?restaurantId=1

Response: [
  {
    "id": "item-1",
    "restaurantId": 1,
    "name": "Pizza",
    "description": "Delicious pizza",
    "price": 15.99,
    "category": "Main",
    "isVegetarian": true,
    "calories": 500,
    "imageUrl": "https://..."
  }
]
```

#### POST /api/menu
Create a new menu item
```json
Request: {
  "restaurantId": 1,
  "name": "Pizza",
  "description": "Delicious pizza",
  "price": 15.99,
  "category": "Main",
  "isVegetarian": true,
  "calories": 500,
  "imageUrl": "https://..."
}

Response: { ...menu item with id }
```

#### PATCH /api/menu/:id
Update a menu item
```json
Request: {
  "price": 17.99,
  // ... any fields to update
}

Response: { ...updated menu item }
```

#### DELETE /api/menu/:id
Delete a menu item
```json
Response: { success: true }
```

---

### Orders

#### GET /api/orders
Fetch all orders
```json
Response: [
  {
    "id": "order-1",
    "restaurantName": "Restaurant Name",
    "items": [
      {
        "id": "item-1",
        "name": "Pizza",
        "price": 15.99,
        "quantity": 2
      }
    ],
    "total": 31.98,
    "status": "pending",
    "date": "2025-10-22",
    "userId": "user-1",
    "deliveryAddress": "123 Main St"
  }
]
```

#### POST /api/orders
Create a new order
```json
Request: {
  "restaurantName": "Restaurant Name",
  "items": [
    {
      "id": "item-1",
      "name": "Pizza",
      "price": 15.99,
      "quantity": 2
    }
  ],
  "total": 31.98,
  "status": "pending",
  "date": "2025-10-22",
  "userId": "user-1",
  "deliveryAddress": "123 Main St"
}

Response: { ...order with id }
```

#### PATCH /api/orders/:id
Update order status
```json
Request: {
  "status": "confirmed"
}

Response: { ...updated order }
```

---

### Coupons

#### GET /api/coupons
Fetch all coupons
```json
Response: [
  {
    "id": "coupon-1",
    "code": "SAVE20",
    "discount": 20,
    "type": "percentage",
    "description": "20% off all orders",
    "minOrder": 25,
    "maxDiscount": 50,
    "isActive": true,
    "expiresAt": "2025-12-31"
  }
]
```

#### POST /api/coupons
Create a new coupon
```json
Request: {
  "code": "SAVE20",
  "discount": 20,
  "type": "percentage",
  "description": "20% off all orders",
  "minOrder": 25,
  "maxDiscount": 50,
  "isActive": true,
  "expiresAt": "2025-12-31"
}

Response: { ...coupon with id }
```

#### PATCH /api/coupons/:id
Update a coupon
```json
Request: {
  "isActive": false,
  // ... any fields to update
}

Response: { ...updated coupon }
```

#### DELETE /api/coupons/:id
Delete a coupon
```json
Response: { success: true }
```

---

## Image Upload

For image uploads, you'll need an additional endpoint:

#### POST /api/upload
Upload an image file
```javascript
// Frontend example
const formData = new FormData();
formData.append('image', file);

const response = await axios.post('/api/upload', formData, {
  headers: {
    'Content-Type': 'multipart/form-data',
  },
});

// Response
{
  "url": "https://your-cdn.com/image.jpg"
}
```

### Backend Image Upload Example (Node.js + Express + Multer)

```javascript
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary (or your preferred storage)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({ dest: 'uploads/' });

app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(req.file.path);
    res.json({ url: result.secure_url });
  } catch (error) {
    res.status(500).json({ error: 'Upload failed' });
  }
});
```

---

## MongoDB Schema Examples

### Restaurant Model
```javascript
const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cuisine: { type: String, required: true },
  city: { type: String, required: true },
  country: { type: String, required: true },
  rating: { type: Number, min: 0, max: 5, default: 4.5 },
  deliveryTime: { type: String, default: '25-35 min' },
  priceRange: { type: String, enum: ['$', '$$', '$$$'], default: '$$' },
  isOpen: { type: Boolean, default: true },
  imageUrl: String,
}, { timestamps: true });

module.exports = mongoose.model('Restaurant', restaurantSchema);
```

### Menu Item Model
```javascript
const menuItemSchema = new mongoose.Schema({
  restaurantId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Restaurant', 
    required: true 
  },
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  category: String,
  isVegetarian: { type: Boolean, default: false },
  calories: Number,
  imageUrl: String,
}, { timestamps: true });

module.exports = mongoose.model('MenuItem', menuItemSchema);
```

### Order Model
```javascript
const orderSchema = new mongoose.Schema({
  restaurantName: String,
  items: [{
    id: String,
    name: String,
    price: Number,
    quantity: Number,
  }],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'delivered', 'cancelled'],
    default: 'pending'
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  deliveryAddress: String,
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
```

### Coupon Model
```javascript
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true, uppercase: true },
  discount: { type: Number, required: true, min: 0 },
  type: { 
    type: String, 
    enum: ['percentage', 'fixed', 'shipping'], 
    required: true 
  },
  description: { type: String, required: true },
  minOrder: Number,
  maxDiscount: Number,
  isActive: { type: Boolean, default: true },
  expiresAt: Date,
}, { timestamps: true });

module.exports = mongoose.model('Coupon', couponSchema);
```

---

## Express.js Route Examples

### Restaurant Routes
```javascript
const express = require('express');
const router = express.Router();
const Restaurant = require('../models/Restaurant');

// GET all restaurants
router.get('/restaurants', async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create restaurant
router.post('/restaurants', async (req, res) => {
  try {
    const restaurant = new Restaurant(req.body);
    await restaurant.save();
    res.status(201).json(restaurant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PATCH update restaurant
router.patch('/restaurants/:id', async (req, res) => {
  try {
    const restaurant = await Restaurant.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    res.json(restaurant);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// DELETE restaurant
router.delete('/restaurants/:id', async (req, res) => {
  try {
    await Restaurant.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
```

---

## Error Handling

All stores include error handling. When an API call fails:

```typescript
// The error will be stored in the store
const error = useRestaurantStore((state) => state.error);

// You can display it to the user
if (error) {
  toast.error(error);
}

// Or handle it in the component
try {
  await addRestaurant(data);
  toast.success("Restaurant added!");
} catch (error) {
  toast.error("Failed to add restaurant");
}
```

---

## Testing with Mock Data

Before connecting to your backend, you can test with mock data:

```typescript
// In your store file, temporarily replace API calls with mock data
fetchRestaurants: async () => {
  set({ isLoading: true, error: null });
  
  // Mock data
  const mockData = [
    { id: 1, name: "Test Restaurant", cuisine: "Italian", ... },
  ];
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  set({ restaurants: mockData, isLoading: false });
},
```

---

## CORS Configuration

Make sure your backend allows CORS requests:

```javascript
// Express.js example
const cors = require('cors');

app.use(cors({
  origin: 'http://localhost:5173', // Your frontend URL
  credentials: true,
}));
```

---

## Environment Variables

Create a `.env` file for your backend:

```
MONGODB_URI=mongodb://localhost:27017/food-delivery
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
PORT=3000
```

And for the frontend (if needed):

```
VITE_API_URL=http://localhost:3000/api
```

Then update your stores to use the environment variable:

```typescript
const API_URL = import.meta.env.VITE_API_URL || '/api';
axios.get(`${API_URL}/restaurants`)
```
