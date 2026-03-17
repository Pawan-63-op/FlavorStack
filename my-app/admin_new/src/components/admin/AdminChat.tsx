"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle, Send, CheckCircle, User,
  ShieldCheck, Loader2, RefreshCw,
} from "lucide-react";
import { useSocket, type ChatMessage } from "@/hooks_/useSocket";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";

interface Conversation {
  userId: string;
  userName: string;
  userEmail: string;
  status: "open" | "resolved";
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

// ── Conversation list ─────────────────────────────────────────────────────────
function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onRefresh,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (c: Conversation) => void;
  onRefresh: () => void;
}) {
  const open     = conversations.filter((c) => c.status === "open");
  const resolved = conversations.filter((c) => c.status === "resolved");

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="font-semibold">Conversations</h3>
          <p className="text-xs text-muted-foreground">{open.length} open</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {open.length === 0 && resolved.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            <MessageCircle className="h-8 w-8 mx-auto mb-2" />
            No conversations yet
          </div>
        )}

        {open.length > 0 && (
          <div className="p-2">
            <p className="text-xs text-muted-foreground px-2 py-1">Open</p>
            {open.map((c) => (
              <ConvoRow key={c.userId} convo={c}
                isSelected={selectedId === c.userId} onSelect={onSelect} />
            ))}
          </div>
        )}

        {resolved.length > 0 && (
          <div className="p-2">
            <p className="text-xs text-muted-foreground px-2 py-1">Resolved</p>
            {resolved.map((c) => (
              <ConvoRow key={c.userId} convo={c}
                isSelected={selectedId === c.userId} onSelect={onSelect} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function ConvoRow({ convo, isSelected, onSelect }: {
  convo: Conversation; isSelected: boolean; onSelect: (c: Conversation) => void;
}) {
  return (
    <button onClick={() => onSelect(convo)} className={`w-full text-left p-3 rounded-xl mb-1 transition-all ${
      isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-accent"
    }`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium truncate">{convo.userName}</span>
            {convo.unreadCount > 0 && (
              <Badge className="h-4 min-w-4 px-1 text-xs bg-primary">{convo.unreadCount}</Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{convo.lastMessage}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(convo.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>
    </button>
  );
}

// ── Message thread ────────────────────────────────────────────────────────────
function MessageThread({ conversation, adminName }: {
  conversation: Conversation; adminName: string;
}) {
  const [messages, setMessages]         = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue]     = useState("");
  const [isLoading, setIsLoading]       = useState(true);
  const [customerTyping, setCustomerTyping] = useState(false);
  const [isResolved, setIsResolved]     = useState(conversation.status === "resolved");
  const scrollRef                       = useRef<HTMLDivElement>(null);
  const typingTimer                     = useRef<ReturnType<typeof setTimeout>>(1 as any);

  // Load history
  useEffect(() => {
    setIsLoading(true);
    setIsResolved(conversation.status === "resolved");
    fetch(`http://localhost:8000/api/chat/messages/${conversation.userId}`, {
      credentials: "include",
    })
      .then((r) => r.json())
      .then((data) => { setMessages(data.messages || []); setIsLoading(false); })
      .catch(() => setIsLoading(false));
  }, [conversation.userId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, customerTyping]);

  const handleNewMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m._id === msg._id)) return prev;
      return [...prev, msg];
    });
  }, []);

  const handleTyping = useCallback(({ isTyping, senderRole }: any) => {
    if (senderRole === "customer") setCustomerTyping(isTyping);
  }, []);

  const { sendMessage, sendTyping, markRead, resolveChat } = useSocket({
    roomId:     conversation.userId,
    onMessage:  handleNewMessage,
    onTyping:   handleTyping,
    onResolved: () => setIsResolved(true),
  });

  // Mark as read when opened
  useEffect(() => { markRead(); }, [conversation.userId]);

  const handleSend = () => {
    if (!inputValue.trim() || isResolved) return;
    sendMessage(inputValue.trim(), "admin", adminName);
    setInputValue("");
    sendTyping(false, "admin");
  };

  const handleResolve = async () => {
    resolveChat();
    setIsResolved(true);
    toast.success("Conversation resolved");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Thread header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-accent flex items-center justify-center">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium text-sm">{conversation.userName}</p>
            <p className="text-xs text-muted-foreground">{conversation.userEmail}</p>
          </div>
        </div>
        {!isResolved && (
          <Button size="sm" variant="outline" className="gap-1.5 text-xs"
            onClick={handleResolve}>
            <CheckCircle className="h-3.5 w-3.5" /> Resolve
          </Button>
        )}
        {isResolved && (
          <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300 text-xs">
            Resolved
          </Badge>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <motion.div key={msg._id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className={`flex gap-2 ${msg.senderRole === "admin" ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  msg.senderRole === "customer" ? "bg-accent" : "bg-primary/10"
                }`}>
                  {msg.senderRole === "customer"
                    ? <User className="h-3.5 w-3.5 text-muted-foreground" />
                    : <ShieldCheck className="h-3.5 w-3.5 text-primary" />}
                </div>
                <div className={`max-w-[75%] p-2.5 rounded-xl text-sm ${
                  msg.senderRole === "admin"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  <p className={`text-xs font-medium mb-1 ${
                    msg.senderRole === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}>{msg.senderName}</p>
                  {msg.text}
                  <p className={`text-xs mt-1 ${
                    msg.senderRole === "admin" ? "text-primary-foreground/60" : "text-muted-foreground"
                  }`}>
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </motion.div>
            ))}

            <AnimatePresence>
              {customerTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex gap-2 items-center">
                  <div className="w-7 h-7 rounded-full bg-accent flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
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

      {/* Input */}
      {!isResolved && (
        <div className="p-3 border-t flex gap-2">
          <Input
            placeholder="Reply to customer..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              sendTyping(true, "admin");
              clearTimeout(typingTimer.current);
              typingTimer.current = setTimeout(() => sendTyping(false, "admin"), 1500);
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="text-sm"
          />
          <Button onClick={handleSend} size="icon" disabled={!inputValue.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main AdminChat component ──────────────────────────────────────────────────
export function AdminChat() {
  const { user } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected]           = useState<Conversation | null>(null);
  const [isLoading, setIsLoading]         = useState(true);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const res  = await fetch("http://localhost:8000/api/chat/conversations", {
        credentials: "include",
      });
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadConversations(); }, []);

  // Listen for new messages across all rooms to update sidebar
  const handleConvoUpdate = useCallback(({ roomId, lastMessage, userName }: any) => {
    setConversations((prev) =>
      prev.map((c) =>
        c.userId === roomId
          ? { ...c, lastMessage, lastMessageAt: new Date().toISOString(), unreadCount: c.unreadCount + 1 }
          : c
      )
    );
    toast.info(`New message from ${userName || "Customer"}`);
  }, []);

  // Global socket listener for conversation updates
  useEffect(() => {
    import("socket.io-client").then(({ io }) => {
      const s = io("http://localhost:8000", { withCredentials: true });
      s.on("conversation_updated", handleConvoUpdate);
      return () => { s.off("conversation_updated", handleConvoUpdate); s.disconnect(); };
    });
  }, [handleConvoUpdate]);

  const handleSelect = (c: Conversation) => {
    setSelected(c);
    // Clear unread badge
    setConversations((prev) =>
      prev.map((conv) => conv.userId === c.userId ? { ...conv, unreadCount: 0 } : conv)
    );
  };

  const totalUnread = conversations.reduce((s, c) => s + c.unreadCount, 0);

  return (
    <div className="mt-6">
      <div className="flex items-center gap-3 mb-4">
        <h3 className="text-xl font-semibold">Chat Support</h3>
        {totalUnread > 0 && (
          <Badge className="bg-primary">{totalUnread} unread</Badge>
        )}
      </div>

      <Card className="border-2 shadow-lg overflow-hidden" style={{ height: 600 }}>
        <div className="grid grid-cols-3 h-full divide-x">
          {/* Left — conversation list */}
          <div className="col-span-1 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center items-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                selectedId={selected?.userId || null}
                onSelect={handleSelect}
                onRefresh={loadConversations}
              />
            )}
          </div>

          {/* Right — message thread */}
          <div className="col-span-2 overflow-hidden">
            {selected ? (
              <MessageThread
                key={selected.userId}
                conversation={selected}
                adminName={user?.name || "Admin"}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <MessageCircle className="h-12 w-12 mb-3" />
                <p className="text-sm">Select a conversation to reply</p>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
