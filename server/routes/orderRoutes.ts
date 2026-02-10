// import express from 'express';
// import {
//   // createOrder,
//   // getMyOrders,
//   // getOrderById,
//   // updateOrderStatus,
//   // getAllOrders
//   createOrder,getOrderById,
// } from '../controllers/orderController';
// import { protect, admin } from '../middleware/authMiddleware';

// const router = express.Router();

// router.route('/')
//   .post(protect, createOrder)
//   .get(protect, admin, getAllOrders);

// router.get('/myorders', protect, getMyOrders);

// router.route('/:id')
//   .get(protect, getOrderById)
//   .put(protect, admin, updateOrderStatus);

// export default router;


import express from 'express';
import {
  
  createOrder,getOrderById,getUserOrders,cancelOrder,updateOrderStatus,getOrderByOrderId
} from '../controllers/orderController';
import { protect, admin } from '../middleware/authMiddleware';

const router = express.Router();
// // User routes
router.post('/', protect, createOrder);
router.get('/', protect, getUserOrders);
router.get('/:orderId', protect, getOrderById);
// router.get('/orders/:orderId', protect, getOrderByOrderId);
router.get('/by-order-id/:orderId', getOrderByOrderId);

router.patch('/:orderId/cancel', protect, cancelOrder);

// // Admin/Restaurant routes
router.patch('/:orderId/status', protect, admin, updateOrderStatus);


export default router;
