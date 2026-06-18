import { Router } from 'express';
import { getEvents, getEventBySlug, getPavilionsByEvent, getStandsByEvent, getStandDetail } from '../controllers/fairController';
import { askAnalyticsAssistant, askExhibitorAssistant, askFairAssistant, askStandAssistant, getAnalyticsInsights, getFairAssistantSuggestions } from '../controllers/assistantController';
import { syncStandDocuments } from '../controllers/documentController';

const router = Router();

router.get('/events', getEvents);
router.get('/events/slug/:slug', getEventBySlug);
router.get('/events/slug/:slug/assistant/suggestions', getFairAssistantSuggestions);
router.post('/events/slug/:slug/assistant', askFairAssistant);
router.get('/events/:eventId/analytics/insights', getAnalyticsInsights);
router.post('/events/:eventId/analytics/assistant', askAnalyticsAssistant);
router.post('/events/:eventId/exhibitor/assistant', askExhibitorAssistant);
router.get('/events/:eventId/pavilions', getPavilionsByEvent);
router.get('/events/:eventId/stands', getStandsByEvent);
router.get('/stands/:id', getStandDetail);
router.post('/stands/:id/assistant', askStandAssistant);
router.post('/stands/:id/documents/sync', syncStandDocuments);

export default router;
