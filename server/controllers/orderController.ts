import { IUser } from '@/Types/allTypes';
import Order from '../models/Order';
import User from '../models/User';
import LoyaltyTransaction from '../models/LoyaltyTransaction';
import { sendEmail } from '../config/email';
import { Response } from 'express';
import { AuthRequest } from '@/Types/allTypes';
export const createOrder = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id; // Assuming you have auth middleware
    console.log("Creating order for user:", userId);
    const {
      restaurant,
      restaurantName,
      items,
      subtotal,
      deliveryFee,
      tax,
      discount,
      total,
      couponApplied,
      deliveryAddress,
      paymentMethod,
      pointsEarned
    } = req.body;

    if (!restaurant || !restaurantName || !items || items.length === 0) {
      console.log(restaurant,restaurantName,items,items.length);
      return res.status(400).json({
        success: false,
        message: 'Missing required 1order information'
      });
    }

    if (!deliveryAddress || !deliveryAddress.name || !deliveryAddress.phone || !deliveryAddress.address) {
      return res.status(400).json({
        success: false,
        message: 'Complete delivery address is required'
      });
    }

    const order = await Order.create({
      user: userId,
      restaurant,
      restaurantName,
      items,
      subtotal,
      deliveryFee: deliveryFee || 2.99,
      tax,
      discount: discount || 0,
      total,
      couponApplied,
      deliveryAddress,
      paymentMethod: paymentMethod || 'card',
      status: 'pending',
      pointsEarned: pointsEarned || 0,
      hasReview: false,
      orderId: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    });
    

    if (pointsEarned && pointsEarned > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { loyaltyPoints: pointsEarned }
      });
    }

    await LoyaltyTransaction.create({
      user: req.user?._id,
      type: 'earned',
      points: pointsEarned,
      description: `Order #${order.orderId}`,
      order: order._id,
      date: new Date(),
    });
    const populatedOrder = await Order.findById(order._id)
      .populate('restaurant', 'name image')
      .populate('user', 'name email');

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      order: populatedOrder
    });
  } catch (error: any) {
    console.error('Create order error:', 123456);
    res.status(500).json({
      success: false,
    
     message: error.message || 'Failed to create order'
    });
  }
};

export const getUserOrders = async (req:  AuthRequest, res: Response) => {
  try {
    const userId = req.user?._id;

    const orders = await Order.find({ user: userId })
      .populate('restaurant', 'name image')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders
    });
  } catch (error: any) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch orders'
    });
  }
};

export const getOrderById = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?._id;

    const order = await Order.findOne({ 
      _id: orderId, 
      user: userId 
    })
      .populate('restaurant', 'name image address phone')
      .populate('items.menuItem', 'name image');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.status(200).json({
      success: true,
      order
    });
  } catch (error: any) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order'
    });
  }
};

export const getOrderByOrderId = async (req:AuthRequest, res:Response) => {
  try {
    const { orderId } = req.params;
    console.log("Fetching getorderByorderId:", orderId);
const order = await Order.findOne({ orderId:orderId })

      .populate("restaurant")
      .populate("user", "name email");

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


export const updateOrderStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    const validStatuses = ['pending', 'confirmed', 'preparing', 'out-for-delivery', 'Delivered', 'cancelled'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });
    }

    const order=await Order.findOne({orderId:orderId});

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }


    order.status = status;
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Order status updated successfully',
      order
    });
  } catch (error: any) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update order status'
    });
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response) => {
  try {
    const { orderId } = req.params;
    const userId = req.user?._id;

    const order = await Order.findOne({ 
      _id: orderId, 
      user: userId 
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel order at this stage'
      });
    }

    order.status = 'cancelled';
    await order.save();

    if (order.pointsEarned > 0) {
      await User.findByIdAndUpdate(userId, {
        $inc: { loyaltyPoints: -order.pointsEarned }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
  } catch (error: any) {
    console.error('Cancel order error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to cancel order'
    });
  }
};

export const getRestaurantOrders = async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId } = req.params;
    const { status } = req.query;

    let query: any = { restaurant: restaurantId };
    
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .populate('user', 'name email phone')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      orders
    });
  } catch (error: any) {
    console.error('Get restaurant orders error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch restaurant orders'
    });
  }
};

export const getOrderStats = async (req: AuthRequest, res: Response) => {
  try {
    const { restaurantId } = req.params;

    const stats = await Order.aggregate([
      { $match: { restaurant: restaurantId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total' }
        }
      }
    ]);

    const totalOrders = await Order.countDocuments({ restaurant: restaurantId });
    const totalRevenue = await Order.aggregate([
      { $match: { restaurant: restaurantId, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalOrders,
        totalRevenue: totalRevenue[0]?.total || 0,
        statusBreakdown: stats
      }
    });
  } catch (error: any) {
    console.error('Get order stats error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch order statistics'
    });
  }
};