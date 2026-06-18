"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Building2, Lock, Mail, ShieldCheck, Sparkles, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setIsSignedIn(Boolean(session?.user));
      setSessionReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session?.user));
      setSessionReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      window.location.href = "/dashboard";
      return;
    }

    try {
      const loginResult = await Promise.race([
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        new Promise<never>((_, reject) => {
          window.setTimeout(() => reject(new Error("La conexion con Supabase esta tardando demasiado.")), 12000);
        }),
      ]);

      if (loginResult.error) {
        setError(loginResult.error.message);
        setLoading(false);
        return;
      }

      window.location.href = "/dashboard";
    } catch (loginError) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        window.location.href = "/dashboard";
        return;
      }

      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesion.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-64px)] overflow-hidden bg-[#050505] text-white">
      <Image
        src="/images/pavilion_bg.png"
        alt="Feria virtual futurista con stands y visitantes"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,5,5,0.92)_0%,rgba(5,5,5,0.62)_48%,rgba(5,5,5,0.20)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_38%,rgba(255,81,0,0.20),transparent_32%),linear-gradient(180deg,rgba(5,5,5,0.10),rgba(5,5,5,0.92))]" />

      <section className="relative z-10 mx-auto grid min-h-[calc(100vh-64px)] w-full max-w-7xl grid-cols-1 items-center gap-8 px-5 pb-10 pt-24 lg:grid-cols-[1fr_420px] lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/35 px-3 py-2 text-[10px] font-black uppercase tracking-[0.28em] text-white/80 backdrop-blur-md">
            <Sparkles size={14} className="text-primary" />
            Congresos, exposiciones y networking
          </div>

          <h1 className="max-w-3xl text-5xl font-black uppercase leading-[0.92] tracking-normal text-white sm:text-7xl lg:text-8xl">
            Feria Virtual
          </h1>

          <p className="mt-6 max-w-2xl text-base font-medium leading-7 text-white/72 sm:text-lg">
            Un recinto digital para pabellones, stands, auditorios y participantes acreditados. Gestiona el evento y deja que cada asistente entre por su enlace.
          </p>

          <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Building2, label: "Stands inmersivos" },
              { icon: Users, label: "Accesos privados" },
              { icon: ShieldCheck, label: "Panel organizador" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/35 p-3 backdrop-blur-md">
                <item.icon size={18} className="shrink-0 text-primary" />
                <span className="text-xs font-black uppercase tracking-[0.12em] text-white/80">{item.label}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.aside
          initial={{ opacity: 0, x: 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.75, ease: "easeOut", delay: 0.1 }}
          className="w-full rounded-lg border border-white/15 bg-black/58 p-6 shadow-[0_28px_90px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
        >
          <div className="mb-6">
            <p className="text-[10px] font-black uppercase tracking-[0.32em] text-primary">Acceso</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-normal text-white">Entra al recinto</h2>
            <p className="mt-2 text-sm leading-6 text-white/55">
              Organizadores y gestores acceden al panel. Los participantes deben usar el enlace privado de su feria.
            </p>
          </div>

          {sessionReady && isSignedIn ? (
            <Link
              href="/dashboard"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-black transition hover:bg-white"
            >
              Ir a mi panel
              <ArrowRight size={16} />
            </Link>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              )}

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Correo</span>
                <span className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-primary/70">
                  <Mail size={18} className="text-white/35" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    placeholder="tu@email.com"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.22em] text-white/45">Contraseña</span>
                <span className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 focus-within:border-primary/70">
                  <Lock size={18} className="text-white/35" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/25"
                  />
                </span>
              </label>

              <button
                type="submit"
                disabled={loading || !sessionReady}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-4 text-xs font-black uppercase tracking-[0.18em] text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {!sessionReady ? "Comprobando..." : loading ? "Entrando..." : "Entrar"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>
          )}

          <div className="mt-5 flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-white/55">
            <Link href="/login" className="inline-flex items-center gap-2 font-bold text-white transition hover:text-primary">
              Crear cuenta o acceder con enlace
              <ArrowRight size={14} />
            </Link>
            <p className="text-xs leading-5 text-white/38">
              Si has recibido una invitación, abre el enlace exacto de tu evento para activar el acceso.
            </p>
          </div>
        </motion.aside>
      </section>
    </div>
  );
}
