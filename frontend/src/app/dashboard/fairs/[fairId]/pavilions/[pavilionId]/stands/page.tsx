"use client";

import { useEffect, useState, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, 
  ArrowLeft, 
  Store, 
  Video, 
  FileText, 
  ExternalLink,
  Edit2,
  Trash2,
  Save,
  X,
  UserPlus,
  Palette
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { DEFAULT_STAND_THEME_COLOR, standThemes } from "@/components/fair/standTheme";

interface Stand {
  id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  pdf_url_2: string | null;
  logo_url: string | null;
  website_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  linkedin: string | null;
  instagram: string | null;
  facebook: string | null;
  user_id: string | null;
  email: string | null;
  theme_color: string | null;
  images: string[];
}

export default function StandsPage({ params }: { params: Promise<{ fairId: string, pavilionId: string }> }) {
  const { fairId, pavilionId } = use(params);
  const [stands, setStands] = useState<Stand[]>([]);
  const [pavilionName, setPavilionName] = useState("");
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Edit State
  const [editingStand, setEditingStand] = useState<Stand | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const cleanText = (text: string | null) => {
    if (!text) return null;
    return text.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  };

  useEffect(() => {
    setMounted(true);
    async function fetchData() {
      try {
        // Cargamos el nombre del pabellón y los stands en PARALELO
        const [pavilionRes, standsRes] = await Promise.all([
          supabase.from('pavilions').select('name').eq('id', pavilionId).single(),
          supabase.from('stands').select('*').eq('pavilion_id', pavilionId).order('created_at', { ascending: true })
        ]);

        if (pavilionRes.data) setPavilionName(pavilionRes.data.name);

        const formattedStands = (standsRes.data || []).map(s => ({
          ...s,
          images: s.images || []
        }));
        setStands(formattedStands);
      } catch (err) {
        console.error('Error fetching stands data:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [pavilionId]);

  const handleEdit = (stand: Stand) => {
    setEditingStand({ ...stand });
  };

  const handleSave = async () => {
    if (!editingStand) return;
    if (uploadingCount > 0) {
      alert('Espera a que terminen de subirse los archivos...');
      return;
    }

    setIsSaving(true);
    try {
      console.log('--- 🚀 INICIANDO GUARDADO INTELIGENTE (v5) ---');
      const startTime = Date.now();
      
      const toB64 = (str: string | null) => {
        if (!str) return '';
        // Skip if already Base64
        if (str.startsWith('data:') || (str.length > 500 && /^[A-Za-z0-9+/=]+$/.test(str))) {
          return str;
        }
        try {
          const bytes = new TextEncoder().encode(str);
          // Usamos un buffer intermedio para mayor velocidad en strings largos
          let binString = '';
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binString += String.fromCharCode(bytes[i]);
          }
          return btoa(binString);
        } catch (e) {
          console.error("Error encoding to B64:", e);
          return str; 
        }
      };

      console.log('📦 Preparando payload...');
      const payload = {
        s_id: editingStand.id,
        s_title_b64: toB64(editingStand.title),
        s_desc_b64: toB64(editingStand.description),
        s_video_b64: toB64(editingStand.video_url),
        s_logo_b64: toB64(editingStand.logo_url),
        s_pdf_b64: toB64(editingStand.pdf_url),
        s_pdf2_b64: toB64(editingStand.pdf_url_2),
        s_web_b64: toB64(editingStand.website_url),
        s_phone_b64: toB64(editingStand.phone),
        s_whatsapp_b64: toB64(editingStand.whatsapp),
        s_email_b64: toB64(editingStand.email),
        s_linkedin_b64: toB64(editingStand.linkedin),
        s_insta_b64: toB64(editingStand.instagram),
        s_face_b64: toB64(editingStand.facebook),
        s_images_b64: (editingStand.images || []).map(img => toB64(img))
      };

      const payloadSize = JSON.stringify(payload).length / 1024;
      console.log(`📊 Tamaño del paquete: ${payloadSize.toFixed(2)} KB`);
      console.log(`⏱️ Tiempo de preparación: ${Date.now() - startTime}ms`);

      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), 45000); // 45 segundos para dar más margen
      });

      console.log('📡 Enviando RPC a Supabase...');
      const rpcPromise = supabase.rpc('update_stand_rpc_v5', payload);
      const { data, error }: any = await Promise.race([rpcPromise, timeoutPromise]);
      
      if (error) throw error;

      const nextThemeColor = /^#[0-9a-f]{6}$/i.test(editingStand.theme_color || "")
        ? editingStand.theme_color
        : standThemes[0].hex;
      const { error: themeError } = await supabase
        .from("stands")
        .update({ theme_color: nextThemeColor })
        .eq("id", editingStand.id);

      if (themeError) throw themeError;

      console.log('✅ ¡Servidor respondió con éxito!', data);
      setStands(stands.map(s => s.id === editingStand.id ? { ...editingStand, theme_color: nextThemeColor } : s));
      setEditingStand(null);
      alert('¡Guardado perfecto!');
      
    } catch (err: any) {
      console.error('❌ Error capturado:', err);
      if (err.message === 'TIMEOUT_EXCEEDED') {
        alert(`Error: Tiempo de espera agotado (45s). Es posible que el servidor esté saturado o la conexión sea lenta.`);
      } else {
        alert(`Error al guardar: ${err.message || 'Error desconocido'}. Revisa la consola para más detalles.`);
      }
    } finally {
      setIsSaving(false);
      console.log('--- 🏁 FIN DEL PROCESO ---');
    }
  };

  const handleDeleteStand = async (standId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este Stand?')) return;
    
    try {
      // Usamos RPC (POST) para evitar bloqueos de red en DELETE
      const { error } = await supabase.rpc('delete_stand_rpc', { s_id: standId });
      if (error) throw error;
      
      setStands(stands.filter(s => s.id !== standId));
      if (editingStand?.id === standId) setEditingStand(null);
      alert('Stand eliminado correctamente.');
    } catch (err: any) {
      console.error('Error al borrar con RPC:', err);
      alert(`Error al borrar: ${err.message}`);
    }
  };

  const handleCreateStand = async () => {
    try {
      const { data, error } = await supabase.from('stands').insert({
        pavilion_id: pavilionId,
        event_id: fairId,
        title: 'Empresa Nueva',
        description: 'Descripción básica de la empresa...',
        theme_color: standThemes[stands.length % standThemes.length].hex,
      }).select().single();

      if (error) throw error;

      if (data) {
        setStands([...stands, data]);
        handleEdit(data); // Open editor immediately
      }
    } catch (err: any) {
      console.error('Error al crear stand:', err);
      alert(`Error creando Stand. Posible bloqueo de RLS: ${err.message}`);
    }
  };

  if (!mounted || loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-12">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-4">
          <Link href={`/dashboard/fairs/${fairId}/pavilions`} className="flex items-center gap-2 text-white/40 hover:text-primary transition-colors text-[10px] font-black uppercase tracking-widest group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Volver al Pabellón
          </Link>
          <div>
            <h1 className="text-4xl font-black tracking-tight uppercase mb-2">Gestión de Stands</h1>
            <p className="text-white/40 font-medium">Configurando contenido de <span className="text-secondary/80">{pavilionName}</span></p>
          </div>
        </div>
        <button 
          onClick={handleCreateStand}
          className="flex items-center gap-2 px-6 py-3 bg-primary text-black rounded-2xl font-black uppercase tracking-widest text-[10px] hover:scale-105 transition-all shadow-lg shadow-primary/20"
        >
          <Plus size={16} />
          Añadir Stand
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {stands.map((stand, i) => (
          <motion.div
            key={stand.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="group relative"
          >
             <div
               className="glass relative overflow-hidden rounded-[2.5rem] p-8 border border-white/5 h-full flex flex-col gap-6 transition-all"
               style={{
                 borderColor: "rgba(255,255,255,0.05)",
                 boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05)`,
               }}
             >
                <div
                  className="absolute inset-x-0 top-0 h-1.5"
                  style={{ backgroundColor: getStandCardColor(stand, i) }}
                />
                <div
                  className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full opacity-20 blur-3xl transition-opacity group-hover:opacity-35"
                  style={{ backgroundColor: getStandCardColor(stand, i) }}
                />
                <div className="flex justify-between items-start z-10 w-full mb-4">
                   <div className="flex items-center gap-4">
                      <div
                        className="w-14 h-14 rounded-2xl bg-white/5 border flex items-center justify-center overflow-hidden flex-shrink-0"
                        style={{ borderColor: `${getStandCardColor(stand, i)}55` }}
                      >
                         {stand.logo_url ? (
                           <img src={stand.logo_url} alt="Logo" className="w-full h-full object-contain" />
                         ) : (
                           <Store size={24} style={{ color: getStandCardColor(stand, i) }} />
                         )}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold uppercase tracking-widest leading-none mb-1">{stand.title}</h3>
                        <div className="flex items-center gap-2">
                           <span className={`w-2 h-2 rounded-full ${stand.video_url && stand.pdf_url ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'} shadow-sm`} />
                           <span className="text-[8px] font-black uppercase tracking-widest text-white/30">
                              {stand.video_url && stand.pdf_url ? 'Completado' : 'Pendiente de contenido'}
                           </span>
                        </div>
                      </div>
                   </div>
                   <div className="flex gap-2">
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         handleDeleteStand(stand.id);
                       }}
                       className="p-2 glass rounded-full bg-red-500/10 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all opacity-0 group-hover:opacity-100"
                       title="Eliminar Stand"
                     >
                       <X size={14} />
                     </button>
                     <button 
                       onClick={() => handleEdit(stand)}
                       className="p-2 glass rounded-full bg-white/5 hover:bg-white/20 transition-all opacity-0 group-hover:opacity-100"
                     >
                       <Edit2 size={14} />
                     </button>
                   </div>
                </div>

                <div className="flex items-center gap-4 mt-2">
                   <p className="text-white/40 text-xs leading-relaxed line-clamp-2 italic">{stand.description}</p>
                </div>

                <div className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
                  <span
                    className="h-4 w-4 rounded-full border border-white/30 shadow-lg"
                    style={{
                      backgroundColor: getStandCardColor(stand, i),
                      boxShadow: `0 0 20px ${getStandCardColor(stand, i)}66`,
                    }}
                  />
                  <div className="flex min-w-0 flex-col">
                    <span className="text-[8px] font-black uppercase tracking-widest text-white/30">Color del stand</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/70">{getStandCardColor(stand, i)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-auto pt-6 border-t border-white/5">
                   <div className="flex items-center gap-3">
                      <Video size={14} className={stand.video_url ? "text-primary" : "text-white/10"} />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Video URL</span>
                   </div>
                   <div className="flex items-center gap-3">
                      <FileText size={14} className={stand.pdf_url ? "text-secondary" : "text-white/10"} />
                      <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">PDF Corporativo</span>
                   </div>
                </div>

                <div className="flex items-center justify-between mt-4">
                   <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 text-[9px] font-black uppercase tracking-widest text-white/40 border border-white/5">
                      <UserPlus size={12} />
                      {stand.user_id ? 'Asignado' : 'Sin Expositor'}
                   </div>
                   {stand.video_url && (
                     <a href={stand.video_url} target="_blank" className="text-primary hover:scale-110 transition-transform">
                        <ExternalLink size={14} />
                     </a>
                   )}
                </div>
             </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {editingStand && (
          <div className="fixed inset-0 z-50 flex items-center justify-end">
            <motion.div 
               initial={{ opacity: 0 }} 
               animate={{ opacity: 1 }} 
               exit={{ opacity: 0 }}
               onClick={() => setEditingStand(null)}
               className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl h-full glass border-l border-white/10 flex flex-col shadow-2xl"
            >
               <div className="p-10 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                        <Edit2 size={20} className="text-primary" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black uppercase tracking-tighter">Maquetar Stand</h3>
                        <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Ajustes visuales y de contenido</p>
                     </div>
                  </div>
                  <button onClick={() => setEditingStand(null)} className="p-4 hover:bg-white/5 rounded-full transition-all text-white/30 hover:text-white">
                    <X size={20} />
                  </button>
               </div>

               <div className="flex-1 overflow-y-auto p-10 space-y-10">
                  <Section label="Información Básica">
                     <div className="space-y-6">
                        <Input 
                          label="Título Comercial" 
                          value={editingStand.title || ''} 
                          onChange={(v: string) => setEditingStand({...editingStand, title: v})} 
                        />
                        <Textarea 
                          label="Descripción (Sobre nosotros)" 
                          value={editingStand.description || ''} 
                          onChange={(v: string) => setEditingStand({...editingStand, description: v})} 
                        />
                     </div>
                  </Section>

                  <Section label="Identidad visual del stand">
                     <ColorSelector
                       value={editingStand.theme_color || standThemes[0].hex}
                       onChange={(color: string) => setEditingStand({ ...editingStand, theme_color: color })}
                     />
                  </Section>

                  <Section label="Punto de Contacto Comercial (B2B)">
                     <div className="space-y-6">
                        <Input 
                          label="Página Web de la Empresa" 
                          value={editingStand.website_url || ''} 
                          onChange={(v: string) => setEditingStand({...editingStand, website_url: v})} 
                          placeholder="https://www.miempresa.com"
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           <Input 
                             label="Teléfono" 
                             value={editingStand.phone || ''} 
                             onChange={(v: string) => setEditingStand({...editingStand, phone: v})} 
                             placeholder="+34 600 000 000"
                           />
                           <Input 
                             label="Email de Contacto" 
                             value={editingStand.email || ''} 
                             onChange={(v: string) => setEditingStand({...editingStand, email: v})} 
                             placeholder="contacto@empresa.com"
                           />
                           <Input 
                             label="WhatsApp (Número)" 
                             value={editingStand.whatsapp || ''} 
                             onChange={(v: string) => setEditingStand({...editingStand, whatsapp: v})} 
                             placeholder="Ej: +34..."
                           />
                        </div>
                     </div>
                  </Section>

                  <Section label="Redes Sociales (Opcional)">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Input 
                          label="LinkedIn URL" 
                          value={editingStand.linkedin || ''} 
                          onChange={(v: string) => setEditingStand({...editingStand, linkedin: v})} 
                          placeholder="https://linkedin.com/company/..."
                        />
                        <Input 
                          label="Instagram URL" 
                          value={editingStand.instagram || ''} 
                          onChange={(v: string) => setEditingStand({...editingStand, instagram: v})} 
                          placeholder="https://instagram.com/..."
                        />
                        <Input 
                          label="Facebook URL" 
                          value={editingStand.facebook || ''} 
                          onChange={(v: string) => setEditingStand({...editingStand, facebook: v})} 
                          placeholder="https://facebook.com/..."
                        />
                     </div>
                  </Section>

                  <Section label="Galería de la Empresa (Múltiples Fotos)">
                     <div className="space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                           {editingStand.images?.map((img, i) => (
                             <div key={i} className="relative aspect-video glass rounded-2xl overflow-hidden group border border-white/10 shadow-lg">
                                <img src={img} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <button 
                                     onClick={() => setEditingStand({...editingStand, images: editingStand.images.filter((_, idx) => idx !== i)})}
                                     className="p-2 bg-red-500 rounded-xl text-white shadow-xl hover:scale-110 transition-transform"
                                   >
                                      <Trash2 size={16} />
                                   </button>
                                </div>
                             </div>
                           ))}
                           
                           {/* Botón siempre presente para añadir más */}
                           <div className="aspect-video glass rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center hover:border-primary/40 transition-all group relative overflow-hidden">
                              <div className="flex flex-col items-center gap-2 text-white/20 group-hover:text-primary transition-colors">
                                 <Plus size={24} />
                                 <span className="text-[8px] font-black uppercase tracking-widest">Añadir más</span>
                              </div>
                              <input 
                                 type="file"
                                 accept="image/*"
                                 className="absolute inset-0 opacity-0 cursor-pointer"
                                 onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setUploadingCount(prev => prev + 1);
                                    try {
                                       const fileExt = file.name.split('.').pop();
                                       const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
                                       const { error: uploadError } = await supabase.storage.from('stands_media').upload(fileName, file);
                                       if (uploadError) throw uploadError;
                                       const { data } = supabase.storage.from('stands_media').getPublicUrl(fileName);
                                       setEditingStand({...editingStand, images: [...(editingStand.images || []), data.publicUrl]});
                                    } catch (err: any) {
                                       alert('Error subiendo foto: ' + err.message);
                                    } finally {
                                       setUploadingCount(prev => Math.max(0, prev - 1));
                                    }
                                 }}
                              />
                           </div>
                        </div>
                        <p className="text-[9px] text-white/20 italic uppercase tracking-widest text-center">Puedes subir todas las fotos que necesites para tu catálogo visual.</p>
                     </div>
                  </Section>

                  <Section label="Archivos y Multimedia local">
                     <div className="space-y-6">
                        <FileInput 
                          label="Logo de Empresa (Imagen)"
                          type="image/*"
                          value={editingStand.logo_url}
                          onUploadingState={(isUploading: boolean) => setUploadingCount(prev => isUploading ? prev + 1 : Math.max(0, prev - 1))}
                          onUploadComplete={(url: string) => setEditingStand({...editingStand, logo_url: url})}
                        />
                        <FileInput 
                          label="Catálogo PDF Principal"
                          type="application/pdf"
                          value={editingStand.pdf_url}
                          onUploadingState={(isUploading: boolean) => setUploadingCount(prev => isUploading ? prev + 1 : Math.max(0, prev - 1))}
                          onUploadComplete={(url: string) => setEditingStand({...editingStand, pdf_url: url})}
                        />
                        <FileInput 
                          label="Catálogo PDF Secundario"
                          type="application/pdf"
                          value={editingStand.pdf_url_2}
                          onUploadingState={(isUploading: boolean) => setUploadingCount(prev => isUploading ? prev + 1 : Math.max(0, prev - 1))}
                          onUploadComplete={(url: string) => setEditingStand({...editingStand, pdf_url_2: url})}
                        />
                        <Input 
                          label="Enlace a Vídeo Promocional (YouTube/Vimeo)" 
                          icon={<Video size={14} className="text-primary" />}
                          value={editingStand.video_url || ''} 
                          onChange={(v: string) => setEditingStand({...editingStand, video_url: v})} 
                          placeholder="https://youtube.com/watch?v=..."
                        />
                     </div>
                  </Section>

                  <div className="glass p-6 rounded-3xl border border-primary/10 bg-primary/5 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
                           <UserPlus size={18} className="text-primary" />
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase tracking-widest text-primary/80">Expositor Asignado</p>
                           <p className="text-xs font-bold text-white/60">{editingStand.user_id || 'Usuario no vinculado'}</p>
                        </div>
                     </div>
                     <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border border-white/5">Cambiar</button>
                  </div>
               </div>

               <div className="p-10 border-t border-white/5 bg-black/20 flex gap-4">
                  <button 
                    onClick={() => setEditingStand(null)}
                    className="flex-1 px-8 py-5 rounded-2xl border border-white/5 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest transition-all text-white/40"
                  >
                    Descartar
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSaving || uploadingCount > 0}
                    className="flex-1 px-8 py-5 bg-primary rounded-2xl text-black text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 shadow-lg shadow-primary/20 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:scale-100 disabled:hover:scale-100 disabled:cursor-not-allowed"
                  >
                    {isSaving ? (
                      <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        {uploadingCount > 0 ? 'Subiendo archivos...' : (
                          <>
                            <Save size={16} className="group-hover:scale-110 transition-transform"/>
                            Guardar Cambios
                          </>
                        )}
                      </>
                    )}
                  </button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ColorSelector({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  const normalizedValue = /^#[0-9a-f]{6}$/i.test(value) ? value : standThemes[0].hex;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 shadow-lg"
            style={{ backgroundColor: normalizedValue, boxShadow: `0 0 28px ${normalizedValue}55` }}
          >
            <Palette size={18} className="text-black/70" />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/80">Color del stand</p>
            <p className="text-xs font-bold text-white/35">Se verá en el mapa y al entrar en el stand.</p>
          </div>
        </div>
        <input
          type="text"
          value={normalizedValue}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-28 rounded-xl border border-white/10 bg-black/30 px-3 text-center text-xs font-black uppercase tracking-widest text-white outline-none transition-all focus:border-primary"
          aria-label="Color hexadecimal del stand"
        />
      </div>

      <div className="grid grid-cols-6 gap-3">
        {standThemes.map((theme) => {
          const isActive = normalizedValue.toLowerCase() === theme.hex.toLowerCase();

          return (
            <button
              key={theme.key}
              type="button"
              onClick={() => onChange(theme.hex)}
              className={`h-12 rounded-2xl border transition-all ${isActive ? "scale-105 border-white shadow-lg" : "border-white/10 hover:scale-105 hover:border-white/30"}`}
              style={{
                backgroundColor: theme.hex,
                boxShadow: isActive ? `0 0 30px ${theme.hex}66` : undefined,
              }}
              title={theme.key}
            />
          );
        })}
      </div>
    </div>
  );
}

function getStandCardColor(stand: Stand, index: number) {
  const savedColor = stand.theme_color?.toLowerCase();

  if (savedColor && /^#[0-9a-f]{6}$/i.test(savedColor) && savedColor !== DEFAULT_STAND_THEME_COLOR) {
    return savedColor;
  }

  return standThemes[index % standThemes.length].hex;
}

function Section({ label, children }: any) {
  return (
    <div className="space-y-6">
      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-1">{label}</h4>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, placeholder, icon }: any) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 ml-1">
        {icon}
        <label className="text-[9px] font-black uppercase tracking-widest text-white/40">{label}</label>
      </div>
      <input 
        type="text" 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-primary/30 focus:bg-white/5 transition-all font-bold text-sm"
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: any) {
  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">{label}</label>
      <textarea 
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full bg-white/2 border border-white/5 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 focus:outline-none focus:border-primary/30 focus:bg-white/5 transition-all font-bold text-sm resize-none"
      />
    </div>
  );
}

function FileInput({ label, type, value, onUploadComplete, onUploadingState }: any) {
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    onUploadingState(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('stands_media')
        .upload(fileName, file, {
           cacheControl: '3600',
           upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('stands_media').getPublicUrl(fileName);
      onUploadComplete(data.publicUrl);
    } catch (err: any) {
      console.error('Error en subida:', err);
      alert(`Error al subir archivo: ${err.message}`);
    } finally {
      setIsUploading(false);
      onUploadingState(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-[9px] font-black uppercase tracking-widest text-white/40 ml-1">{label}</label>
      <div className="relative flex items-center mt-2 group">
        <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
          {isUploading ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center border border-white/10">
              {value ? <FileText size={14} className="text-green-400" /> : <Plus size={14} className="text-white/40" />}
            </div>
          )}
        </div>
        <input 
          type="file" 
          accept={type}
          onChange={handleFileChange}
          disabled={isUploading}
          className="block w-full text-sm text-white/60
            file:mr-4 file:py-4 file:px-6 file:rounded-xl file:border-0 file:text-[9px] file:font-black file:uppercase file:tracking-widest file:bg-white/5 file:text-primary file:cursor-pointer hover:file:bg-white/10
            bg-white/2 border border-white/5 rounded-2xl transition-all cursor-pointer file:transition-all focus:outline-none"
        />
      </div>
      {value && (
         <a href={value} target="_blank" className="text-[9px] font-bold text-primary/60 hover:text-primary underline ml-1 mt-1 inline-block">
            Ver archivo actual subido
         </a>
      )}
    </div>
  );
}
