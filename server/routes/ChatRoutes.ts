import express from "express";
import { protect, admin } from "../middleware/authMiddleware";
// import { Conversation, Message } from "../models/Chat"
import { Conversation,Message } from "@/models/Message";
export const chatRouter = express.Router();
// ── REST routes for chat ──────────────────────────────────────────────────────
// Add these to a chatRoutes.ts file:
//
// GET  /api/chat/conversations        — list all conversations (admin)
// GET  /api/chat/messages/:roomId     — get message history
// PATCH /api/chat/:roomId/resolve     — resolve conversation
// Get all conversations — admin only
chatRouter.get("/conversations", protect, admin, async (req, res) => {
  try {
    const convos = await Conversation.find()
      .sort({ lastMessageAt: -1 });
    res.json({ conversations: convos });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Get messages for a room
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

// Resolve a conversation
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
