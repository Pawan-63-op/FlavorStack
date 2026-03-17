"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, ShieldCheck, User, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/store/authStore";
// import { useSocket, type ChatMessage } from "@/hooks/useSocket";
import { useSocket,ChatMessage } from "@/hooks_/useSocket";

interface ChatSupportProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_REPLIES = [
  "Where is my order?",
  "Change delivery address",
  "Cancel my order",
  "Report a problem",
];

export function ChatSupport({ isOpen, onClose }: ChatSupportProps) {
  const { user } = useAuthStore();
  const roomId = user?._id || "guest";

  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue]   = useState("");
  const [isLoading, setIsLoading]     = useState(true);
  const [adminTyping, setAdminTyping] = useState(false);
  const [isResolved, setIsResolved]   = useState(false);
  const scrollRef                     = useRef<HTMLDivElement>(null);
  const typingTimer                   = useRef<ReturnType<typeof setTimeout>>(1 as any);

  // Load message history when chat opens
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    fetch(`http://localhost:8000/api/chat/messages/${roomId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => {
        setMessages(data.messages || []);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [isOpen, roomId]);

  // Auto-scroll to bottom
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, adminTyping]);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      // avoid duplicates
      if (prev.some((m) => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleTyping = useCallback(({ isTyping, senderRole }: any) => {
    if (senderRole === "admin") setAdminTyping(isTyping);
  }, []);

  const { sendMessage, sendTyping, markRead } = useSocket({
    roomId,
    onMessage:    handleNewMessage,
    onTyping:     handleTyping,
    onResolved:   () => setIsResolved(true),
    onMessagesRead: () => {},
  });

  // Mark messages as read when chat opens
  useEffect(() => {
    if (isOpen && messages.length > 0) markRead();
  }, [isOpen, messages.length]);

  const handleSend = () => {
    if (!inputValue.trim() || isResolved) return;
    sendMessage(inputValue.trim(), "customer", user?.name || "Customer", {
      userName:  user?.name,
      userEmail: user?.email,
    });
    setInputValue("");
    sendTyping(false, "customer");
  };

  const handleInputChange = (val: string) => {
    setInputValue(val);
    sendTyping(true, "customer");
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sendTyping(false, "customer"), 1500);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-4 right-4 z-50 w-full max-w-sm"
    >
      <Card className="border-2 shadow-2xl overflow-hidden">
        {/* Header */}
        <CardHeader className="bg-primary text-primary-foreground py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-primary-foreground/10 rounded-full">
                <MessageCircle className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-primary-foreground text-sm">Support Chat</CardTitle>
                <div className="flex items-center gap-1.5 text-xs text-primary-foreground/80">
                  <div className={`w-1.5 h-1.5 rounded-full ${isResolved ? "bg-gray-400" : "bg-green-400"}`} />
                  {isResolved ? "Resolved" : "Online"}
                </div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}
              className="text-primary-foreground hover:bg-primary-foreground/10 h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Messages */}
          <ScrollArea className="h-80 p-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-primary" />
                    Hi {user?.name?.split(" ")[0] || "there"}! How can we help you today?
                  </div>
                )}

                {messages.map((msg) => (
                  <motion.div key={msg._id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className={`flex gap-2 ${msg.senderRole === "customer" ? "flex-row-reverse" : ""}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      msg.senderRole === "admin" ? "bg-primary/10 text-primary" : "bg-secondary"
                    }`}>
                      {msg.senderRole === "admin"
                        ? <ShieldCheck className="h-3.5 w-3.5" />
                        : <User className="h-3.5 w-3.5" />}
                    </div>
                    <div className={`max-w-[75%] p-2.5 rounded-xl text-sm ${
                      msg.senderRole === "customer"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}>
                      {msg.senderRole === "admin" && (
                        <p className="text-xs font-medium mb-1 text-primary">Support</p>
                      )}
                      {msg.text}
                      <p className={`text-xs mt-1 ${
                        msg.senderRole === "customer" ? "text-primary-foreground/60" : "text-muted-foreground"
                      }`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {/* Admin typing indicator */}
                <AnimatePresence>
                  {adminTyping && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="flex gap-2 items-center">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div className="bg-muted px-3 py-2 rounded-xl flex gap-1 items-center">
                        {[0, 1, 2].map((i) => (
                          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                            animate={{ y: [0, -4, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={scrollRef} />
              </div>
            )}
          </ScrollArea>

          {/* Quick replies — only when no messages yet */}
          {!isLoading && messages.length === 0 && (
            <div className="px-3 pb-2">
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REPLIES.map((r) => (
                  <button key={r} onClick={() => { setInputValue(r); }}
                    className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-primary hover:text-primary transition-colors">
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Resolved banner */}
          {isResolved && (
            <div className="px-3 pb-2 text-center text-xs text-muted-foreground">
              This conversation has been resolved.
            </div>
          )}

          {/* Input */}
          {!isResolved && (
            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="Type a message..."
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                className="text-sm h-9"
              />
              <Button onClick={handleSend} size="icon" className="h-9 w-9 shrink-0"
                disabled={!inputValue.trim()}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ChatButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
      className="fixed bottom-4 right-4 z-40">
      <Button size="lg" className="rounded-full w-14 h-14 shadow-2xl" onClick={onClick}>
        <MessageCircle className="h-6 w-6" />
      </Button>
      <Badge className="absolute -top-1 -right-1 bg-green-500 border-0 px-1.5 text-xs">
        Live
      </Badge>
    </motion.div>
  );
}
