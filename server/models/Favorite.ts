import mongoose, { Schema } from 'mongoose';
import { IFavorite } from "@/Types/allTypes";

const favoriteSchema = new Schema<IFavorite>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurants: [{
    restaurant: {
      type: Schema.Types.ObjectId,
      ref: 'Restaurant'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  recipes: [{
    recipe: {
      type: Schema.Types.ObjectId,
      ref: 'Recipe'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

favoriteSchema.index({ user: 1 }, { unique: true });

const Favorite = mongoose.model<IFavorite>('Favorite', favoriteSchema);

export default Favorite;
