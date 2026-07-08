import { AuthRequest } from '@/Types/allTypes';
import Recipe from '../models/Recipe';
import { Response } from 'express';

export const getRecipes = async (req:AuthRequest, res:Response) => {
  try {
    const { category, difficulty } = req.query;
    
    let query :any= {};
    if (category) query.category = category;
    if (difficulty) query.difficulty = difficulty;

    const recipes = await Recipe.find(query).sort('-createdAt');
    res.json(recipes);
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const getRecipeById = async (req:AuthRequest, res:Response) => {
  try {
    const recipe = await Recipe.findById(req.params.id)
      .populate('createdBy', 'name');
    
    if (recipe) {
      res.json(recipe);
    } else {
      res.status(404).json({ message: 'Recipe not found' });
    }
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const createRecipe = async (req:AuthRequest, res:Response) => {
  try {
    const recipe = await Recipe.create({
      ...req.body,
      createdBy: req.user?._id
    });
    res.status(201).json(recipe);
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const updateRecipe = async (req:AuthRequest, res:Response) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (recipe) {
      Object.assign(recipe, req.body);
      const updatedRecipe = await recipe.save();
      res.json(updatedRecipe);
    } else {
      res.status(404).json({ message: 'Recipe not found' });
    }
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};

export const deleteRecipe = async (req:AuthRequest, res:Response) => {
  try {
    const recipe = await Recipe.findById(req.params.id);

    if (recipe) {
      await recipe.deleteOne();
      res.json({ message: 'Recipe removed' });
    } else {
      res.status(404).json({ message: 'Recipe not found' });
    }
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
};
