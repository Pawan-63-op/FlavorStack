import express from "express";
import { protect, admin } from "../middleware/authMiddleware";
import { Conversation,Message } from "@/models/Message";
export const chatRouter = express.Router();
chatRouter.get("/conversations", protect, admin, async (req, res) => {
  try {
    const convos = await Conversation.find()
      .sort({ lastMessageAt: -1 });
    res.json({ conversations: convos });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

chatRouter.get("/messages/:roomId", protect, async (req, res) => {
  try {
    const messages = await Message.find({ room: req.params.roomId })
      .sort({ createdAt: 1 })
      .limit(100);
    res.json({ messages });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

chatRouter.patch("/:roomId/resolve", protect, admin, async (req, res) => {
  try {
    await Conversation.findOneAndUpdate(
      { userId: req.params.roomId },
      { status: "resolved" }
    );
    res.json({ message: "Conversation resolved" });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});
