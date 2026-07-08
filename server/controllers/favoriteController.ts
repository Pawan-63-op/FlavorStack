import Favorite from '../models/Favorite';
import { AuthRequest } from '@/Types/allTypes';
import { IFavoriteRestaurant, IFavoriteRecipe } from '@/Types/allTypes';
import mongoose from 'mongoose';
import { Response } from 'express';

export const getFavorites = async (req: AuthRequest, res: Response) => {
  try {
    let favorites = await Favorite.findOne({ user: req.user?._id })
      .populate('restaurants.restaurant')
      .populate('recipes.recipe');

    if (!favorites) {
      favorites = await Favorite.create({ user: req.user?._id });
    }

    return res.status(200).json({ favorites });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "internal server error" });
  }
};

export const addRestaurantToFavorites = async (req: AuthRequest, res: Response) => {
  try {
    let favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      favorites = await Favorite.create({ user: req.user?._id });
    }

    const alreadyFavorited = favorites.restaurants.some(
      (r: IFavoriteRestaurant) => r.restaurant.toString() === req.params.id
    );

    if (alreadyFavorited) {
      return res.status(400).json({ message: 'Restaurant already in favorites' });
    }

    favorites.restaurants.unshift({
      restaurant: new mongoose.Types.ObjectId(req.params.id),
      addedAt: new Date(),
    });

    await favorites.save();
    return res.status(200).json({ message: 'Restaurant added to favorites' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "internal server error" });
  }
};

export const removeRestaurantFromFavorites = async (req: AuthRequest, res: Response) => {
  try {
    const favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      return res.status(404).json({ message: 'Favorites not found' });
    }

    favorites.restaurants = favorites.restaurants.filter(
      (r: IFavoriteRestaurant) => r.restaurant.toString() !== req.params.id
    );

    await favorites.save();
    return res.status(200).json({ message: 'Restaurant removed from favorites' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "internal server error" });
  }
};

export const addRecipeToFavorites = async (req: AuthRequest, res: Response) => {
  try {
    let favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      favorites = await Favorite.create({ user: req.user?._id });
    }

    const alreadyFavorited = favorites.recipes.some(
      (r: IFavoriteRecipe) => r.recipe.toString() === req.params.id
    );

    if (alreadyFavorited) {
      return res.status(400).json({ message: 'Recipe already in favorites' });
    }

    favorites.recipes.unshift({
      recipe: new mongoose.Types.ObjectId(req.params.id),
      addedAt: new Date(),
    });

    await favorites.save();
    return res.status(200).json({ message: 'Recipe added to favorites' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "internal server error" });
  }
};

export const removeRecipeFromFavorites = async (req: AuthRequest, res: Response) => {
  try {
    const favorites = await Favorite.findOne({ user: req.user?._id });

    if (!favorites) {
      return res.status(404).json({ message: 'Favorites not found' });
    }

    favorites.recipes = favorites.recipes.filter(
      (r: any) => r.recipe.toString() !== req.params.id
    );

    await favorites.save();
    return res.status(200).json({ message: 'Recipe removed from favorites' });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "internal server error" });
  }
};
