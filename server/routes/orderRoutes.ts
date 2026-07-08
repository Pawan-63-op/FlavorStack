






import express from 'express';
import {
  
  createOrder,getOrderById,getUserOrders,cancelOrder,updateOrderStatus,getOrderByOrderId
} from '../controllers/orderController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();
router.post('/', protect, createOrder);
router.get('/', protect, getUserOrders);
router.get('/:orderId', protect, getOrderById);
router.get('/by-order-id/:orderId', getOrderByOrderId);

router.patch('/:orderId/cancel', protect, cancelOrder);

router.patch('/:orderId/status', protect, admin, updateOrderStatus);


export default router;
