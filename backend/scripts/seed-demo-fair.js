const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.resolve(__dirname, "../.env"));
loadEnv(path.resolve(__dirname, "../../frontend/.env.local"));

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const fallbackColumns = {
  companies: ["id", "name", "logo_url", "description", "website_url", "created_at"],
  events: [
    "id",
    "name",
    "title",
    "slug",
    "status",
    "description",
    "banner_url",
    "start_date",
    "end_date",
    "event_date",
    "visibility",
    "registration_mode",
    "type",
    "zoom_link",
    "created_at",
  ],
  pavilions: ["id", "event_id", "name", "background_url", "created_at"],
  stands: [
    "id",
    "user_id",
    "company_id",
    "event_id",
    "pavilion_id",
    "title",
    "description",
    "video_url",
    "pdf_url",
    "pdf_url_2",
    "logo_url",
    "website_url",
    "phone",
    "whatsapp",
    "linkedin",
    "instagram",
    "facebook",
    "images",
    "theme_color",
    "position_x",
    "position_y",
    "email",
    "created_at",
  ],
};

function filterPayload(payload, columns) {
  const allowed = new Set(columns);
  const result = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && allowed.has(key)) result[key] = value;
  }
  return result;
}

async function getColumns(table) {
  const { data, error } = await supabase.from(table).select("*").limit(1);
  if (error) throw new Error(`Cannot inspect ${table}: ${error.message}`);
  if (data && data[0]) return Object.keys(data[0]);
  return fallbackColumns[table];
}

async function uniqueSlug(baseSlug) {
  let slug = baseSlug;
  for (let index = 2; index < 20; index += 1) {
    const { data, error } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return slug;
    slug = `${baseSlug}-${index}`;
  }
  return `${baseSlug}-${Date.now()}`;
}

const background =
  "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1800&q=80";
const gallery = [
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80",
];

const stands = [
  ["Tecnologia Verde", "EcoGrid AI", "Optimiza consumo energetico con gemelos digitales para edificios, industrias y recintos feriales.", "#16a34a"],
  ["Tecnologia Verde", "SolarHub Iberia", "Soluciones solares modulares para empresas, comunidades energeticas y aparcamientos inteligentes.", "#f59e0b"],
  ["Tecnologia Verde", "AquaSense Labs", "Sensores IoT para ahorrar agua, detectar fugas y medir calidad en tiempo real.", "#0ea5e9"],
  ["Tecnologia Verde", "CarbonTrack Pro", "Plataforma para medir huella de carbono y preparar reportes ESG verificables.", "#22c55e"],
  ["Tecnologia Verde", "Battery Loop", "Sistemas de almacenamiento y segunda vida de baterias para pymes e industria.", "#8b5cf6"],
  ["Tecnologia Verde", "GreenFleet 360", "Gestion de flotas electricas con rutas, carga y mantenimiento predictivo.", "#14b8a6"],
  ["Tecnologia Verde", "BioPack Materials", "Packaging compostable para retail, alimentacion y ecommerce.", "#84cc16"],
  ["Tecnologia Verde", "WindMicro", "Microturbinas urbanas para cubiertas, poligonos y centros logisticos.", "#0284c7"],
  ["Tecnologia Verde", "ReWaste Cloud", "Marketplace B2B para transformar residuos industriales en materias primas.", "#10b981"],
  ["Tecnologia Verde", "SmartCharge Network", "Red inteligente de cargadores con pagos, reservas y analitica de ocupacion.", "#2563eb"],
  ["Salud, Educacion y Smart Cities", "MedAssist Vision", "Triaje asistido por IA para clinicas, aseguradoras y eventos con alta afluencia.", "#ef4444"],
  ["Salud, Educacion y Smart Cities", "EduVerse XR", "Aulas inmersivas para formacion tecnica, onboarding y simulaciones profesionales.", "#7c3aed"],
  ["Salud, Educacion y Smart Cities", "CityFlow Data", "Analitica urbana para movilidad, seguridad peatonal y planificacion municipal.", "#0891b2"],
  ["Salud, Educacion y Smart Cities", "CareHome Connect", "Teleasistencia y sensores para residencias, hospitales y cuidado domiciliario.", "#db2777"],
  ["Salud, Educacion y Smart Cities", "TalentBridge AI", "Matching de talento y formacion continua para empresas tecnologicas.", "#6366f1"],
  ["Salud, Educacion y Smart Cities", "SafeEvent Pulse", "Control de aforo, incidencias y alertas operativas para recintos.", "#f97316"],
  ["Salud, Educacion y Smart Cities", "UrbanTwin Studio", "Gemelos digitales para ayuntamientos, obras y activos inmobiliarios.", "#06b6d4"],
  ["Salud, Educacion y Smart Cities", "NeuroLearn Clinic", "Herramientas digitales para neurorehabilitacion y seguimiento de pacientes.", "#a855f7"],
  ["Salud, Educacion y Smart Cities", "FoodTrace Chain", "Trazabilidad alimentaria con blockchain privado y QR para consumidores.", "#65a30d"],
  ["Salud, Educacion y Smart Cities", "CivicVoice AI", "Asistente ciudadano para tramites, consultas municipales y participacion publica.", "#0f766e"],
];

