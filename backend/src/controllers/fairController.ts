import { type Request, type Response } from 'express';
import { supabase } from '../config/supabase';

export const getEvents = async (req: Request, res: Response) => {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, description, event_date, type, slug, status, zoom_link, created_at');
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEventBySlug = async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(404).json({ error: 'Event not found' });
  }
};

export const getPavilionsByEvent = async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    const { data, error } = await supabase.from('pavilions').select('*, stands(*)').eq('event_id', eventId);
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getStandsByEvent = async (req: Request, res: Response) => {
  const { eventId } = req.params;
  try {
    // Attempt to fetch stands
    const { data, error } = await supabase
      .from('stands')
      .select('*')
      .eq('event_id', eventId);
    
    if (error) {
      console.error('[backend] Supabase query error in getStandsByEvent:', error.message, error.hint);
      throw error;
    }

    // Attempt to enrich with companies if possible
    process.nextTick(async () => {
      // Just for debug
      const { data: companies } = await supabase.from('companies').select('*').limit(1);
      if (!companies) console.warn('[backend] Warning: companies table not found or empty');
    });

    res.json(data);
  } catch (error: any) {
    console.error('[backend] 500 Error in getStandsByEvent:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const getStandDetail = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const { data, error } = await supabase.from('stands').select('*, companies(*)').eq('id', id).single();
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
