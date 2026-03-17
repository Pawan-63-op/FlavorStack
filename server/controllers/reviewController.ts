import Review from '../models/Review';
import Restaurant from '../models/Restaurant';
import Order from '../models/Order';
import { AuthRequest } from '@/Types/allTypes';
import { Response } from 'express';
// @desc    Create new review
// @route   POST /api/reviews
// @access  Private
export const createReview = async (req:AuthRequest, res:Response) => {
  try {
    const { restaurant, order, rating, comment, photos } = req.body;
console.log(restaurant,order,rating,comment,photos);
    // Check if order exists and belongs to user
    // const orderDoc = await Order.findById(order);
    const orderDoc = await Order.findOne({ orderId: order });

    if (!orderDoc) {
      return res.status(404).json({ message: order});
    }

    if (!orderDoc.user.equals(Object(req.user?._id)  )) {
      console.log("Unauthorized review attempt by user:", req.user?._id,orderDoc.user);
      return res.status(403).json({ message: "Unauthorized review attempt by user:",x: req.user?._id,y:orderDoc.user });
    }

    // if (orderDoc.status !== 'delivered') {
    //   return res.status(400).json({ message: 'Can only review delivered orders' });
    // }

    // Check if already reviewed
    // const existingReview = await Review.findOne({ user: req.user?._id, order });
    const existingReview = await Review.findOne({
  user: req.user?._id,
  orderId: order  // string compare
});

    if (existingReview) {
      return res.status(400).json({ message: 'Order already reviewed' });
    }

    // Create review
    const review = await Review.create({
  user: req.user?._id,
  restaurant,
  order: orderDoc._id,     // ObjectId
  orderId: orderDoc.orderId, // String
  rating,
  comment,
  photos: photos || []
});

    // const review = await Review.create({
    //   user: req.user?._id,
    //   restaurant,
    //   order,
    //   rating,
    //   comment,
    //   photos: photos || []
    // });

    // Update order
    orderDoc.hasReview = true;
    await orderDoc.save();

    // Update restaurant rating
    const reviews = await Review.find({ restaurant });
    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const avgRating = totalRating / reviews.length;

    await Restaurant.findByIdAndUpdate(restaurant, {
      rating: avgRating.toFixed(1),
      totalReviews: reviews.length
    });

    const populatedReview = await Review.findById(review._id)
      .populate('user', 'name avatar')
      .populate('restaurant', 'name');

    res.status(201).json(populatedReview);
  } catch (error:any ) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'You have already reviewed this order' });
    }
    res.status(500).json({ message: error.message || 'Internal Server Error'});
  }
};

// @desc    Get all reviews
// @route   GET /api/reviews
// @access  Public
export const getReviews = async (req:AuthRequest, res:Response) => {
  try {
    const reviews = await Review.find()
      .populate('user', 'name avatar')
      .populate('restaurant', 'name')
      .sort('-createdAt')
      .limit(50);
    res.json(reviews);
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error'});
  }
};

// @desc    Get logged in user reviews
// @route   GET /api/reviews/myreviews
// @access  Private
export const getMyReviews = async (req:AuthRequest, res:Response) => {
  try {
    const reviews = await Review.find({ user: req.user?._id })
      .populate('restaurant', 'restaurantName image cuisine')
      .populate('order', 'orderId createdAt')
      .sort('-createdAt');
    res.status(201).json(reviews);
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error'});
  }
};

// @desc    Get restaurant reviews
// @route   GET /api/reviews/restaurant/:id
// @access  Public
export const getRestaurantReviews = async (req:AuthRequest, res:Response) => {
  try {
    const reviews = await Review.find({ 
      restaurant: req.params.id,
      isApproved: true 
    })
      .populate('user', 'name avatar')
      .sort('-createdAt');
    res.json(reviews);
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error'});
  }
};

// @desc    Delete review
// @route   DELETE /api/reviews/:id
// @access  Private
export const deleteReview = async (req:AuthRequest, res:Response) => {
  try {
    const review = await Review.findById(req.params.id);

    if (review) {
      // Check if user owns the review or is admin
      if (review.user === (req.user?._id) || req.user?.role === 'admin') {
        await review.deleteOne();
        
        // Update restaurant rating
        const reviews = await Review.find({ restaurant: review.restaurant });
        if (reviews.length > 0) {
          const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
          const avgRating = totalRating / reviews.length;
          await Restaurant.findByIdAndUpdate(review.restaurant, {
            rating: avgRating.toFixed(1),
            totalReviews: reviews.length
          });
        } else {
          await Restaurant.findByIdAndUpdate(review.restaurant, {
            rating: 0,
            totalReviews: 0
          });
        }

        res.json({ message: 'Review removed' });
      } else {
        res.status(403).json({ message: 'Not authorized to delete this review' });
      }
    } else {
      res.status(404).json({ message: 'Review not found' });
    }
  } catch (error:any) {
    res.status(500).json({ message: error.message || 'Internal Server Error'});
  }
};
