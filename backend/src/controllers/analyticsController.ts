import { type Request, type Response } from 'express';
import { supabase } from '../config/supabase';

const allowedActions = new Set([
  'fair_entered',
  'pavilion_entered',
  'stand_viewed',
  'auditorium_entered',
  'stand_cta_clicked',
  'document_opened',
  'video_played',
  'chat_message_sent',
]);

const getBearerToken = (authorization?: string) => {
  if (!authorization) return null;
  const [type, token] = authorization.split(' ');
  return type?.toLowerCase() === 'bearer' && token ? token : null;
};

export const trackAnalyticsEvent = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req.headers.authorization);

    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const {
      eventId,
      pavilionId = null,
      standId = null,
      action,
      metadata = {},
    } = req.body ?? {};

    if (!eventId || typeof eventId !== 'string') {
      return res.status(400).json({ error: 'eventId is required' });
    }

    if (!allowedActions.has(action)) {
      return res.status(400).json({ error: 'Invalid analytics action' });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { error } = await supabase.from('analytics_events').insert({
      event_id: eventId,
      pavilion_id: pavilionId,
      stand_id: standId,
      user_id: userData.user.id,
      event_type: action,
      action,
      metadata,
    });

    if (error) {
      console.error('[analytics] insert failed:', error.message);
      return res.status(500).json({ error: 'Could not record analytics event' });
    }

    return res.json({ ok: true });
  } catch (error: any) {
    console.error('[analytics] unexpected error:', error);
    return res.status(500).json({ error: error.message || 'Unexpected analytics error' });
  }
};
