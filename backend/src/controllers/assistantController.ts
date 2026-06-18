import { type Request, type Response } from 'express';
import { supabase } from '../config/supabase';

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type StandContext = {
  id?: string | null;
  title?: string | null;
  description?: string | null;
  video_url?: string | null;
  pdf_url?: string | null;
  pdf_url_2?: string | null;
  website_url?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  pavilion_id?: string | null;
};

type StandRecommendation = {
  id: string;
  title: string;
  pavilion_id?: string | null;
  pavilion_name?: string | null;
  reason: string;
  contact?: string | null;
};

type ExhibitorAction = {
  type: 'reply' | 'faq' | 'improvement';
  title: string;
  stand_title?: string | null;
  detail: string;
  suggested_text?: string;
};

type PavilionContext = {
  id: string;
  name?: string | null;
};

type StandDocumentContext = {
  label?: string | null;
  source_url?: string | null;
  extracted_text?: string | null;
  extraction_status?: string | null;
};

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

export const askFairAssistant = async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').trim();
  const question = String(req.body?.question || '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) as ChatMessage[] : [];

  if (!slug) {
    res.status(400).json({ error: 'Event slug is required' });
    return;
  }

  if (!question) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  try {
    const fairContext = await loadFairContext(slug);

    if (!fairContext.event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const recommendations = getRecommendedStands(question, fairContext);
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.json({
        answer: buildLocalAnswer(question, fairContext),
        recommendations,
        mode: 'local',
      });
      return;
    }

    const contextText = buildContextText(fairContext);
    const messages = [
      {
        role: 'system',
        content: [
          'Eres el asistente oficial de una feria virtual.',
          'Responde en espanol claro, breve y util.',
          'Usa solo el contexto de la feria proporcionado.',
          'Si no sabes algo, dilo y sugiere visitar el stand o contactar con el organizador.',
          'Cuando recomiendes stands, explica en una frase por que encajan.',
        ].join(' '),
      },
      {
        role: 'system',
        content: `Contexto de la feria:\n${contextText}`,
      },
      ...history.map((message) => ({
        role: message.role,
        content: String(message.content || '').slice(0, 1000),
      })),
      {
        role: 'user',
        content: question,
      },
    ];

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 450,
      }),
    });

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      console.warn('[assistant] OpenAI request failed:', detail);
      res.json({
        answer: buildLocalAnswer(question, fairContext),
        mode: 'local',
      });
      return;
    }

    const data = await openaiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();

    res.json({
      answer: answer || buildLocalAnswer(question, fairContext),
      recommendations,
      mode: answer ? 'ai' : 'local',
    });
  } catch (error: unknown) {
    console.error('[assistant] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Assistant error',
    });
  }
};

export const getFairAssistantSuggestions = async (req: Request, res: Response) => {
  const slug = String(req.params.slug || '').trim();

  if (!slug) {
    res.status(400).json({ error: 'Event slug is required' });
    return;
  }

  try {
    const fairContext = await loadFairContext(slug);

    if (!fairContext.event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    res.json({
      suggestions: buildSuggestedQuestions(fairContext),
      mode: 'local',
    });
  } catch (error: unknown) {
    console.error('[assistant-suggestions] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Assistant suggestions error',
    });
  }
};

export const askStandAssistant = async (req: Request, res: Response) => {
  const standId = String(req.params.id || '').trim();
  const question = String(req.body?.question || '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) as ChatMessage[] : [];

  if (!standId) {
    res.status(400).json({ error: 'Stand id is required' });
    return;
  }

  if (!question) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  try {
    const standContext = await loadStandContext(standId);

    if (!standContext.stand) {
      res.status(404).json({ error: 'Stand not found' });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.json({
        answer: buildLocalStandAnswer(question, standContext),
        mode: 'local',
      });
      return;
    }

    const messages = [
      {
        role: 'system',
        content: [
          'Eres el copiloto comercial de un stand dentro de una feria virtual.',
          'Responde en espanol claro, cercano y orientado a ayudar al visitante.',
          'Usa solo el contexto del stand proporcionado.',
          'No inventes precios, condiciones, demos ni servicios que no aparezcan en el contexto.',
          'Si el visitante muestra interes comercial, sugiere usar los datos de contacto disponibles.',
        ].join(' '),
      },
      {
        role: 'system',
        content: `Contexto del stand:\n${buildStandContextText(standContext)}`,
      },
      ...history.map((message) => ({
        role: message.role,
        content: String(message.content || '').slice(0, 1000),
      })),
      {
        role: 'user',
        content: question,
      },
    ];

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        temperature: 0.25,
        max_tokens: 420,
      }),
    });

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      console.warn('[stand-assistant] OpenAI request failed:', detail);
      res.json({
        answer: buildLocalStandAnswer(question, standContext),
        mode: 'local',
      });
      return;
    }

    const data = await openaiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();

    res.json({
      answer: answer || buildLocalStandAnswer(question, standContext),
      mode: answer ? 'ai' : 'local',
    });
  } catch (error: unknown) {
    console.error('[stand-assistant] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Stand assistant error',
    });
  }
};

export const getAnalyticsInsights = async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId || '').trim();

  if (!eventId) {
    res.status(400).json({ error: 'Event id is required' });
    return;
  }

  try {
    const context = await loadAnalyticsContext(eventId);

    if (!context.summary) {
      res.status(404).json({ error: 'Analytics not found' });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.json({
        insights: buildLocalAnalyticsInsights(context),
        mode: 'local',
      });
      return;
    }

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: [
              'Eres un analista senior de ferias virtuales.',
              'Genera insights ejecutivos en espanol para el organizador.',
              'Devuelve solo JSON valido con esta forma exacta:',
              '{"summary":"...","opportunities":["..."],"risks":["..."],"next_actions":["..."]}',
              'No inventes metricas fuera del contexto.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Datos de la feria:\n${JSON.stringify(context, null, 2)}`,
          },
        ],
        temperature: 0.25,
        max_tokens: 650,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      console.warn('[analytics-insights] OpenAI request failed:', detail);
      res.json({
        insights: buildLocalAnalyticsInsights(context),
        mode: 'local',
      });
      return;
    }

    const data = await openaiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      res.json({
        insights: buildLocalAnalyticsInsights(context),
        mode: 'local',
      });
      return;
    }

    res.json({
      insights: JSON.parse(content),
      mode: 'ai',
    });
  } catch (error: unknown) {
    console.error('[analytics-insights] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Analytics insights error',
    });
  }
};

