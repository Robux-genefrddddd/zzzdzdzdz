import { useState, useRef, useEffect } from "react";
import { ArrowUp, Menu, X, ArrowRight } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Squares from "@/components/Squares";
import GradualBlur from "@/components/GradualBlur";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/config/firebase";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
} from "firebase/firestore";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
  image?: string; // base64 encoded image
  caption?: string; // image description
}

export default function Chat() {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      text: "Hi! I'm PinIA, your dedicated assistant for Roblox game development. How can I help you today?",
      sender: "ai",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentChatId, setCurrentChatId] = useState<string>("");
  const [typingUsername, setTypingUsername] = useState<string | null>(null);
  const currentChatIdRef = useRef<string>("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleChatNavigation = async () => {
      // Wait for auth to be loaded before accessing Firestore
      if (authLoading) return;

      const newParam = searchParams.get("new");
      const chatParam = searchParams.get("chat");

      if (newParam === "true") {
        // Reset for new chat
        setMessages([
          {
            id: "1",
            text: "Hi! I'm PinIA, your dedicated assistant for Roblox game development. How can I help you today?",
            sender: "ai",
            timestamp: new Date(),
          },
        ]);
        setInput("");
        currentChatIdRef.current = "";
        setCurrentChatId("");
        // Clean up URL
        navigate("/chat", { replace: true });
      } else if (chatParam && user) {
        // Load existing chat
        try {
          const chatDocRef = doc(db, "users", user.uid, "chats", chatParam);
          const chatSnapshot = await getDoc(chatDocRef);
          if (chatSnapshot.exists()) {
            const data = chatSnapshot.data();
            const loadedMessages: Message[] = (data.messages || []).map(
              (msg: any) => ({
                id: msg.id,
                text: msg.text,
                sender: msg.sender,
                timestamp: new Date(msg.timestamp),
              }),
            );
            setMessages(
              loadedMessages.length > 0
                ? loadedMessages
                : [
                    {
                      id: "1",
                      text: "Hi! I'm PinIA, your dedicated assistant for Roblox game development. How can I help you today?",
                      sender: "ai",
                      timestamp: new Date(),
                    },
                  ],
            );
            currentChatIdRef.current = chatParam;
            setCurrentChatId(chatParam);
            setInput("");
          } else {
            // Chat not found, reset
            currentChatIdRef.current = "";
            setCurrentChatId("");
            navigate("/chat?new=true", { replace: true });
          }
        } catch (error) {
          console.error("Error loading chat:", error);
          // On error, show initial state
          setMessages([
            {
              id: "1",
              text: "Hi! I'm PinIA, your dedicated assistant for Roblox game development. How can I help you today?",
              sender: "ai",
              timestamp: new Date(),
            },
          ]);
        }
      }
    };

    handleChatNavigation();
  }, [searchParams, user, authLoading, navigate]);

  const saveNewChat = async (title: string) => {
    if (!user) return null;
    try {
      const chatId = Date.now().toString();
      const chatDocRef = doc(db, "users", user.uid, "chats", chatId);
      await setDoc(chatDocRef, {
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        messages: [],
      });
      return chatId;
    } catch (error) {
      console.error("Error saving chat:", error);
      return null;
    }
  };

  const saveMessage = async (message: Message, chatId: string) => {
    if (!user || !chatId) return;
    try {
      const chatDocRef = doc(db, "users", user.uid, "chats", chatId);
      await updateDoc(chatDocRef, {
        messages: arrayUnion({
          id: message.id,
          text: message.text,
          sender: message.sender,
          timestamp: message.timestamp.toISOString(),
        }),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !user || isLoading) return;

    const messageText = input;
    let chatId = currentChatIdRef.current;

    if (!chatId) {
      const newChatId = await saveNewChat(
        messageText.slice(0, 50) + (messageText.length > 50 ? "..." : ""),
      );
      if (newChatId) {
        chatId = newChatId;
        currentChatIdRef.current = newChatId;
        setCurrentChatId(newChatId);
      } else {
        console.error("Failed to create new chat");
        return;
      }
    }

    const userMessage: Message = {
      id: Math.random().toString(),
      text: messageText,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    await saveMessage(userMessage, chatId);
    setInput("");
    setIsLoading(true);
    setTypingUsername("PinIA");

    try {
      console.log("Sending message to API...");
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.sender === "user" ? "user" : "assistant",
            content: msg.text,
          })),
        }),
      });

      console.log("API response status:", response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error("API error response:", errorData);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("API response data:", data);

      if (!data.message && !data.image) {
        throw new Error("No message or image in response");
      }

      const aiMessage: Message = {
        id: Math.random().toString(),
        text: data.message || "",
        sender: "ai",
        timestamp: new Date(),
        image: data.image,
        caption: data.caption,
      };

      console.log("Adding AI message:", {
        hasText: !!data.message,
        hasImage: !!data.image,
      });
      setMessages((prev) => [...prev, aiMessage]);
      await saveMessage(aiMessage, chatId);
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: Math.random().toString(),
        text: `Error: ${error instanceof Error ? error.message : "Failed to get response from AI"}. Please try again.`,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      console.log("Stopping loading state...");
      setIsLoading(false);
      setTypingUsername(null);
    }
  };

  return (
    <div className="flex h-screen bg-black text-white relative overflow-hidden">
      {/* Animated Background Squares */}
      <div className="fixed inset-0 z-0 opacity-80">
        <Squares
          direction="diagonal"
          speed={0.5}
          borderColor="#333"
          squareSize={50}
          hoverFillColor="#1a1a2e"
        />
      </div>

      {/* Sidebar */}
      <div className="relative z-50">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          currentChatId={currentChatId}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col relative z-0">
        {/* Header */}
        <header className="border-b border-gray-800/30 backdrop-blur-md py-4 px-4 sm:px-6 flex items-center justify-between bg-gradient-to-b from-black/80 to-black/40">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 hover:bg-gray-900/60 text-gray-400 hover:text-cyan-400 rounded-lg transition-all duration-200"
          >
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-lg font-semibold text-white flex-1 text-center lg:text-left">
            Chat with PinIA
          </h1>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 hover:shadow-lg hover:shadow-cyan-500/30 transition-all duration-200">
            {user?.email?.charAt(0).toUpperCase() || "U"}
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
          <div className="p-4 sm:p-6 max-w-4xl mx-auto w-full">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="text-6xl mb-6 drop-shadow-lg">🤖</div>
                <h2 className="text-3xl font-bold text-white mb-3">
                  Start a new conversation
                </h2>
                <p className="text-gray-400 max-w-md leading-relaxed">
                  Ask me anything about Roblox game development, scripting,
                  design, monetization, and more.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex animate-fade-in-up gap-3 mb-2 ${
                      message.sender === "user"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.sender === "ai" && (
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-200">
                          P
                        </div>
                      </div>
                    )}
                    <div className="flex flex-col gap-1 max-w-xs sm:max-w-md lg:max-w-2xl">
                      {message.sender === "ai" && (
                        <span className="text-xs text-gray-500 font-medium px-1">
                          PinIA
                        </span>
                      )}
                      <div
                        className={`px-4 py-3.5 rounded-2xl transition-all duration-200 backdrop-blur-sm ${
                          message.sender === "user"
                            ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-br-lg shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                            : "bg-gradient-to-br from-gray-800/70 to-gray-900/70 text-gray-100 rounded-bl-lg border border-gray-700/50 hover:border-gray-600/70"
                        }`}
                      >
                        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {message.text}
                        </p>
                        <span
                          className={`text-xs mt-2 block font-medium ${
                            message.sender === "user"
                              ? "opacity-75 text-cyan-100"
                              : "opacity-60 text-gray-500"
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                    {message.sender === "user" && (
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all duration-200">
                          {user?.email?.charAt(0).toUpperCase() || "U"}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && typingUsername && (
                  <div className="flex justify-start animate-fade-in-up gap-3 mb-2">
                    <div className="flex-shrink-0 mt-0.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg shadow-cyan-500/30">
                        P
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-xs text-gray-500 font-medium px-1">
                        PinIA is typing...
                      </span>
                      <div className="bg-gradient-to-br from-gray-800/70 to-gray-900/70 text-white rounded-2xl rounded-bl-lg border border-gray-700/50 border-cyan-500/30 backdrop-blur-sm px-4 py-3.5 shadow-lg shadow-cyan-500/10">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" />
                          <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce animation-delay-200" />
                          <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce animation-delay-400" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Input area */}
        <div className="border-t border-gray-800/30 bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto">
            <div className="flex gap-3 items-end">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me anything..."
                rows={1}
                className="flex-1 px-4 py-3 bg-gray-900/60 border border-gray-800 rounded-xl text-white placeholder:text-gray-500 resize-none focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 transition-all max-h-32 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-cyan-500 text-white rounded-xl hover:from-cyan-500 hover:to-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 flex-shrink-0 hover:shadow-lg hover:shadow-cyan-500/25 active:scale-95 group"
                title="Send message (Enter)"
              >
                <ArrowUp
                  size={18}
                  className="group-hover:-translate-y-0.5 transition-transform duration-200"
                />
              </button>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .animation-delay-200 {
          animation-delay: 0.2s;
        }
        .animation-delay-400 {
          animation-delay: 0.4s;
        }
      `}</style>
    </div>
  );
}
