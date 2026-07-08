import { Server as SocketServer } from "socket.io";
import { Server as HttpServer } from "http";
import { Message,Conversation } from "./models/Message";

export function initSocket(httpServer: HttpServer) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);

    socket.on("join_room", (roomId: string) => {
      socket.join(roomId);
      console.log(`Socket ${socket.id} joined room: ${roomId}`);
    });

    socket.on("leave_room", (roomId: string) => {
      socket.leave(roomId);
    });

    socket.on("send_message", async ({
      roomId,
      text,
      senderRole,
      senderName,
      userName,
      userEmail,
    }: {
      roomId: string;
      text: string;
      senderRole: "customer" | "admin";
      senderName: string;
      userName?: string;
      userEmail?: string;
    }) => {
      try {
        const msg = await Message.create({ room: roomId, text, senderRole, senderName });

        await Conversation.findOneAndUpdate(
          { userId: roomId },
          {
            userId:        roomId,
            userName:      userName || senderName,
            userEmail:     userEmail || "",
            status:        "open",
            lastMessage:   text,
            lastMessageAt: new Date(),
            ...(senderRole === "customer" && { $inc: { unreadCount: 1 } }),
          },
          { upsert: true, new: true }
        );

        io.to(roomId).emit("new_message", {
          _id:        msg._id,
          room:       roomId,
          text,
          senderRole,
          senderName,
          createdAt:  msg.createdAt,
        });

        if (senderRole === "customer") {
          io.emit("conversation_updated", { roomId, lastMessage: text, userName });
        }
      } catch (err) {
        console.error("send_message error:", err);
      }
    });

    socket.on("typing", ({ roomId, isTyping, senderRole }: {
      roomId: string; isTyping: boolean; senderRole: string;
    }) => {
      socket.to(roomId).emit("typing", { isTyping, senderRole });
    });

    socket.on("mark_read", async (roomId: string) => {
      await Message.updateMany(
        { room: roomId, senderRole: "customer", isRead: false },
        { isRead: true }
      );
      await Conversation.findOneAndUpdate({ userId: roomId }, { unreadCount: 0 });
      socket.to(roomId).emit("messages_read", roomId);
    });

    socket.on("resolve_chat", async (roomId: string) => {
      await Conversation.findOneAndUpdate({ userId: roomId }, { status: "resolved" });
      io.to(roomId).emit("chat_resolved", roomId);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);
    });
  });

  return io;
}



