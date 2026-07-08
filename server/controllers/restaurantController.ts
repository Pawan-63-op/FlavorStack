import { Request, Response } from 'express';
import Restaurant from '../models/Restaurant';
import { AuthRequest } from '@/Types/allTypes';
import uploadImageOnCloudinary from '@/utils_original/imageUpload';
import MenuItem from '@/models/MenuItem';
import { object } from 'zod';
import { Types } from 'mongoose';
export const getRestaurants = async (req: Request, res: Response) => {
  try {
    const { cuisine, city, priceRange } = req.query;
    
    let query: any = {};
    if (cuisine) query.cuisine = cuisine;
    if (city) query.city = new RegExp(city as string, 'i');
    if (priceRange) query.priceRange = priceRange;

    const restaurants = await Restaurant.find(query).sort('-createdAt').populate('menus');
     if (!restaurants) {
            return  res.status(404).json({
                success: false,
                restaurant:[],
                message: "Restaurant  not found",
               
            })
        };
    return res.status(201).json({restaurants});
  } catch (error) {
  return   res.status(500).json({ message: (error as Error).message });
  }
};

export const getRestaurantById = async (req: Request, res: Response) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);
    
    if (restaurant) {
    return   res.status(201).json({ success:true , restaurant});
    } else {
   return    res.status(500).json({ message: 'Restaurant not found' });
    }
  } catch (error) {
    res.status(500).json({ message: "internal server error" });
  }
};



export const getRestaurantMenu = async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);

    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    const menuData = restaurant.menus;
    
    const formattedItems: any[] = await Promise.all(
      menuData.map(async (current: any) => {
        const objectId = new Types.ObjectId(current);
        const item = await MenuItem.findById(objectId);
        
        if (!item) {
          return null;
        }
        
        return {
          id: item._id?.toString() || item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          image: item.image,
          category: item.category,
          isVegetarian: item.isVegetarian || false,
          isSpicy: item.isSpicy || false,
          calories: item.calorie || 0
          
        };
      })
    );

    const validMenus = formattedItems.filter(item => item !== null);

    return res.status(200).json({
      success: true,
      restaurant: restaurant.restaurantName,
      totalMenus: validMenus.length,
      menus: validMenus,
      link:restaurant.imageUrl,
    });
  } catch (error) {
    console.error("Error fetching menus:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
export const createRestaurant = async (req: AuthRequest, res: Response) => {
  try {
    const restaurant = await Restaurant.findOne({ user: req.user });
    const {name}= req.body;
    const file= req.file;
        if (restaurant) {
            return res.status(400).json({
                success: false,
                message: "Restaurant already exist for this user"
            })
        }
           if (!file) {
            return res.status(400).json({
                success: false,
                message: "Image is required"
            })
        }
          const imageUrl = await uploadImageOnCloudinary(file as Express.Multer.File);
     await Restaurant.create({
      ...req.body,
      imageUrl,
      id:99,
      owner: req.user?._id
    });
    return res.status(201).json({
            success: true,
            message: "Restaurant Added"
        });
  } catch (error) {
    return res.status(500).json({ message: error})
  }
};

export const updatedRestaurant = async (req: AuthRequest, res: Response) => {
  try {
     const restaurant = await Restaurant.findOne({
      _id: req.params.id,
      owner: req.user?._id, // make sure your model uses `owner` or `user`
    });
      const file = req.file;
   if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: "Restaurant not found"
            })
        };
    for (const key in req.body) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        (restaurant as any)[key] = req.body[key];
      }
    }
   if (file) {
            const imageUrl = await uploadImageOnCloudinary(file as Express.Multer.File);
            restaurant.imageUrl = imageUrl;
        }
    const updatedRestaurant = await restaurant.save();
    return res.status(200).json({
            success: true,
            message: "Restaurant updated",
            updatedRestaurant
        })

  } catch (error) {

   return res.status(500).json({ message:req.params.id,
    x: req.user?._id
     })
  }
};


export const deleteRestaurant = async (req: AuthRequest, res: Response) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (restaurant) {
      await restaurant.deleteOne();
   return    res.status(201).json({ message: 'Restaurant removed' });
    } else {
 return     res.status(404).json({ message: 'Restaurant not found' });
    }
  } catch (error) {
return     res.status(500).json({message: "Internal Server Error"});
  }
};

export const searchRestaurants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, type } = req.query;

    if (!query || typeof query !== "string" || query.trim() === "") {
      res.status(400).json({ message: "Please provide a valid search query" });
      return;
    }

    if (!type || typeof type !== "string") {
      res.status(400).json({ message: "Please specify a search type (name, city, country, cuisine)" });
      return;
    }

    const cleaned = query.replace(/\s+/g, "").toLowerCase();

    const fuzzyPattern = cleaned.split("").join(".*");
    const regex = new RegExp(fuzzyPattern, "i");

    const allowedTypes = ["name", "city", "country", "cuisine"];
    if (!allowedTypes.includes(type)) {
      res.status(400).json({ message: `Invalid type '${type}'. Must be one of: ${allowedTypes.join(", ")}` });
      return;
    }

    const searchCondition: any = {};
    searchCondition[type] = regex;

    const restaurants = await Restaurant.find(searchCondition);

    if (restaurants.length === 0) {
      res.status(404).json({ message: "No matching restaurants found" });
      return;
    }

    res.status(200).json({
      count: restaurants.length,
      results: restaurants,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: (error as Error).message });
  }
};
