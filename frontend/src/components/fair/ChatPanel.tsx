"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, X, User, AlertCircle, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Message {
  id: string;
  user_id: string;
  user_name: string;
  content: string;
  room: string;
  created_at: string;
}

interface ChatPanelProps {
  onClose: () => void;
  room?: string;
}

export default function ChatPanel({ onClose, room = 'auditorio_principal' }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Get current user session
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setCurrentUser(session.user);
      }
    };
    fetchUser();

    // Fetch initial messages for specific room
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('room', room)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (data) setMessages(data);
      if (error) console.error("Error fetching messages:", error);
    };
    fetchMessages();

    let pollInterval: NodeJS.Timeout | null = null;

    // Subscribe to new messages in specific room
    const channel = supabase
      .channel(`chat:${room}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages',
        filter: `room=eq.${room}`
      }, (payload) => {
        console.log("New message received:", payload.new);
        setMessages(prev => {
            if (prev.find(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
        });
      })
      .subscribe((status) => {
          console.log("Chat sync status:", status);
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              setErrorStatus("Sincronización alternativa activa.");
              // Fallback to polling every 3 seconds
              if (!pollInterval) {
                 pollInterval = setInterval(fetchMessages, 3000);
              }
          }
      });

    // Fallback rigorous polling every 5 sec anyway just in case
    if (!pollInterval) {
        pollInterval = setInterval(fetchMessages, 5000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [room]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser || isSending) return;

    setIsSending(true);
    setErrorStatus(null);
    const contentToSend = newMessage;
    setNewMessage("");

    const { error } = await supabase.from("messages").insert({
      user_id: currentUser.id,
      user_name: currentUser.email?.split("@")[0] || "Usuario",
      content: contentToSend,
      room: room
    });

    if (error) {
       console.error("Message send error:", error);
       setErrorStatus("No se pudo enviar. ¿Has iniciado sesión?");
       setNewMessage(contentToSend); // Restore text
    }
    setIsSending(false);
  };

  return (
    <motion.div 
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      className="fixed right-0 top-0 bottom-0 w-80 flex flex-col z-[100] shadow-2xl"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-3xl border-l border-white/10" />

      {/* Header */}
      <div className="relative z-10 p-8 border-b border-white/10 flex items-center justify-between">
        <div>
          <h3 className="text-base font-black uppercase tracking-widest text-primary">Chat en Vivo</h3>
          <p className="text-[9px] text-white/40 tracking-[0.3em] uppercase mt-1 flex items-center gap-2 font-bold">
            <span className={`w-1.5 h-1.5 rounded-full ${errorStatus ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`} /> 
            {errorStatus || 'Conectado'}
          </p>
        </div>
        <button onClick={onClose} className="p-3 rounded-full hover:bg-white/10 transition-colors text-white/40 hover:text-white">
          <X size={20} />
        </button>
      </div>

      {/* Messages Area */}
      <div className="relative z-10 flex-1 overflow-y-auto p-8 space-y-8 scrollbar-thin scrollbar-white/5">
        {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-20">
                <MessageSquare size={48} className="mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">Di algo para empezar...</p>
            </div>
        )}
        {messages.map((msg) => {
          const isMe = currentUser && msg.user_id === currentUser.id;
          return (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-4 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
              <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center flex-shrink-0 border border-white/10 shadow-lg">
                <User size={16} className={isMe ? "text-primary" : "text-white/40"} />
              </div>
              <div className={`flex flex-col gap-2 ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                <span className="text-[9px] text-white/30 uppercase tracking-[0.2em] font-black">
                  {msg.user_name}
                </span>
                <div 
                  className={`px-5 py-4 rounded-[1.5rem] text-sm leading-relaxed ${
                    isMe 
                      ? "bg-primary text-black font-medium rounded-tr-none shadow-lg shadow-primary/10" 
                      : "glass border border-white/10 rounded-tl-none text-white/90"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            </motion.div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative z-10 p-8 border-t border-white/10 bg-black/50 backdrop-blur-md">
        {errorStatus && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3 text-red-500">
                <AlertCircle size={14} />
                <span className="text-[10px] font-black uppercase tracking-wider">{errorStatus}</span>
            </div>
        )}

        {!currentUser ? (
          <div className="text-center p-4 border border-white/5 rounded-2xl bg-white/5 backdrop-blur-sm">
            <p className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-black">Debes iniciar sesión para comentar</p>
          </div>
        ) : (
          <form onSubmit={handleSendMessage} className="relative group">
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              disabled={isSending}
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-6 pr-14 text-sm text-white focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all placeholder:text-white/20 font-medium"
            />
            <button 
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-primary text-black hover:scale-105 active:scale-95 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
