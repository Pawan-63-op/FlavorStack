import mongoose, { Schema } from 'mongoose';
import { IRecipe } from "@/Types/allTypes";

const recipeSchema = new Schema<IRecipe>({
  name: {
    type: String,
    required: [true, 'Please add a recipe name'],
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c'
  },
  cookTime: {
    type: String,
    required: true
  },
  servings: {
    type: Number,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['Easy', 'Medium', 'Hard'],
    required: true
  },
  category: {
    type: String,
    required: true
  },
  calories: {
    type: Number
  },
  ingredients: [{
    type: String,
    required: true
  }],
  instructions: [{
    type: String,
    required: true
  }],
  tips: {
    type: String
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

const Recipe = mongoose.model<IRecipe>('Recipe', recipeSchema);

export default Recipe;
