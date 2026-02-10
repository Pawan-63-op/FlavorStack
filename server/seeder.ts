import dotenv from "dotenv";
import mongoose from "mongoose";
import menuItems from "../models/MenuItem.js";
import restaurant from "../models/Restaurant.js";

dotenv.config();

const categories = ["Appetizer", "Main Course", "Dessert", "Beverage", "Side"];

// 24 Working Dish Images (Unsplash RAW links)
const images = [
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&w=800",
  "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&w=800",
  "https://images.unsplash.com/photo-1543779501-0a1012a37f36?auto=format&w=800",
  "https://images.unsplash.com/photo-1509474520651-529cef1dbdee?auto=format&w=800",
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&w=800",
  "https://images.unsplash.com/photo-1555992336-03a23c3b935a?auto=format&w=800",
  "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&w=800",
  "https://images.unsplash.com/photo-1543353071-873f17a7a088?auto=format&w=800",
  "https://images.unsplash.com/photo-1525755662778-989d0524087e?auto=format&w=800",
  "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&w=800",
  "https://images.unsplash.com/photo-1600891964599-f61ba0e24092?auto=format&w=800",
  "https://images.unsplash.com/photo-1606756790138-261e456cd4a5?auto=format&w=800",
  "https://images.unsplash.com/photo-1589308078054-8326f0e34a5d?auto=format&w=800",
  "https://images.unsplash.com/photo-1506354666786-959d6d497f1a?auto=format&w=800",
  "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&w=800",
  "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&w=800",
  "https://images.unsplash.com/photo-1540183831531-4524e8c7af85?auto=format&w=800",
  "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&w=800",
  "https://images.unsplash.com/photo-1604908177148-c4b0f391f85d?auto=format&w=800",
  "https://images.unsplash.com/photo-1580656519531-5c7aaaf9c1ce?auto=format&w=800",
  "https://images.unsplash.com/photo-1473091534298-04dcbce3278c?auto=format&w=800",
  "https://images.unsplash.com/photo-1617196034781-efd5e3c3f9a9?auto=format&w=800",
  "https://images.unsplash.com/photo-1546069901-5a74ed0c87c7?auto=format&w=800",
  "https://images.unsplash.com/photo-1564750029119-20f86f8d3169?auto=format&w=800",
];

const sampleNames = {
  Appetizer: ["Bruschetta", "Garlic Bread", "Spring Rolls", "Stuffed Mushrooms"],
  "Main Course": ["Grilled Chicken", "Paneer Butter Masala", "Beef Steak", "Veg Lasagna"],
  Dessert: ["Chocolate Cake", "Ice Cream Sundae", "Cheesecake", "Tiramisu"],
  Beverage: ["Lemonade", "Cold Coffee", "Mojito", "Mango Smoothie"],
  Side: ["French Fries", "Mashed Potatoes", "Steamed Vegetables", "Onion Rings"]
};

const seedMenus = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const restaurants = await restaurant.find();
    if (restaurants.length === 0) {
      console.log("⚠️ No restaurants found. Add some restaurants first!");
      process.exit(0);
    }

    // await menuItems.deleteMany();
    console.log("🧹 Cleared existing menu items");

    const allMenus = [];

    for (const r of restaurants) {
      for (const category of categories) {
        
        // randomize names
        const selectedNames = sampleNames[category]
          .sort(() => Math.random() - 0.5)
          .slice(0, 2);

        // pick 2 completely random images for each item
        const selectedImages = Array.from({ length: 2 }, () =>
          images[Math.floor(Math.random() * images.length)]
        );

        selectedNames.forEach((name, idx) => {
          allMenus.push({
            name,
            description: `${name} - Delicious ${category.toLowerCase()} served fresh.`,
            price: (Math.random() * 400 + 100).toFixed(2),
            category,
            isVegetarian: Math.random() > 0.5,
            isSpicy: Math.random() > 0.5,
            isAvailable: true,
            restaurant: r._id,
            calorie: Math.floor(Math.random() * 400 + 150),
            image: selectedImages[idx],
          });
        });
      }
    }

    await menuItems.insertMany(allMenus);
    console.log(`🍽️ Inserted ${allMenus.length} menu items successfully`);
    process.exit(0);

  } catch (error) {
    console.error("❌ Error seeding menus:", error);
    process.exit(1);
  }
};

seedMenus();