export const askAnalyticsAssistant = async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId || '').trim();
  const question = String(req.body?.question || '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) as ChatMessage[] : [];

  if (!eventId) {
    res.status(400).json({ error: 'Event id is required' });
    return;
  }

  if (!question) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  try {
    const context = await loadAnalyticsContext(eventId);

    if (!context.summary) {
      res.status(404).json({ error: 'Analytics not found' });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.json({
        answer: buildLocalAdminAnswer(question, context),
        mode: 'local',
      });
      return;
    }

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: [
              'Eres el copiloto IA del administrador de una feria virtual.',
              'Responde en espanol, con criterio ejecutivo y acciones concretas.',
              'Usa solo los datos disponibles en el contexto.',
              'Si faltan datos, dilo y explica que medicion activaria.',
              'Prioriza leads, conversion, stands con traccion, pabellones flojos y preguntas frecuentes de visitantes.',
            ].join(' '),
          },
          {
            role: 'system',
            content: `Contexto analitico de la feria:\n${JSON.stringify(context, null, 2)}`,
          },
          ...history.map((message) => ({
            role: message.role,
            content: String(message.content || '').slice(0, 1000),
          })),
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.25,
        max_tokens: 520,
      }),
    });

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      console.warn('[admin-assistant] OpenAI request failed:', detail);
      res.json({
        answer: buildLocalAdminAnswer(question, context),
        mode: 'local',
      });
      return;
    }

    const data = await openaiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();

    res.json({
      answer: answer || buildLocalAdminAnswer(question, context),
      mode: answer ? 'ai' : 'local',
    });
  } catch (error: unknown) {
    console.error('[admin-assistant] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Admin assistant error',
    });
  }
};

export const askExhibitorAssistant = async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId || '').trim();
  const question = String(req.body?.question || '').trim();
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-6) as ChatMessage[] : [];

  if (!eventId) {
    res.status(400).json({ error: 'Event id is required' });
    return;
  }

  if (!question) {
    res.status(400).json({ error: 'Question is required' });
    return;
  }

  try {
    const context = await loadExhibitorContext(eventId);

    if (!context.event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      res.json({
        answer: buildLocalExhibitorAnswer(question, context),
        actions: buildExhibitorActions(context),
        mode: 'local',
      });
      return;
    }

    const openaiResponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: [
              'Eres el copiloto IA de un expositor en una feria virtual.',
              'Tu objetivo es convertir actividad del stand en acciones comerciales concretas.',
              'Responde en espanol claro, directo y accionable.',
              'Usa solo el contexto proporcionado: leads, mensajes, stands y actividad.',
              'Prioriza respuestas pendientes, leads calientes, preguntas frecuentes y mejoras de CTA.',
            ].join(' '),
          },
          {
            role: 'system',
            content: `Contexto comercial del expositor:\n${JSON.stringify(context, null, 2)}`,
          },
          ...history.map((message) => ({
            role: message.role,
            content: String(message.content || '').slice(0, 1000),
          })),
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.25,
        max_tokens: 560,
      }),
    });

    if (!openaiResponse.ok) {
      const detail = await openaiResponse.text();
      console.warn('[exhibitor-assistant] OpenAI request failed:', detail);
      res.json({
        answer: buildLocalExhibitorAnswer(question, context),
        actions: buildExhibitorActions(context),
        mode: 'local',
      });
      return;
    }

    const data = await openaiResponse.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content?.trim();

    res.json({
      answer: answer || buildLocalExhibitorAnswer(question, context),
      actions: buildExhibitorActions(context),
      mode: answer ? 'ai' : 'local',
    });
  } catch (error: unknown) {
    console.error('[exhibitor-assistant] Error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Exhibitor assistant error',
    });
  }
};

async function loadFairContext(slug: string) {
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id,title,description,slug,status,type,event_date,zoom_link')
    .eq('slug', slug)
    .single();

  if (eventError || !event) {
    return { event: null, pavilions: [] as PavilionContext[], stands: [] as StandContext[] };
  }

  const [{ data: pavilions }, { data: stands }] = await Promise.all([
    supabase
      .from('pavilions')
      .select('id,name')
      .eq('event_id', event.id),
    supabase
      .from('stands')
      .select('id,title,description,video_url,pdf_url,pdf_url_2,website_url,email,phone,whatsapp,linkedin,instagram,facebook,pavilion_id')
      .eq('event_id', event.id),
  ]);

  return {
    event,
    pavilions: (pavilions || []) as PavilionContext[],
    stands: (stands || []) as StandContext[],
  };
}

async function loadStandContext(standId: string) {
  const { data: stand, error: standError } = await supabase
    .from('stands')
    .select('id,event_id,pavilion_id,title,description,video_url,pdf_url,pdf_url_2,website_url,email,phone,whatsapp,linkedin,instagram,facebook')
    .eq('id', standId)
    .single();

  if (standError || !stand) {
    return {
      stand: null,
      event: null,
      pavilion: null,
    };
  }

  const [{ data: event }, { data: pavilion }] = await Promise.all([
    supabase
      .from('events')
      .select('id,title,description,slug')
      .eq('id', stand.event_id)
      .maybeSingle(),
    supabase
      .from('pavilions')
      .select('id,name')
      .eq('id', stand.pavilion_id)
      .maybeSingle(),
  ]);

  return {
    stand: stand as StandContext,
    event,
    pavilion,
    documents: await loadStandDocuments(standId),
  };
}

async function loadStandDocuments(standId: string) {
  const { data } = await supabase
    .from('stand_documents')
    .select('label,source_url,extracted_text,extraction_status')
    .eq('stand_id', standId)
    .eq('extraction_status', 'ready');

  return (data || []) as StandDocumentContext[];
}

