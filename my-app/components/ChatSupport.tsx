"use client";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { motion, AnimatePresence } from "motion/react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { useState } from "react";

interface Message {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: Date;
}

interface ChatSupportProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ChatSupport({ isOpen, onClose }: ChatSupportProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "bot",
      text: "Hi! I'm here to help you with your order. How can I assist you today?",
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState("");

  const quickReplies = [
    "Can I customize my order?",
    "Change delivery address",
    "Add special instructions",
    "Dietary restrictions"
  ];

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: inputValue,
      timestamp: new Date()
    };

    setMessages([...messages, userMessage]);
    setInputValue("");

    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: getBotResponse(inputValue),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const getBotResponse = (userText: string): string => {
    const text = userText.toLowerCase();
    
    if (text.includes("customize") || text.includes("change")) {
      return "You can customize any item by clicking on it in the menu. You can add or remove ingredients, adjust spice levels, and add special instructions.";
    }
    if (text.includes("address")) {
      return "You can update your delivery address during checkout. We'll confirm the address before processing your order.";
    }
    if (text.includes("special") || text.includes("instructions")) {
      return "You can add special instructions for each item or for the entire order during checkout. Our chefs will do their best to accommodate your requests!";
    }
    if (text.includes("dietary") || text.includes("allergy")) {
      return "We have filters for vegetarian, vegan, and gluten-free options. Please mention any allergies in the special instructions, and we'll ensure your food is prepared safely.";
    }
    if (text.includes("delivery") || text.includes("time")) {
      return "Estimated delivery times are shown for each restaurant. We'll keep you updated with real-time tracking once your order is confirmed!";
    }
    
    return "I understand. Is there anything specific you'd like help with? You can ask about customizing orders, delivery, dietary restrictions, or any other questions!";
  };

  const handleQuickReply = (reply: string) => {
    setInputValue(reply);
    handleSend();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className="fixed bottom-4 right-4 z-50 w-full max-w-md"
    >
      <Card className="border-2 shadow-2xl">
        <CardHeader className="bg-primary text-primary-foreground">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary-foreground/10 rounded-full">
                <MessageCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-primary-foreground">Chat Support</CardTitle>
                <div className="flex items-center gap-2 text-sm text-primary-foreground/80">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  Online
                </div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-primary-foreground hover:bg-primary-foreground/10"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Messages */}
          <ScrollArea className="h-96 p-4">
            <div className="space-y-4">
              {messages.map((message) => (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-3 ${
                    message.sender === "user" ? "flex-row-reverse" : ""
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      message.sender === "bot"
                        ? "bg-primary/10 text-primary"
                        : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    {message.sender === "bot" ? (
                      <Bot className="h-4 w-4" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </div>
                  <div
                    className={`flex-1 max-w-[80%] p-3 rounded-lg ${
                      message.sender === "bot"
                        ? "bg-muted"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    <p className="text-sm">{message.text}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </ScrollArea>

          {/* Quick Replies */}
          {messages.length <= 2 && (
            <div className="px-4 pb-3">
              <p className="text-xs text-muted-foreground mb-2">Quick replies:</p>
              <div className="flex flex-wrap gap-2">
                {quickReplies.map((reply) => (
                  <Button
                    key={reply}
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickReply(reply)}
                    className="text-xs"
                  >
                    {reply}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSend()}
              />
              <Button onClick={handleSend} size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ChatButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-4 right-4 z-40"
    >
      <Button
        size="lg"
        className="rounded-full w-14 h-14 shadow-2xl"
        onClick={onClick}
      >
        <MessageCircle className="h-6 w-6" />
      </Button>
      <Badge className="absolute -top-1 -right-1 bg-green-500 border-0 px-2">
        Online
      </Badge>
    </motion.div>
  );
}
