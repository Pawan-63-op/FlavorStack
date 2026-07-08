import { Response } from "express";
import { AuthRequest } from "@/Types/allTypes";
import Address from "../models/Address";

export const getAddresses = async (req: AuthRequest, res: Response) => {
  try {
    const addresses = await Address.find({ user: req.user?._id }).sort({ isDefault: -1, createdAt: -1 });
    return res.status(200).json({ addresses });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

export const addAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { label, name, phone, address, isDefault } = req.body;

    if (!name || !phone || !address) {
      return res.status(400).json({ message: "Name, phone and address are required" });
    }

    if (isDefault) {
      await Address.updateMany({ user: req.user?._id }, { isDefault: false });
    }

    const count = await Address.countDocuments({ user: req.user?._id });
    const shouldBeDefault = isDefault || count === 0;

    const newAddress = await Address.create({
      user: req.user?._id,
      label: label || "Home",
      name,
      phone,
      address,
      isDefault: shouldBeDefault,
    });

    return res.status(201).json({ address: newAddress, message: "Address saved" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

export const updateAddress = async (req: AuthRequest, res: Response) => {
  try {
    const { label, name, phone, address, isDefault } = req.body;

    if (isDefault) {
      await Address.updateMany({ user: req.user?._id }, { isDefault: false });
    }

    const updated = await Address.findOneAndUpdate(
      { _id: req.params.id, user: req.user?._id },
      { label, name, phone, address, isDefault },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Address not found" });
    }

    return res.status(200).json({ address: updated, message: "Address updated" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

export const deleteAddress = async (req: AuthRequest, res: Response) => {
  try {
    const deleted = await Address.findOneAndDelete({
      _id: req.params.id,
      user: req.user?._id,
    });

    if (!deleted) {
      return res.status(404).json({ message: "Address not found" });
    }

    if (deleted.isDefault) {
      const next = await Address.findOne({ user: req.user?._id }).sort({ createdAt: -1 });
      if (next) {
        next.isDefault = true;
        await next.save();
      }
    }

    return res.status(200).json({ message: "Address deleted" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

export const setDefaultAddress = async (req: AuthRequest, res: Response) => {
  try {
    await Address.updateMany({ user: req.user?._id }, { isDefault: false });

    const updated = await Address.findOneAndUpdate(
      { _id: req.params.id, user: req.user?._id },
      { isDefault: true },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Address not found" });
    }

    return res.status(200).json({ address: updated, message: "Default address updated" });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};