async function loadAnalyticsContext(eventId: string) {
  const [
    { data: summary },
    { data: pavilions },
    { data: stands },
    { data: questions },
    { data: leads },
    { data: tasks },
    { data: standContacts },
    { data: opportunities },
  ] = await Promise.all([
    supabase.from('fair_analytics_summary').select('*').eq('event_id', eventId).maybeSingle(),
    supabase.from('pavilion_analytics_summary').select('*').eq('event_id', eventId).order('visits', { ascending: false }),
    supabase.from('stand_analytics_summary').select('*').eq('event_id', eventId).order('views', { ascending: false }).limit(10),
    supabase
      .from('analytics_events')
      .select('action,metadata,created_at')
      .eq('event_id', eventId)
      .in('action', ['chat_message_sent', 'stand_cta_clicked', 'document_opened'])
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('stand_leads')
      .select('action,metadata,created_at,stand_id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('exhibitor_tasks')
      .select('id,stand_id,type,status,title,stand_title,detail,created_at,completed_at')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('stands')
      .select('id,title,email,phone,whatsapp,website_url')
      .eq('event_id', eventId),
    supabase
      .from('commercial_opportunities')
      .select('id,stand_id,status,priority,title,stand_title,contact_label,updated_at')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);

  return {
    summary,
    pavilions: pavilions || [],
    stands: stands || [],
    recent_questions: (questions || []).map((event) => ({
      action: event.action,
      question: event.metadata?.question,
      assistant_mode: event.metadata?.assistant_mode,
      created_at: event.created_at,
    })),
    recent_leads: leads || [],
    commercial_tasks: tasks || [],
    commercial_alerts: buildCommercialAlertsForAdmin(leads || [], tasks || [], stands || [], standContacts || []),
    commercial_opportunities: opportunities || [],
  };
}

async function loadExhibitorContext(eventId: string) {
  const { data: event } = await supabase
    .from('events')
    .select('id,title,slug,description')
    .eq('id', eventId)
    .maybeSingle();

  if (!event) {
    return {
      event: null,
      stands: [],
      leads: [],
      messages: [],
      stand_metrics: [],
      opportunities: [],
    };
  }

  const { data: stands } = await supabase
    .from('stands')
    .select('id,title,description,email,phone,whatsapp,website_url')
    .eq('event_id', eventId)
    .order('title', { ascending: true });

  const standRows = stands || [];
  const rooms = standRows.map((stand) => `stand:${stand.id}`);

  const [{ data: leads }, { data: messages }, { data: metrics }, { data: opportunities }] = await Promise.all([
    supabase
      .from('stand_leads')
      .select('action,metadata,created_at,stand_id')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(80),
    rooms.length
      ? supabase
          .from('messages')
          .select('user_name,content,room,created_at')
          .in('room', rooms)
          .order('created_at', { ascending: false })
          .limit(80)
      : Promise.resolve({ data: [] }),
    supabase
      .from('stand_analytics_summary')
      .select('*')
      .eq('event_id', eventId)
      .order('views', { ascending: false }),
    supabase
      .from('commercial_opportunities')
      .select('id,stand_id,status,priority,title,stand_title,contact_label,next_step,notes,updated_at')
      .eq('event_id', eventId)
      .order('updated_at', { ascending: false })
      .limit(100),
  ]);

  const standTitleById = new Map(standRows.map((stand) => [stand.id, stand.title || 'Stand sin titulo']));

  return {
    event,
    stands: standRows,
    leads: (leads || []).map((lead) => ({
      ...lead,
      stand_title: standTitleById.get(lead.stand_id) || 'Stand sin titulo',
    })),
    messages: (messages || []).map((message) => {
      const standId = String(message.room || '').replace('stand:', '');
      return {
        ...message,
        stand_id: standId,
        stand_title: standTitleById.get(standId) || 'Stand sin titulo',
      };
    }),
    stand_metrics: metrics || [],
    opportunities: opportunities || [],
  };
}

function buildContextText(fairContext: Awaited<ReturnType<typeof loadFairContext>>) {
  const pavilionNameById = new Map(fairContext.pavilions.map((pavilion) => [pavilion.id, pavilion.name || 'Pabellon']));
  const standsText = fairContext.stands.map((stand, index) => {
    const contacts = [
      stand.website_url ? `web: ${stand.website_url}` : '',
      stand.email ? `email: ${stand.email}` : '',
      stand.phone ? `telefono: ${stand.phone}` : '',
      stand.whatsapp ? `whatsapp: ${stand.whatsapp}` : '',
      stand.linkedin ? `linkedin: ${stand.linkedin}` : '',
    ].filter(Boolean).join(', ');

    return [
      `${index + 1}. ${stand.title || 'Stand sin titulo'}`,
      `Pabellon: ${pavilionNameById.get(stand.pavilion_id || '') || 'Sin pabellon'}`,
      `Descripcion: ${stand.description || 'Sin descripcion'}`,
      contacts ? `Contacto: ${contacts}` : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  return [
    `Evento: ${fairContext.event?.title || 'Feria virtual'}`,
    `Descripcion: ${fairContext.event?.description || 'Sin descripcion'}`,
    `Fecha: ${fairContext.event?.event_date || 'Sin fecha definida'}`,
    `Pabellones: ${fairContext.pavilions.map((pavilion) => pavilion.name).filter(Boolean).join(', ') || 'Sin pabellones'}`,
    `Stands:\n${standsText || 'Sin stands publicados'}`,
  ].join('\n');
}

function buildStandContextText(standContext: Awaited<ReturnType<typeof loadStandContext>>) {
  const stand = standContext.stand;
  const resources = [
    stand?.video_url ? `Video: ${stand.video_url}` : '',
    stand?.pdf_url ? `Catalogo principal: ${stand.pdf_url}` : '',
    stand?.pdf_url_2 ? `Documentacion extra: ${stand.pdf_url_2}` : '',
  ].filter(Boolean).join('\n');
  const contacts = [
    stand?.website_url ? `Web: ${stand.website_url}` : '',
    stand?.email ? `Email: ${stand.email}` : '',
    stand?.phone ? `Telefono: ${stand.phone}` : '',
    stand?.whatsapp ? `WhatsApp: ${stand.whatsapp}` : '',
    stand?.linkedin ? `LinkedIn: ${stand.linkedin}` : '',
    stand?.instagram ? `Instagram: ${stand.instagram}` : '',
    stand?.facebook ? `Facebook: ${stand.facebook}` : '',
  ].filter(Boolean).join('\n');
  const documentText = (standContext.documents || [])
    .map((doc, index) => [
      `Documento ${index + 1}: ${doc.label || 'Documento'}`,
      `URL: ${doc.source_url || 'Sin URL'}`,
      `Texto extraido:\n${(doc.extracted_text || '').slice(0, 8000)}`,
    ].join('\n'))
    .join('\n\n');

  return [
    `Feria: ${standContext.event?.title || 'Feria virtual'}`,
    `Pabellon: ${standContext.pavilion?.name || 'Sin pabellon'}`,
    `Stand: ${stand?.title || 'Stand sin titulo'}`,
    `Descripcion: ${stand?.description || 'Sin descripcion'}`,
    resources ? `Recursos:\n${resources}` : 'Recursos: sin recursos configurados',
    contacts ? `Contacto:\n${contacts}` : 'Contacto: sin datos de contacto configurados',
    documentText ? `Contenido de PDFs sincronizados:\n${documentText}` : 'Contenido de PDFs sincronizados: no hay texto extraido todavia',
  ].join('\n');
}

function buildLocalAnswer(question: string, fairContext: Awaited<ReturnType<typeof loadFairContext>>) {
  const normalizedQuestion = normalize(question);
  const pavilionNameById = new Map(fairContext.pavilions.map((pavilion) => [pavilion.id, pavilion.name || 'Pabellon']));
  const matchingStands = fairContext.stands
    .map((stand) => ({
      stand,
      score: scoreStand(normalizedQuestion, stand),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  if (matchingStands.length > 0) {
    return [
      `He encontrado ${matchingStands.length === 1 ? 'un stand que encaja' : 'varios stands que encajan'} con tu consulta:`,
      ...matchingStands.map(({ stand }) => {
        const pavilion = pavilionNameById.get(stand.pavilion_id || '') || 'pabellon sin nombre';
        const contact = stand.website_url || stand.email || stand.whatsapp || stand.phone || '';
        return `- ${stand.title || 'Stand sin titulo'} (${pavilion}). ${stand.description || 'Sin descripcion.'}${contact ? ` Contacto: ${contact}` : ''}`;
      }),
      'Puedes abrir el stand desde el pabellon para ver sus recursos y datos de contacto.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('pabellon') || normalizedQuestion.includes('stand') || normalizedQuestion.includes('empresa')) {
    const standNames = fairContext.stands.slice(0, 8).map((stand) => stand.title).filter(Boolean);
    return standNames.length > 0
      ? `En esta feria tienes estos stands destacados: ${standNames.join(', ')}. Preguntame por un sector, una empresa o una necesidad concreta y te recomiendo donde ir.`
      : 'Todavia no hay stands publicados en esta feria.';
  }

  if (normalizedQuestion.includes('auditorio') || normalizedQuestion.includes('charla') || normalizedQuestion.includes('ponencia')) {
    return fairContext.event?.zoom_link
      ? `El auditorio esta disponible desde la feria. Tambien hay enlace de sesion configurado: ${fairContext.event.zoom_link}`
      : 'Puedes entrar al Auditorio Principal desde el selector superior de la feria. Aun no veo un enlace externo de charla configurado.';
  }

  return [
    `Soy el asistente de ${fairContext.event?.title || 'esta feria'}.`,
    'Puedo recomendarte stands, orientarte por pabellones, ayudarte a encontrar contactos o explicarte donde esta el auditorio.',
    'Prueba con: "recomiendame stands de IA", "que empresas hay" o "donde veo las charlas".',
  ].join(' ');
}

function buildSuggestedQuestions(fairContext: Awaited<ReturnType<typeof loadFairContext>>) {
  const standNames = fairContext.stands
    .map((stand) => stand.title)
    .filter(Boolean)
    .slice(0, 3) as string[];
  const pavilionNames = fairContext.pavilions
    .map((pavilion) => pavilion.name)
    .filter(Boolean)
    .slice(0, 2) as string[];

  return [
    standNames[0] ? `Que ofrece ${standNames[0]}?` : 'Recomiendame stands destacados',
    standNames[1] ? `Con quien contacto en ${standNames[1]}?` : 'Que empresas hay en la feria?',
    pavilionNames[0] ? `Que encuentro en ${pavilionNames[0]}?` : 'Donde esta el auditorio?',
    'Busco soluciones de IA o tecnologia',
  ].slice(0, 4);
}

function getRecommendedStands(question: string, fairContext: Awaited<ReturnType<typeof loadFairContext>>): StandRecommendation[] {
  const normalizedQuestion = normalize(question);
  const pavilionNameById = new Map(fairContext.pavilions.map((pavilion) => [pavilion.id, pavilion.name || 'Pabellon']));

  return fairContext.stands
    .map((stand) => ({
      stand,
      score: scoreStand(normalizedQuestion, stand),
    }))
    .filter((item) => item.score > 0 && item.stand.id)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ stand }) => {
      const contact = stand.website_url || stand.email || stand.whatsapp || stand.phone || null;
      return {
        id: stand.id!,
        title: stand.title || 'Stand sin titulo',
        pavilion_id: stand.pavilion_id || null,
        pavilion_name: pavilionNameById.get(stand.pavilion_id || '') || 'Pabellon sin nombre',
        reason: stand.description
          ? stand.description.slice(0, 150)
          : 'Encaja con los terminos de tu consulta y puede ser un buen punto de partida.',
        contact,
      };
    });
}

function buildLocalStandAnswer(question: string, standContext: Awaited<ReturnType<typeof loadStandContext>>) {
  const stand = standContext.stand;
  const normalizedQuestion = normalize(question);
  const contacts = [
    stand?.website_url ? `web: ${stand.website_url}` : '',
    stand?.email ? `email: ${stand.email}` : '',
    stand?.phone ? `telefono: ${stand.phone}` : '',
    stand?.whatsapp ? `whatsapp: ${stand.whatsapp}` : '',
  ].filter(Boolean);

  if (normalizedQuestion.includes('contact') || normalizedQuestion.includes('email') || normalizedQuestion.includes('telefono') || normalizedQuestion.includes('whatsapp')) {
    return contacts.length > 0
      ? `Puedes contactar con ${stand?.title || 'este stand'} por ${contacts.join(', ')}.`
      : 'Este stand todavia no tiene datos de contacto publicados.';
  }

  if (normalizedQuestion.includes('pdf') || normalizedQuestion.includes('catalogo') || normalizedQuestion.includes('document')) {
    const syncedDocs = (standContext.documents || []).filter((doc) => doc.extracted_text);
    if (syncedDocs.length > 0) {
      const snippets = syncedDocs
        .map((doc) => `${doc.label || 'Documento'}: ${(doc.extracted_text || '').slice(0, 700)}`)
        .join('\n\n');
      return `Tengo texto extraido de ${syncedDocs.length} documento(s):\n\n${snippets}`;
    }

    const docs = [
      stand?.pdf_url ? `catalogo principal: ${stand.pdf_url}` : '',
      stand?.pdf_url_2 ? `documentacion extra: ${stand.pdf_url_2}` : '',
    ].filter(Boolean);

    return docs.length > 0
      ? `Este stand tiene ${docs.join(' y ')}. Puedes abrirlos desde la seccion Descargables del stand.`
      : 'Este stand no tiene PDFs o catalogos configurados todavia.';
  }

  if (normalizedQuestion.includes('video') || normalizedQuestion.includes('demo')) {
    return stand?.video_url
      ? `Este stand tiene un video configurado en su pantalla principal: ${stand.video_url}`
      : 'Este stand aun no tiene video configurado.';
  }

  return [
    `${stand?.title || 'Este stand'} esta en ${standContext.pavilion?.name || 'la feria'}.`,
    stand?.description || 'Aun no hay una descripcion publicada para este stand.',
    contacts.length > 0 ? `Datos de contacto: ${contacts.join(', ')}.` : 'No veo datos de contacto publicados todavia.',
  ].join(' ');
}

function buildLocalAnalyticsInsights(context: Awaited<ReturnType<typeof loadAnalyticsContext>>) {
  const summary = context.summary as {
    fair_entries?: number;
    unique_visitors?: number;
    stand_views?: number;
    leads?: number;
    registered_participants?: number;
  } | null;
  const topStand = context.stands?.[0] as { stand_title?: string; views?: number; leads?: number } | undefined;
  const topPavilion = context.pavilions?.[0] as { pavilion_name?: string; visits?: number } | undefined;
  const commercialTasks = context.commercial_tasks || [];
  const commercialAlerts = context.commercial_alerts || [];
  const commercialOpportunities = context.commercial_opportunities || [];
  const criticalAlerts = commercialAlerts.filter((alert: any) => alert.severity === 'critical');
  const warningAlerts = commercialAlerts.filter((alert: any) => alert.severity === 'warning');
  const pendingTasks = commercialTasks.filter((task: any) => task.status === 'todo');
  const completedTasks = commercialTasks.filter((task: any) => task.status === 'done');
  const meetings = commercialOpportunities.filter((item: any) => item.status === 'meeting_scheduled').length;
  const won = commercialOpportunities.filter((item: any) => item.status === 'won').length;

  return {
    summary: `La feria acumula ${summary?.fair_entries || 0} entradas, ${summary?.stand_views || 0} vistas de stands, ${summary?.leads || 0} leads, ${commercialOpportunities.length} oportunidades, ${pendingTasks.length} tareas pendientes y ${criticalAlerts.length} alertas criticas.`,
    opportunities: [
      topStand ? `Potenciar el stand ${topStand.stand_title}, que concentra la mayor actividad con ${topStand.views || 0} vistas.` : 'Publicar y promocionar stands para empezar a generar datos comparables.',
      topPavilion ? `Revisar la ubicacion y contenido del ${topPavilion.pavilion_name}, ahora mismo el pabellon con mas visitas.` : 'Crear al menos un pabellon con oferta clara para orientar a los visitantes.',
      commercialOpportunities.length ? `Seguir el pipeline: ${meetings} reuniones agendadas y ${won} oportunidades ganadas.` : 'Activar el pipeline comercial importando leads como oportunidades.',
      commercialTasks.length ? `Usar el plan comercial IA: ${completedTasks.length} tareas completadas y ${pendingTasks.length} pendientes.` : 'Pedir a los expositores que guarden acciones IA como tareas para medir seguimiento comercial.',
      context.recent_questions?.length ? 'Usar las preguntas al asistente para ajustar textos comerciales y FAQs de la feria.' : 'Promover el uso del asistente IA con preguntas sugeridas visibles.',
    ],
    risks: [
      (summary?.leads || 0) === 0 ? 'Hay visitas pero todavia no hay leads, conviene reforzar llamadas a contacto en los stands.' : 'Revisar si los leads se estan atendiendo con rapidez.',
      criticalAlerts[0] ? `Alerta critica: ${criticalAlerts[0].title}${criticalAlerts[0].stand_title ? ` en ${criticalAlerts[0].stand_title}` : ''}.` : 'No hay alertas criticas de seguimiento comercial.',
      warningAlerts[0] ? `Aviso: ${warningAlerts[0].title}${warningAlerts[0].stand_title ? ` en ${warningAlerts[0].stand_title}` : ''}.` : 'No hay avisos comerciales relevantes.',
      pendingTasks.length > 0 ? `Hay ${pendingTasks.length} tareas comerciales pendientes; pueden representar leads sin seguimiento.` : 'No hay tareas comerciales pendientes visibles.',
      (summary?.registered_participants || 0) === 0 ? 'No hay participantes registrados en la vista agregada, revisa acceso e invitaciones.' : 'Mantener control de aprobaciones e invitaciones para no perder asistentes.',
    ],
    next_actions: [
      'Revisar los 3 stands mas visitados y mejorar sus llamadas a la accion.',
      pendingTasks[0] ? `Cerrar primero la tarea pendiente: ${pendingTasks[0].title}${pendingTasks[0].stand_title ? ` en ${pendingTasks[0].stand_title}` : ''}.` : 'Mantener el plan comercial IA sin tareas vencidas.',
      'Convertir las preguntas frecuentes del asistente en contenido visible dentro de cada stand.',
      'Medir de nuevo despues de la siguiente tanda de invitaciones.',
    ],
  };
}

function buildLocalAdminAnswer(question: string, context: Awaited<ReturnType<typeof loadAnalyticsContext>>) {
  const normalizedQuestion = normalize(question);
  const summary = context.summary as {
    fair_entries?: number;
    unique_visitors?: number;
    stand_views?: number;
    leads?: number;
    pavilion_entries?: number;
    registered_participants?: number;
  } | null;
  const topStand = context.stands?.[0] as { stand_title?: string; views?: number; leads?: number; unique_visitors?: number } | undefined;
  const topPavilion = context.pavilions?.[0] as { pavilion_name?: string; visits?: number; unique_visitors?: number } | undefined;
  const commercialTasks = context.commercial_tasks || [];
  const commercialAlerts = context.commercial_alerts || [];
  const commercialOpportunities = context.commercial_opportunities || [];
  const criticalAlerts = commercialAlerts.filter((alert: any) => alert.severity === 'critical');
  const warningAlerts = commercialAlerts.filter((alert: any) => alert.severity === 'warning');
  const pendingTasks = commercialTasks.filter((task: any) => task.status === 'todo');
  const completedTasks = commercialTasks.filter((task: any) => task.status === 'done');
  const meetings = commercialOpportunities.filter((item: any) => item.status === 'meeting_scheduled');
  const won = commercialOpportunities.filter((item: any) => item.status === 'won');
  const stalled = commercialOpportunities.filter((item: any) => item.status === 'contact_pending');
  const lowLeadStands = (context.stands || [])
    .filter((stand: any) => (stand.views || 0) > 0 && (stand.leads || 0) === 0)
    .slice(0, 3) as Array<{ stand_title?: string; views?: number; leads?: number }>;

  if (normalizedQuestion.includes('lead') || normalizedQuestion.includes('conversion') || normalizedQuestion.includes('contact')) {
    return [
      `Ahora mismo hay ${summary?.leads || 0} leads y ${summary?.stand_views || 0} vistas de stands.`,
      `Seguimiento comercial: ${pendingTasks.length} tareas pendientes y ${completedTasks.length} completadas.`,
      lowLeadStands.length
        ? `Prioridad: mejorar llamadas a contacto en ${lowLeadStands.map((stand) => `${stand.stand_title} (${stand.views || 0} vistas, 0 leads)`).join(', ')}.`
        : 'No veo stands con visitas sin leads en el top actual, asi que conviene aumentar trafico cualificado.',
      'Acciones: colocar CTA visible en el stand, abrir chat del stand, pedir reunion/WhatsApp y revisar que email/web esten publicados.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('tarea') || normalizedQuestion.includes('seguimiento') || normalizedQuestion.includes('expositor') || normalizedQuestion.includes('pendiente')) {
    const pendingText = pendingTasks
      .slice(0, 5)
      .map((task: any) => `${task.title}${task.stand_title ? ` (${task.stand_title})` : ''}`)
      .join(', ');

    return [
      `Plan comercial IA: ${commercialTasks.length} tareas totales, ${pendingTasks.length} pendientes y ${completedTasks.length} completadas.`,
      pendingTasks.length ? `Prioridad: cerrar estas tareas primero: ${pendingText}.` : 'No hay tareas pendientes; buen estado de seguimiento.',
      'Recomendacion: revisar diariamente pendientes por stand y pedir al expositor que marque como hecha cada accion cuando contacte al lead.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('alerta') || normalizedQuestion.includes('semaforo') || normalizedQuestion.includes('riesgo') || normalizedQuestion.includes('critico')) {
    const alertText = commercialAlerts
      .slice(0, 6)
      .map((alert: any) => `${alert.severity.toUpperCase()}: ${alert.title}${alert.stand_title ? ` (${alert.stand_title})` : ''}`)
      .join(' | ');

    return [
      `Semaforos comerciales: ${criticalAlerts.length} criticos, ${warningAlerts.length} avisos y ${commercialAlerts.length} alertas totales.`,
      alertText || 'No hay alertas comerciales relevantes con los datos actuales.',
      criticalAlerts.length ? 'Prioridad: cerrar primero los leads sin tarea y las tareas pendientes antiguas.' : 'Mantener revision diaria para que no se acumulen tareas pendientes.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('pipeline') || normalizedQuestion.includes('crm') || normalizedQuestion.includes('oportunidad') || normalizedQuestion.includes('reunion') || normalizedQuestion.includes('ganad')) {
    const stalledText = stalled
      .slice(0, 5)
      .map((item: any) => `${item.title}${item.stand_title ? ` (${item.stand_title})` : ''}`)
      .join(', ');

    return [
      `Pipeline comercial: ${commercialOpportunities.length} oportunidades, ${meetings.length} reuniones y ${won.length} ganadas.`,
      stalled.length ? `Atascadas en contactar: ${stalledText}.` : 'No hay oportunidades atascadas en contactar.',
      'Accion recomendada: revisar los estados Contactar e Interesados cada dia y mover a Reunion cuando haya compromiso real.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('stand') || normalizedQuestion.includes('potenciar') || normalizedQuestion.includes('mejor')) {
    return topStand
      ? `El stand a potenciar primero es ${topStand.stand_title}: acumula ${topStand.views || 0} vistas, ${topStand.unique_visitors || 0} visitantes unicos y ${topStand.leads || 0} leads. Revisaria su mensaje principal, CTA y documentos descargables para convertir mejor ese trafico.`
      : 'Todavia no hay datos suficientes de stands. Promociona la feria y genera primeras visitas para comparar rendimiento.';
  }

  if (normalizedQuestion.includes('pabellon') || normalizedQuestion.includes('trafico')) {
    return topPavilion
      ? `El pabellon con mas traccion es ${topPavilion.pavilion_name}, con ${topPavilion.visits || 0} visitas y ${topPavilion.unique_visitors || 0} visitantes unicos. Usalo como referencia para ordenar stands y replicar contenido en pabellones con menos actividad.`
      : 'Aun no hay datos suficientes de pabellones. Necesitamos mas entradas o eventos de navegacion.';
  }

  if (normalizedQuestion.includes('pregunta') || normalizedQuestion.includes('asistente') || normalizedQuestion.includes('faq')) {
    const questions = (context.recent_questions || [])
      .map((item: any) => item.question)
      .filter(Boolean)
      .slice(0, 5);

    return questions.length
      ? `Preguntas recientes al asistente: ${questions.join(' | ')}. Convierte esas dudas en FAQs visibles y en sugerencias del asistente.`
      : 'Todavia no hay suficientes preguntas registradas. Haria mas visible el boton de IA y anadiria sugerencias concretas por sector.';
  }

  return [
    `Resumen: ${summary?.fair_entries || 0} entradas, ${summary?.unique_visitors || 0} visitantes unicos, ${summary?.stand_views || 0} vistas de stands y ${summary?.leads || 0} leads.`,
    `Pipeline comercial: ${commercialOpportunities.length} oportunidades, ${meetings.length} reuniones y ${won.length} ganadas.`,
    `Plan comercial IA: ${pendingTasks.length} tareas pendientes y ${completedTasks.length} completadas.`,
    topStand ? `Stand con mas traccion: ${topStand.stand_title}.` : 'Aun no hay stand dominante.',
    topPavilion ? `Pabellon con mas actividad: ${topPavilion.pavilion_name}.` : 'Aun no hay pabellon dominante.',
    'Puedes preguntarme: que stand potenciar, como generar mas leads, que pabellon revisar o que preguntas hacen los visitantes.',
  ].join('\n');
}

function buildCommercialAlertsForAdmin(leads: any[], tasks: any[], stands: any[], standContacts: any[]) {
  const alerts: Array<{
    id: string;
    severity: 'critical' | 'warning' | 'info';
    title: string;
    detail: string;
    stand_title?: string | null;
  }> = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const standTitleById = new Map<string, string>();

  standContacts.forEach((stand) => {
    standTitleById.set(String(stand.id), stand.title || 'Stand sin titulo');
  });
  stands.forEach((stand) => {
    standTitleById.set(String(stand.stand_id), stand.stand_title || 'Stand sin titulo');
  });

  const taskStandKeys = new Set(
    tasks
      .map((task) => task.stand_id || task.stand_title || '')
      .filter(Boolean)
      .map(String)
  );
  const leadStands = new Map<string, any[]>();

  leads.forEach((lead) => {
    const standId = String(lead.stand_id || '');
    if (!standId) return;
    const current = leadStands.get(standId) || [];
    leadStands.set(standId, [...current, lead]);
  });

  leadStands.forEach((standLeads, standId) => {
    const standTitle = standTitleById.get(standId) || 'Stand sin titulo';
    const hasTask = taskStandKeys.has(standId) || taskStandKeys.has(standTitle);
    if (!hasTask) {
      alerts.push({
        id: `lead-no-task-${standId}`,
        severity: 'critical',
        title: 'Leads sin tarea comercial',
        stand_title: standTitle,
        detail: `${standLeads.length} lead(s) registrados sin tarea IA asociada.`,
      });
    }
  });

  tasks
    .filter((task) => task.status === 'todo' && now - new Date(task.created_at).getTime() > dayMs)
    .slice(0, 5)
    .forEach((task) => {
      alerts.push({
        id: `old-task-${task.id}`,
        severity: 'warning',
        title: 'Tarea pendiente mas de 24h',
        stand_title: task.stand_title,
        detail: `${task.title} sigue pendiente desde ${task.created_at}.`,
      });
    });

  stands
    .filter((stand) => (stand.views || 0) > 0 && (stand.leads || 0) === 0)
    .slice(0, 5)
    .forEach((stand) => {
      alerts.push({
        id: `views-no-leads-${stand.stand_id}`,
        severity: 'warning',
        title: 'Visitas sin conversion',
        stand_title: stand.stand_title,
        detail: `${stand.views || 0} vistas y 0 leads. Revisar CTA y contacto.`,
      });
    });

  standContacts
    .filter((stand) => !stand.email && !stand.phone && !stand.whatsapp && !stand.website_url)
    .slice(0, 5)
    .forEach((stand) => {
      alerts.push({
        id: `no-contact-${stand.id}`,
        severity: 'info',
        title: 'Stand sin contacto publicado',
        stand_title: stand.title || 'Stand sin titulo',
        detail: 'No tiene email, telefono, WhatsApp ni web publicados.',
      });
    });

  if (alerts.length === 0) {
    alerts.push({
      id: 'healthy',
      severity: 'info',
      title: 'Seguimiento bajo control',
      detail: 'No hay alertas comerciales criticas con los datos actuales.',
    });
  }

  return alerts.slice(0, 8);
}

function buildLocalExhibitorAnswer(question: string, context: Awaited<ReturnType<typeof loadExhibitorContext>>) {
  const normalizedQuestion = normalize(question);
  const leads = context.leads || [];
  const messages = context.messages || [];
  const metrics = context.stand_metrics || [];
  const opportunities = context.opportunities || [];
  const attentionRequests = leads.filter((lead: any) => lead.action === 'attention_requested');
  const contactLeads = leads.filter((lead: any) => lead.action !== 'attention_requested');
  const contactPending = opportunities.filter((item: any) => item.status === 'contact_pending');
  const interested = opportunities.filter((item: any) => item.status === 'interested');
  const meetings = opportunities.filter((item: any) => item.status === 'meeting_scheduled');
  const won = opportunities.filter((item: any) => item.status === 'won');
  const topMetric = metrics[0] as { stand_title?: string; views?: number; leads?: number; unique_visitors?: number } | undefined;
  const latestMessages = messages.slice(0, 5) as Array<{ stand_title?: string; user_name?: string; content?: string }>;

  if (normalizedQuestion.includes('responder') || normalizedQuestion.includes('pendiente') || normalizedQuestion.includes('prioridad')) {
    return [
      `Prioridad comercial: ${attentionRequests.length} solicitudes de atencion y ${messages.length} mensajes recientes.`,
      contactPending.length ? `Pipeline: contacta primero ${contactPending.slice(0, 4).map((item: any) => `${item.title}${item.stand_title ? ` (${item.stand_title})` : ''}`).join(', ')}.` : 'No hay oportunidades en estado Contactar.',
      attentionRequests.length
        ? `Responde primero solicitudes de atencion en: ${attentionRequests.slice(0, 4).map((lead: any) => lead.stand_title).join(', ')}.`
        : 'No veo solicitudes directas de atencion pendientes.',
      latestMessages.length
        ? `Mensajes recientes a revisar: ${latestMessages.map((message) => `${message.stand_title}: "${message.content}"`).join(' | ')}`
        : 'No hay mensajes recientes en chats de stand.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('lead') || normalizedQuestion.includes('contact') || normalizedQuestion.includes('conversion')) {
    return [
      `Hay ${contactLeads.length} leads de contacto y ${attentionRequests.length} solicitudes de atencion.`,
      `Pipeline: ${opportunities.length} oportunidades, ${interested.length} interesadas, ${meetings.length} reuniones y ${won.length} ganadas.`,
      topMetric ? `El stand con mas traccion es ${topMetric.stand_title}: ${topMetric.views || 0} vistas, ${topMetric.unique_visitors || 0} visitantes unicos y ${topMetric.leads || 0} leads.` : 'Aun no hay metricas suficientes por stand.',
      'Acciones: responder en menos de 24h, pedir una reunion concreta, enviar catalogo y cerrar cada conversacion con un siguiente paso.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('pipeline') || normalizedQuestion.includes('crm') || normalizedQuestion.includes('oportunidad') || normalizedQuestion.includes('estado')) {
    const highPriority = opportunities.filter((item: any) => item.priority === 'high' && !['won', 'lost'].includes(item.status));
    return [
      `Pipeline comercial: ${opportunities.length} oportunidades totales.`,
      `Estados clave: ${contactPending.length} por contactar, ${interested.length} interesadas, ${meetings.length} con reunion y ${won.length} ganadas.`,
      highPriority.length ? `Alta prioridad: ${highPriority.slice(0, 5).map((item: any) => `${item.title}${item.stand_title ? ` (${item.stand_title})` : ''}`).join(', ')}.` : 'No hay oportunidades de alta prioridad abiertas.',
      'Siguiente paso: mueve cada oportunidad segun avance real y no dejes Contactar sin respuesta mas de 24h.',
    ].join('\n');
  }

  if (normalizedQuestion.includes('mensaje') || normalizedQuestion.includes('pregunta') || normalizedQuestion.includes('faq')) {
    return latestMessages.length
      ? `Preguntas/mensajes recientes: ${latestMessages.map((message) => `${message.user_name || 'Visitante'} en ${message.stand_title}: "${message.content}"`).join(' | ')}. Usa esto para crear FAQs del stand.`
      : 'Todavia no hay mensajes suficientes. Haz mas visible el chat del stand y prueba una llamada a la accion como "Pregunta aqui por una demo".';
  }

  if (normalizedQuestion.includes('mejorar') || normalizedQuestion.includes('stand') || normalizedQuestion.includes('accion')) {
    return [
      topMetric ? `Empieza por ${topMetric.stand_title}, porque concentra la mayor actividad.` : 'Empieza mejorando el stand con mayor prioridad comercial o el primero de la feria.',
      'Checklist: titular claro, CTA visible, WhatsApp/email publicados, catalogo actualizado, video breve y respuesta rapida al chat.',
      leads.length === 0 ? 'Ahora mismo no veo leads: conviene reforzar botones de contacto y una oferta concreta.' : `Ya hay ${leads.length} interacciones registradas: conviertelas en seguimiento comercial.`,
    ].join('\n');
  }

  return [
    `Resumen comercial: ${context.stands.length} stands, ${leads.length} leads/interacciones, ${opportunities.length} oportunidades y ${messages.length} mensajes de stand.`,
    topMetric ? `Stand con mayor actividad: ${topMetric.stand_title}.` : 'Aun no hay un stand claramente dominante.',
    'Puedes preguntarme: que responder primero, como convertir leads, como va el pipeline o que mejorar en el stand.',
  ].join('\n');
}

function buildExhibitorActions(context: Awaited<ReturnType<typeof loadExhibitorContext>>): ExhibitorAction[] {
  const leads = context.leads || [];
  const messages = context.messages || [];
  const metrics = context.stand_metrics || [];
  const stands = context.stands || [];
  const actions: ExhibitorAction[] = [];
  const attentionRequests = leads
    .filter((lead: any) => lead.action === 'attention_requested')
    .slice(0, 3);

  attentionRequests.forEach((lead: any) => {
    const standTitle = lead.stand_title || 'tu stand';
    actions.push({
      type: 'reply',
      title: 'Responder solicitud de atencion',
      stand_title: standTitle,
      detail: `Este visitante pidio atencion en ${standTitle}. Conviene responderlo antes que los clics pasivos.`,
      suggested_text: `Hola, gracias por tu interes en ${standTitle}. Soy del equipo expositor. Cuentame que necesitas y te ayudo con informacion, una demo o el siguiente paso.`,
    });
  });

  const uniqueMessages = messages.filter((message: any, index: number, list: any[]) => {
    const content = String(message.content || '').trim().toLowerCase();
    if (!content) return false;
    return list.findIndex((item: any) => String(item.content || '').trim().toLowerCase() === content && item.room === message.room) === index;
  });

  uniqueMessages.slice(0, 3).forEach((message: any) => {
    const content = String(message.content || '').trim();
    if (!content) return;

    actions.push({
      type: 'reply',
      title: 'Responder mensaje del chat',
      stand_title: message.stand_title || 'Stand',
      detail: `${message.user_name || 'Visitante'} escribio: "${content.slice(0, 120)}"`,
      suggested_text: `Hola ${message.user_name || ''}. Gracias por escribirnos. Sobre tu consulta: ${content.slice(0, 80)}... te puedo ampliar informacion y, si quieres, coordinamos una llamada breve.`,
    });
  });

  const messageTopics = uniqueMessages
    .map((message: any) => String(message.content || '').trim())
    .filter(Boolean)
    .slice(0, 4);

  if (messageTopics.length > 0) {
    actions.push({
      type: 'faq',
      title: 'Crear FAQ desde preguntas reales',
      detail: `Usa estos mensajes como base: ${messageTopics.map((text) => `"${text.slice(0, 70)}"`).join(' | ')}`,
      suggested_text: messageTopics
        .map((text, index) => `P${index + 1}: ${text}\nR${index + 1}: Podemos ayudarte con esta consulta desde el stand. Contactanos y te damos una respuesta personalizada.`)
        .join('\n\n'),
    });
  }

  const topMetric = metrics[0] as { stand_title?: string; views?: number; leads?: number; unique_visitors?: number } | undefined;
  const standsWithoutContact = stands
    .filter((stand: any) => !stand.email && !stand.phone && !stand.whatsapp && !stand.website_url)
    .slice(0, 2);

  if (topMetric && ((topMetric.views || 0) > 0 || (topMetric.leads || 0) > 0)) {
    actions.push({
      type: 'improvement',
      title: 'Mejorar conversion del stand con mas traccion',
      stand_title: topMetric.stand_title || 'Stand principal',
      detail: `${topMetric.stand_title || 'Este stand'} tiene ${topMetric.views || 0} vistas y ${topMetric.leads || 0} leads. Refuerza CTA, contacto visible y oferta concreta.`,
      suggested_text: 'CTA sugerido: Solicita una demo o una reunion de 15 minutos y te mostramos la solucion aplicada a tu caso.',
    });
  } else if (stands.length > 0) {
    actions.push({
      type: 'improvement',
      title: 'Activar primeras visitas',
      stand_title: stands[0]?.title || 'Primer stand',
      detail: 'Todavia no hay un stand con traccion clara. Empieza con una oferta concreta, CTA visible y un mensaje inicial en el chat.',
      suggested_text: 'CTA sugerido: Cuentanos que buscas y te recomendamos la solucion mas adecuada en menos de 24 horas.',
    });
  }

  standsWithoutContact.forEach((stand: any) => {
    actions.push({
      type: 'improvement',
      title: 'Completar datos de contacto',
      stand_title: stand.title || 'Stand sin titulo',
      detail: 'Este stand no tiene web, email, telefono ni WhatsApp publicados. Puede estar perdiendo leads interesados.',
      suggested_text: 'Anade al menos email o WhatsApp y un CTA visible: Habla con nuestro equipo.',
    });
  });

  if (actions.length === 0) {
    actions.push({
      type: 'improvement',
      title: 'Preparar captacion inicial',
      detail: 'Aun hay poca actividad comercial. Publica un CTA claro, abre el chat y prueba una pregunta sugerida dentro del stand.',
      suggested_text: 'CTA sugerido: Cuentanos tu reto y te recomendamos la mejor solucion para tu empresa.',
    });
  }

  return actions.slice(0, 6);
}

function scoreStand(normalizedQuestion: string, stand: StandContext) {
  const haystack = normalize([
    stand.title,
    stand.description,
    stand.website_url,
    stand.email,
    stand.linkedin,
    stand.instagram,
    stand.facebook,
  ].filter(Boolean).join(' '));

  return normalizedQuestion
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .reduce((score, token) => score + (haystack.includes(token) ? 1 : 0), 0);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}
