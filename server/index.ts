import express, { Express } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import connectDB from './db/connectDB';
import bodyParser from "body-parser";
// import cookieParser from "cookie-parser";
// Load env vars
dotenv.config();

// Connect to database
connectDB();


const app = express();

// const PORT = process.env.PORT || 3000;

//  const DIRNAME = path.resolve();

//   default middleware for any mern project
app.use(express.json());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
//  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
 app.use(express.json());
 app.use(cookieParser());
 const corsOptions = {
     origin: "http://localhost:3000",
     credentials: true
 }
 app.use(cors(corsOptions));


// Routes
// import userRoutes from "@/"
import authRoutes from "@/routes/authRoutes";
import userRoutes from "@/routes/userRoutes";
import restaurantRoutes from "@/routes/restaurantRoutes";
import menuRoutes from "@/routes/menuRoutes";
// import order
import orderRoutes from "@/routes/orderRoutes";
import reviewRoutes from "@/routes/reviewRoutes";
import couponRoutes from "@/routes/couponRoutes";
import favoriteRoutes from "@/routes/favoriteRoutes";
import loyaltyRoutes from "@/routes/loyaltyRoutes";
import recipeRoutes from "@/routes/recipeRoutes";
import uploadRoutes from "@/routes/uploadRoutes";
import addressRoutes from "./routes/addressRoutes";

app.use("/api/addresses", addressRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/loyalty', loyaltyRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handler
// app.use(errorHandler);

const PORT = process.env.PORT || 5000;

import { createServer } from "http";
// import { initSocket, chatRouter } from "./socket"; // adjust path
import { initSocket } from './socket';
import { chatRouter } from './routes/ChatRoutes';
// Register chat REST routes
app.use("/api/chat", chatRouter);

// Create HTTP server and attach Socket.io
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
