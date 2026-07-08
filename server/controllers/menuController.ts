
import { Request, Response } from 'express';
import MenuItem from '../models/MenuItem';
import { AuthRequest } from '@/Types/allTypes';
import Restaurant from "../models/Restaurant";
import mongoose from 'mongoose';
import uploadImageOnCloudinary from '@/utils_original/imageUpload';
import { getRestaurantById } from './restaurantController';

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

    if (!name || !description || !restaurant || !price || !category) {
      res.status(400).json({ 
        message: 'Name, description, restaurant, price, and category are required' 
      });
      return;
    }

    const validCategories = ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Side'];
    if (!validCategories.includes(category)) {
      res.status(400).json({ 
        message: `Category must be one of: ${validCategories.join(', ')}` 
      });
      return;
    }

    const restaurantId = typeof restaurant === 'object' && restaurant?._id
      ? restaurant._id
      : restaurant;

    const restaurantDoc = await Restaurant.findById(restaurantId);
    if (!restaurantDoc) {
      res.status(404).json({ message: "Restaurant not found" });
      return;
    }

    let image = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'; // Default image
    if (req.file) {
      const uploadedImage = await uploadImageOnCloudinary(req.file as Express.Multer.File);
      image = uploadedImage;
    }

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

    restaurantDoc.menus.push(menuItem._id as any);
    await restaurantDoc.save();

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

export const updateMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    let image = menuItem.image;
    if (req.file) {
      const uploadedImage = await uploadImageOnCloudinary(req.file as Express.Multer.File);
      image = uploadedImage;
    }

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

    if (category) {
      const validCategories = ['Appetizer', 'Main Course', 'Dessert', 'Beverage', 'Side'];
      if (!validCategories.includes(category)) {
        res.status(400).json({ 
          message: `Category must be one of: ${validCategories.join(', ')}` 
        });
        return;
      }
    }
     const previousRestaurantId = menuItem.restaurant?.toString();
    if (restaurant && restaurant !== previousRestaurantId) {
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

export const deleteMenuItem = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const menuItem = await MenuItem.findById(req.params.id);
    
    if (!menuItem) {
      res.status(404).json({ message: 'Menu item not found' });
      return;
    }

    const restaurantDoc = await Restaurant.findById(menuItem.restaurant);
    if (restaurantDoc) {
      restaurantDoc.menus = restaurantDoc.menus.filter(
        (menuId: any) => menuId.toString() !== menuItem._id?.toString()
      );
      await restaurantDoc.save();
    }

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