"use client";

import Auditorium from "@/components/fair/Auditorium";
import { motion } from "framer-motion";
import Link from "next/link";
import { ChevronLeft, Home } from "lucide-react";

export default function AuditoriumPage() {
  return (
    <main className="min-h-screen bg-[#050505] flex flex-col pt-16">
      {/* Dynamic Header for dedicated page */}
      <nav className="fixed top-0 inset-x-0 h-16 glass border-b border-white/5 z-50 flex items-center justify-between px-10">
        <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 text-[10px] font-black uppercase text-white/40 hover:text-white transition-all tracking-widest">
               <ChevronLeft size={16} /> Volver al Pabellón
            </Link>
            <div className="w-px h-6 bg-white/10" />
            <h1 className="text-xs font-black uppercase tracking-[0.3em] text-white/90">Auditorio Principal</h1>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="px-5 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest">Live Experience</span>
            </div>
        </div>
      </nav>

      {/* Main Experience */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex-1 w-full"
      >
        <Auditorium />
      </motion.div>

      {/* Simple Footer overlay */}
      <div className="fixed bottom-6 left-10 pointer-events-none opacity-20">
          <p className="text-[8px] font-black uppercase tracking-[0.5em] text-white">ARES EVENT DESIGN</p>
      </div>
    </main>
  );
}
