import Favorite from '../models/Favorite';
import { AuthRequest } from '@/Types/allTypes';
import { IFavoriteRestaurant,IFavoriteRecipe } from '@/Types/allTypes';
import mongoose from 'mongoose';
// @desc    Get user favorites
// @route   GET /api/favorites
// @access  Private
import { Response } from 'express';
export const getFavorites = async (req:AuthRequest,res:Response) => {
  try {
    let favorites = await Favorite.findOne({ user: req.user?._id })
      .populate('restaurants.restaurant')
      .populate('recipes.recipe');

    if (!favorites) {
      favorites = await Favorite.create({ user: req.user?._id });
    }

  return   res.status(400). json({favorites});
  } catch (error:any) {
    res.status(500).json({ message: error.message  || "internal server error"});
  }
};

// @desc    Add restaurant to favorites
// @route   POST /api/favorites/restaurant/:id
// @access  Private
export const addRestaurantToFavorites = async (req:AuthRequest,res:Response) => {
  try {
    let favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      favorites = await Favorite.create({ user: req.user?._id });
    }

    // Check if already in favorites
    const alreadyFavorited = favorites.restaurants.some(
  (  r:IFavoriteRestaurant ) => r.restaurant.toString() === req.params.id
    );

    if (alreadyFavorited) {
      return res.status(400).json({ message: 'Restaurant already in favorites' });
    }

  favorites.restaurants.unshift({
  restaurant: new mongoose.Types.ObjectId(req.params.id),
  addedAt: new Date(),
});
    await favorites.save();

    res.json({ message: 'Restaurant added to favorites' });
  } catch (error:any) {
    res.status(500).json({ message: error.message  || "internal server error"});
  }
};

// @desc    Remove restaurant from favorites
// @route   DELETE /api/favorites/restaurant/:id
// @access  Private
export const removeRestaurantFromFavorites = async (req:AuthRequest,res:Response) => {
  try {
    const favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      return res.status(404).json({ message: 'Favorites not found' });
    }

    favorites.restaurants = favorites.restaurants.filter(
    (  r:IFavoriteRestaurant ) => r.restaurant.toString() !== req.params.id
    );

    await favorites.save();
    res.json({ message: 'Restaurant removed from favorites' });
  } catch (error:any) {
    res.status(500).json({ message: error.message  || "internal server error"});
  }
};

// @desc    Add recipe to favorites
// @route   POST /api/favorites/recipe/:id
// @access  Private
export const addRecipeToFavorites = async (req:AuthRequest,res:Response) => {
  try {
    let favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      favorites = await Favorite.create({ user: req.user?._id });
    }

    const alreadyFavorited = favorites.recipes.some(
     (  r:IFavoriteRecipe )  => r.recipe.toString() === req.params.id
    );

    if (alreadyFavorited) {
      return res.status(400).json({ message: 'Recipe already in favorites' });
    }

    // favorites.recipes.unshift({ recipe: req.params.id });
     favorites.recipes.unshift({
  recipe: new mongoose.Types.ObjectId(req.params.id),
  addedAt: new Date(),
});
    await favorites.save();

    res.json({ message: 'Recipe added to favorites' });
  } catch (error:any) {
    res.status(500).json({ message: error.message  || "internal server error"});
  }
};

// @desc    Remove recipe from favorites
// @route   DELETE /api/favorites/recipe/:id
// @access  Private
export const removeRecipeFromFavorites = async (req:AuthRequest,res:Response) => {
  try {
    const favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      return res.status(404).json({ message: 'Favorites not found' });
    }

    favorites.recipes = favorites.recipes.filter(
    (  r:any ) => r.recipe.toString() !== req.params.id
    );

    await favorites.save();
    res.json({ message: 'Recipe removed from favorites' });
  } catch (error:any) {
    res.status(500).json({ message: error.message  || "internal server error"});
  }
};