async function insertOne(table, payload, columns) {
  const { data, error } = await supabase.from(table).insert(filterPayload(payload, columns)).select("*").single();
  if (error) throw new Error(`Insert ${table} failed: ${error.message}`);
  return data;
}

async function main() {
  const [companyCols, eventCols, pavilionCols, standCols] = await Promise.all([
    getColumns("companies"),
    getColumns("events"),
    getColumns("pavilions"),
    getColumns("stands"),
  ]);

  const slug = await uniqueSlug("feria-innovacion-sostenible-2026");
  const startDate = new Date();
  const endDate = new Date(startDate.getTime() + 1000 * 60 * 60 * 24 * 10);

  const event = await insertOne(
    "events",
    {
      name: "Feria Innovacion Sostenible 2026",
      title: "Feria Innovacion Sostenible 2026",
      slug,
      status: "active",
      description:
        "Una feria demo completa con empresas de tecnologia verde, salud digital, educacion inmersiva y smart cities.",
      banner_url: background,
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      event_date: startDate.toISOString(),
      visibility: "public",
      registration_mode: "open",
      zoom_link: "",
    },
    eventCols
  );

  const pavilionPayloads = [
    { event_id: event.id, name: "Tecnologia Verde", background_url: background },
    {
      event_id: event.id,
      name: "Salud, Educacion y Smart Cities",
      background_url:
        "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1800&q=80",
    },
  ];

  const pavilions = [];
  for (const payload of pavilionPayloads) {
    pavilions.push(await insertOne("pavilions", payload, pavilionCols));
  }

  const pavilionByName = new Map(pavilions.map((pavilion) => [pavilion.name, pavilion]));
  const createdStands = [];
  const positions = [
    [18, 26],
    [36, 22],
    [55, 25],
    [74, 29],
    [25, 48],
    [46, 45],
    [66, 50],
    [20, 70],
    [48, 72],
    [74, 69],
  ];

  for (let index = 0; index < stands.length; index += 1) {
    const [pavilionName, companyName, description, themeColor] = stands[index];
    const pavilion = pavilionByName.get(pavilionName);
    const standIndex = index % 10;
    const emailSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
    const logoSeed = encodeURIComponent(companyName);

    const company = await insertOne(
      "companies",
      {
        name: companyName,
        logo_url: `https://api.dicebear.com/9.x/initials/svg?seed=${logoSeed}`,
        description,
        website_url: `https://${emailSlug}.example.com`,
      },
      companyCols
    );

    const stand = await insertOne(
      "stands",
      {
        company_id: company.id,
        event_id: event.id,
        pavilion_id: pavilion.id,
        title: companyName,
        description,
        logo_url: company.logo_url,
        website_url: company.website_url,
        phone: "+34 900 100 200",
        whatsapp: "+34900100200",
        linkedin: `https://linkedin.com/company/${emailSlug}`,
        instagram: `https://instagram.com/${emailSlug.replace(/\./g, "")}`,
        facebook: `https://facebook.com/${emailSlug.replace(/\./g, "")}`,
        email: `contacto@${emailSlug}.example.com`,
        video_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        images: gallery,
        theme_color: themeColor,
        position_x: positions[standIndex][0],
        position_y: positions[standIndex][1],
      },
      standCols
    );

    createdStands.push(stand);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        event: { id: event.id, slug: event.slug || slug, title: event.title || event.name },
        pavilions: pavilions.map((pavilion) => ({ id: pavilion.id, name: pavilion.name })),
        stands: createdStands.length,
        expoUrl: `https://ferias-virtuales.vercel.app/expo/${event.slug || slug}`,
        dashboardUrl: `https://ferias-virtuales.vercel.app/dashboard/fairs/${event.id}/pavilions`,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
