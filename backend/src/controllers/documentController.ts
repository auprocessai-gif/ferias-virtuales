import { type Request, type Response } from 'express';
import { PDFParse } from 'pdf-parse';
import { supabase } from '../config/supabase';

type StandWithDocs = {
  id: string;
  event_id: string;
  pdf_url?: string | null;
  pdf_url_2?: string | null;
};

export const syncStandDocuments = async (req: Request, res: Response) => {
  const standId = String(req.params.id || '').trim();

  if (!standId) {
    res.status(400).json({ error: 'Stand id is required' });
    return;
  }

  try {
    const { data: stand, error: standError } = await supabase
      .from('stands')
      .select('id,event_id,pdf_url,pdf_url_2')
      .eq('id', standId)
      .single();

    if (standError || !stand) {
      res.status(404).json({ error: 'Stand not found' });
      return;
    }

    const docs = [
      { label: 'Catalogo principal', url: (stand as StandWithDocs).pdf_url },
      { label: 'Documentacion extra', url: (stand as StandWithDocs).pdf_url_2 },
    ].filter((doc): doc is { label: string; url: string } => Boolean(doc.url));

    if (docs.length === 0) {
      res.json({ synced: 0, documents: [] });
      return;
    }

    const results = [];

    for (const doc of docs) {
      try {
        const extractedText = await extractPdfText(doc.url);
        const normalizedText = normalizeExtractedText(extractedText).slice(0, 40000);

        const { data, error } = await supabase
          .from('stand_documents')
          .upsert({
            event_id: (stand as StandWithDocs).event_id,
            stand_id: standId,
            label: doc.label,
            source_url: doc.url,
            extracted_text: normalizedText,
            extraction_status: 'ready',
            error_message: null,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'stand_id,source_url',
          })
          .select('id,label,source_url,extraction_status,updated_at')
          .single();

        if (error) throw error;
        results.push(data);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'PDF extraction failed';
        const { data } = await supabase
          .from('stand_documents')
          .upsert({
            event_id: (stand as StandWithDocs).event_id,
            stand_id: standId,
            label: doc.label,
            source_url: doc.url,
            extracted_text: '',
            extraction_status: 'failed',
            error_message: message,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'stand_id,source_url',
          })
          .select('id,label,source_url,extraction_status,error_message,updated_at')
          .single();

        results.push(data || {
          label: doc.label,
          source_url: doc.url,
          extraction_status: 'failed',
          error_message: message,
        });
      }
    }

    res.json({
      synced: results.filter((item) => item?.extraction_status === 'ready').length,
      documents: results,
    });
  } catch (error: unknown) {
    console.error('[documents] sync error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Document sync error',
    });
  }
};

async function extractPdfText(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Could not download PDF (${response.status})`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('pdf') && !url.toLowerCase().includes('.pdf')) {
    throw new Error('The document does not look like a PDF');
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const parser = new PDFParse({ data: buffer });

  try {
    const parsed = await parser.getText();
    return parsed.text || '';
  } finally {
    await parser.destroy();
  }
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
