"use client";
// Force re-compile to fix 404

import { Suspense, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Mail, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#050505]" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        window.location.href = redirectTo;
      }
    });
  }, [redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    console.log("Intentando iniciar sesión con:", email);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        console.log("Respuesta de Supabase:", { data, error });
        if (error) throw error;
        console.log("Login exitoso, redirigiendo...");
        window.location.href = redirectTo;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          window.location.href = redirectTo;
        } else {
          alert("Registro completado. Revisa tu correo si Supabase solicita confirmación y luego inicia sesión.");
          setIsLogin(true);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No se pudo completar el acceso.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-[#050505] flex items-center justify-center overflow-hidden font-sans">
      {/* Animated Deep Space Background */}
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
      <motion.div 
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-primary/20 blur-[150px] rounded-full pointer-events-none" 
      />
      <motion.div 
        animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 15, repeat: Infinity, ease: "linear", delay: 2 }}
        className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-secondary/20 blur-[150px] rounded-full pointer-events-none" 
      />

      <div className="relative z-10 w-full max-w-md p-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="glass rounded-3xl border border-white/10 p-8 shadow-[0_0_100px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
        >
          <div className="mb-10 text-center">
            <h1 className="text-3xl font-black tracking-tighter bg-gradient-to-br from-white to-white/50 bg-clip-text text-transparent uppercase inline-block">
              {isLogin ? "Acceso" : "Registro"}
            </h1>
            <p className="text-xs tracking-[0.2em] uppercase text-primary/80 mt-2 font-bold">
              {redirectTo.startsWith("/expo/") ? "Accede para entrar a la feria" : "Virtual Fair Platform"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs text-center">
                {error}
              </div>
            )}
            
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within:text-primary transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Correo electrónico"
                  required
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>
              
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-white/30 group-focus-within:text-primary transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contraseña"
                  required
                  className="w-full bg-black/40 border border-white/5 rounded-xl py-4 pl-12 pr-4 text-sm text-white placeholder-white/30 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-primary to-secondary p-[1px] disabled:opacity-50 disabled:cursor-not-allowed mt-8"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/40 to-secondary/40 blur-md group-hover:blur-xl transition-all" />
              <div className="relative flex items-center justify-center gap-2 bg-black/80 px-6 py-4 rounded-xl group-hover:bg-black/50 transition-colors">
                <span className="text-xs uppercase font-extrabold tracking-widest text-white">
                  {loading ? "Procesando..." : (isLogin ? "Iniciar Sesión" : "Crear Cuenta")}
                </span>
                {!loading && <ArrowRight size={16} className="text-primary group-hover:translate-x-1 transition-transform" />}
              </div>
            </button>
          </form>

          <div className="mt-8 text-center border-t border-white/5 pt-6">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-white/50 hover:text-white transition-colors uppercase tracking-widest"
            >
              {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
