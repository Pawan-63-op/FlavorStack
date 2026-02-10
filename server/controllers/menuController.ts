
import { Request, Response } from 'express';
import MenuItem from '../models/MenuItem';
import { AuthRequest } from '@/Types/allTypes';
import Restaurant from "../models/Restaurant";
import mongoose from 'mongoose';
import uploadImageOnCloudinary from '@/utils_original/imageUpload';
import { getRestaurantById } from './restaurantController';

// @desc    Get menu items (optionally by restaurant or category)
// @route   GET /api/menu?restaurant=id&category=category
// @access  Public
export const getMenuItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const { restaurant, category } = req.query;
    
    let query: any = {};
    if (restaurant) query.restaurant = restaurant;
    if (category) query.category = category;
    
    const menuItems = await MenuItem.find(query)
      .populate('restaurant', 'restaurantName city country imageUrl')
      .sort({ createdAt: -1 });
    
    res.status(201).json({ menuItems });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Get menu item by ID
// @route   GET /api/menu/:id
// @access  Public
export const getMenuItemById = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.id)
      .populate('restaurant', 'restaurantName city country imageUrl');
    
    if (menuItem) {
      res.json({ menuItem });
    } else {
      res.status(404).json({ message: 'Menu item not found' });
    }
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Create menu item
// @route   POST /api/menu
// @access  Private/Admin
export const createMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { 
      name, 
      description, 
      price, 
      category, 
      isVegetarian, 
      isSpicy, 
      isAvailable, 
      restaurant
    } = req.body;

    // Validate required fields
    if (!name || !description || !restaurant || !price || !category) {
      res.status(400).json({ 
        message: 'Name, description, restaurant, price, and category are required' 
      });
      return;
    }

    // Validate category enum
    const validCategories = ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Side'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ 
        message: `Category must be one of: ${validCategories.join(', ')}` 
      });
      return;
    }

    // Extract restaurant ID (in case it's an object)
    const restaurantId = typeof restaurant === 'object' && restaurant?._id
      ? restaurant._id
      : restaurant;

    // Validate restaurant exists
    const restaurantDoc = await Restaurant.findById(restaurantId);
    if (!restaurantDoc) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    // Handle image upload
    let image = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'; // Default image
    if (req.file) {
      const uploadedImage = await uploadImageOnCloudinary(req.file as Express.Multer.File);
      image = uploadedImage;
    }

    // Create menu item
    const menuItem = await MenuItem.create({
      name,
      description,
      price: parseFloat(price),
      category,
      isVegetarian: isVegetarian === 'true',
      isSpicy: isSpicy === 'true',
      isAvailable: isAvailable === 'true' || isAvailable === undefined,
      restaurant: restaurantId,
      image,
    });

    // Add menu item to restaurant's menus array
    restaurantDoc.menus.push(menuItem._id as any);
    await restaurantDoc.save();

    // Populate and return the created menu item
    const populatedMenuItem = await MenuItem.findById(menuItem._id)
      .populate('restaurant', 'restaurantName city country');

    res.status(201).json({
      success: true,
      message: 'Menu item created successfully',
      menuItem: populatedMenuItem,
      restaurant:restaurantId,
      
    });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Update menu item
// @route   PATCH /api/menu/:id
// @access  Private/Admin
export const updateMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    // Handle image upload if new image is provided
    let image = menuItem.image;
    if (req.file) {
      const uploadedImage = await uploadImageOnCloudinary(req.file as Express.Multer.File);
      image = uploadedImage;
    }

    // Update fields
    const { 
      name, 
      description, 
      price, 
      category, 
      isVegetarian, 
      isSpicy, 
      isAvailable, 
      restaurant 
    } = req.body;

    // Validate category if provided
    if (category) {
      const validCategories = ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Side'];
      if (!validCategories.includes(category)) {
        res.status(400).json({ 
          message: `Category must be one of: ${validCategories.join(', ')}` 
        });
        return;
      }
    }
    // const pre= menuItem.restaurant;
    // find rsbyid(pre) then remove this menu._id from its menus 
     const previousRestaurantId = menuItem.restaurant?.toString();
    if (restaurant && restaurant !== previousRestaurantId) {
      // Remove this menu item from the previous restaurant
      if (previousRestaurantId) {
        await Restaurant.findByIdAndUpdate(previousRestaurantId, {
          $pull: { menus: menuItem._id },
        });
      }
    }
    const newRestaurant = await Restaurant.findById(restaurant);
      if (!newRestaurant) {
        res.status(400).json({ message: "New restaurant not found" });
        return;
      }
      await Restaurant.findByIdAndUpdate(restaurant, {
        $addToSet: { menus: menuItem._id },
      });

      // Update the restaurant reference in the menu item
      menuItem.restaurant = restaurant;
    
    if (name) menuItem.name = name;
    if (description !== undefined) menuItem.description = description;
    if (price) menuItem.price = parseFloat(price);
    if (category) menuItem.category = category;
    if (isVegetarian !== undefined) menuItem.isVegetarian = isVegetarian === 'true';
    if (isSpicy !== undefined) menuItem.isSpicy = isSpicy === 'true';
    if (isAvailable !== undefined) menuItem.isAvailable = isAvailable === 'true';
    if (restaurant) menuItem.restaurant = restaurant;
    if (image) menuItem.image = image;
// and thend find resbudid(restaurnt) and add this menu._id it is menu where menu is array of [object.sechem]
    const updatedMenuItem = await menuItem.save();
    const populatedMenuItem = await MenuItem.findById(updatedMenuItem._id)
      .populate('restaurant', 'restaurantName city country');

    res.json({
      success: true,
      message: 'Menu item updated successfully',
      menuItem: populatedMenuItem,
    });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ message: (error as Error).message });
  }
};

// @desc    Delete menu item
// @route   DELETE /api/menu/:id
// @access  Private/Admin
export const deleteMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    // Remove menu item from restaurant's menus array
    const restaurantDoc = await Restaurant.findById(menuItem.restaurant);
    if (restaurantDoc) {
      restaurantDoc.menus = restaurantDoc.menus.filter(
        (menuId: any) => menuId.toString() !== menuItem._id?.toString()
      );
      await restaurantDoc.save();
    }

    // Delete the menu item
    await menuItem.deleteOne();
    
    res.json({ 
      success: true,
      message: 'Menu item removed' 
    });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ message: (error as Error).message });
  }
}