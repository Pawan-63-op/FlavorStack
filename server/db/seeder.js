const mongoose = require("mongoose");
const dotenv = require("dotenv");

import menuItems  from  "../models/MenuItem";
import restaurant  from "../models/Restaurant";


dotenv.config();

const categories = ["Appetizer", "Main Course", "Dessert", "Beverage", "Side"];

const imageSets = {
  Appetizer: [
    "https://images.unsplash.com/photo-1601050690597-df0568d2da2a",
    "https://images.unsplash.com/photo-1617196034796-73dfa1d32e9a",
    "https://images.unsplash.com/photo-1605478371319-4193b9f6a5b5"
  ],
  "Main Course": [
    "https://images.unsplash.com/photo-1600891963935-05b69f9f3b43",
    "https://images.unsplash.com/photo-1603046891747-84ef30d4b3e1",
    "https://images.unsplash.com/photo-1617196034781-efd5e3c3f9a9"
  ],
  Dessert: [
    "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
    "https://images.unsplash.com/photo-1606312619070-d3267341a7e4",
    "https://images.unsplash.com/photo-1590080875839-99b3fc99c65c"
  ],
  Beverage: [
    "https://images.unsplash.com/photo-1613479675085-01c63761a6be",
    "https://images.unsplash.com/photo-1571075670837-8c58f3e8d87c",
    "https://images.unsplash.com/photo-1542444459-db63bdf6e93e"
  ],
  Side: [
    "https://images.unsplash.com/photo-1625940923095-48cda7a29a93",
    "https://images.unsplash.com/photo-1600690056310-9c8b3b632bc2",
    "https://images.unsplash.com/photo-1612198780709-39d064aa8f62"
  ],
};

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

    // await MenuItem.deleteMany();
    console.log("🧹 Cleared existing menu items");

    const allMenus = [];

    for (const restaurant of restaurants) {
      for (const category of categories) {
        // pick random 2 names and 2 images per category
        const selectedNames = sampleNames[category]
          .sort(() => 0.5 - Math.random())
          .slice(0, 2);
        const selectedImages = imageSets[category]
          .sort(() => 0.5 - Math.random())
          .slice(0, 2);

        selectedNames.forEach((name, idx) => {
          allMenus.push({
            name,
            description: `${name} - Delicious ${category.toLowerCase()} served fresh.`,
            price: (Math.random() * 400 + 100).toFixed(2),
            category,
            isVegetarian: Math.random() > 0.5,
            isSpicy: Math.random() > 0.5,
            isAvailable: true,
            restaurant: restaurant._id,
            calorie: Math.floor(Math.random() * 400 + 150),
            image: selectedImages[idx] || selectedImages[0],
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
