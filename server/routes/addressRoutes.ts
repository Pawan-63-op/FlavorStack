import express from "express";
import {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} from "../controllers/addressController";
import { protect } from "../middleware/authMiddleware"; // your existing JWT middleware

const router = express.Router();

// All routes are protected
router.use(protect);

router.get("/",           getAddresses);
router.post("/",          addAddress);
router.patch("/:id",      updateAddress);
router.delete("/:id",     deleteAddress);
router.patch("/:id/set-default", setDefaultAddress);

export default router;

// In your main server file (app.ts / index.ts), add:
// import addressRoutes from "./routes/addressRoutes";
// app.use("/api/addresses", addressRoutes);
