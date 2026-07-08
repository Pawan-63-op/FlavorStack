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

router.use(protect);

router.get("/",           getAddresses);
router.post("/",          addAddress);
router.patch("/:id",      updateAddress);
router.delete("/:id",     deleteAddress);
router.patch("/:id/set-default", setDefaultAddress);

export default router;

