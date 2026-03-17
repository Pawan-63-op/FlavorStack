"use client";
import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:8000";

let socketInstance: Socket | null = null;

// Singleton — one socket connection shared across components
function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
  }
  return socketInstance;
}

export interface ChatMessage {
  _id: string;
  room: string;
  text: string;
  senderRole: "customer" | "admin";
  senderName: string;
  createdAt: string;
}

interface UseSocketOptions {
  roomId: string;
  onMessage: (msg: ChatMessage) => void;
  onTyping?: (data: { isTyping: boolean; senderRole: string }) => void;
  onResolved?: () => void;
  onMessagesRead?: () => void;
}

export function useSocket({
  roomId,
  onMessage,
  onTyping,
  onResolved,
  onMessagesRead,
}: UseSocketOptions) {
  const socket = useRef<Socket>(getSocket());

  useEffect(() => {
    const s = socket.current;

    s.emit("join_room", roomId);

    s.on("new_message",    onMessage);
    s.on("typing",         onTyping || (() => {}));
    s.on("chat_resolved",  onResolved || (() => {}));
    s.on("messages_read",  onMessagesRead || (() => {}));

    return () => {
      s.emit("leave_room", roomId);
      s.off("new_message",   onMessage);
      s.off("typing",        onTyping || (() => {}));
      s.off("chat_resolved", onResolved || (() => {}));
      s.off("messages_read", onMessagesRead || (() => {}));
    };
  }, [roomId]);

  const sendMessage = useCallback((
    text: string,
    senderRole: "customer" | "admin",
    senderName: string,
    extra?: { userName?: string; userEmail?: string }
  ) => {
    socket.current.emit("send_message", {
      roomId, text, senderRole, senderName, ...extra,
    });
  }, [roomId]);

  const sendTyping = useCallback((isTyping: boolean, senderRole: string) => {
    socket.current.emit("typing", { roomId, isTyping, senderRole });
  }, [roomId]);

  const markRead = useCallback(() => {
    socket.current.emit("mark_read", roomId);
  }, [roomId]);

  const resolveChat = useCallback(() => {
    socket.current.emit("resolve_chat", roomId);
  }, [roomId]);

  return { sendMessage, sendTyping, markRead, resolveChat };
}
