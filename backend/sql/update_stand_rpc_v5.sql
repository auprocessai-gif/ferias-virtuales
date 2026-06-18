-- ============================================================
-- RPC: update_stand_rpc_v5
-- Esta función decodifica strings en Base64 y actualiza el Stand.
-- También asegura que existan las columnas necesarias.
-- ============================================================

-- 1. Asegurar que la columna 'email' existe (por si acaso no se creó en el schema inicial)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='stands' AND column_name='email') THEN
    ALTER TABLE public.stands ADD COLUMN email TEXT;
  END IF;
END $$;

-- 2. Crear la función RPC v5
CREATE OR REPLACE FUNCTION public.update_stand_rpc_v5(
  s_id UUID,
  s_title_b64 TEXT,
  s_desc_b64 TEXT DEFAULT '',
  s_video_b64 TEXT DEFAULT '',
  s_logo_b64 TEXT DEFAULT '',
  s_pdf_b64 TEXT DEFAULT '',
  s_pdf2_b64 TEXT DEFAULT '',
  s_web_b64 TEXT DEFAULT '',
  s_phone_b64 TEXT DEFAULT '',
  s_whatsapp_b64 TEXT DEFAULT '',
  s_email_b64 TEXT DEFAULT '',
  s_linkedin_b64 TEXT DEFAULT '',
  s_insta_b64 TEXT DEFAULT '',
  s_face_b64 TEXT DEFAULT '',
  s_images_b64 TEXT[] DEFAULT '{}'
)
RETURNS VOID AS $$
DECLARE
  v_title TEXT;
  v_desc TEXT;
  v_video TEXT;
  v_logo TEXT;
  v_pdf TEXT;
  v_pdf2 TEXT;
  v_web TEXT;
  v_phone TEXT;
  v_whatsapp TEXT;
  v_email TEXT;
  v_linkedin TEXT;
  v_insta TEXT;
  v_face TEXT;
  v_images TEXT[];
  v_img TEXT;
BEGIN
  -- Decodificar campos simples (si no son vacíos)
  v_title := convert_from(decode(s_title_b64, 'base64'), 'UTF8');
  
  v_desc := CASE WHEN s_desc_b64 <> '' THEN convert_from(decode(s_desc_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_video := CASE WHEN s_video_b64 <> '' THEN convert_from(decode(s_video_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_logo := CASE WHEN s_logo_b64 <> '' THEN convert_from(decode(s_logo_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_pdf := CASE WHEN s_pdf_b64 <> '' THEN convert_from(decode(s_pdf_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_pdf2 := CASE WHEN s_pdf2_b64 <> '' THEN convert_from(decode(s_pdf2_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_web := CASE WHEN s_web_b64 <> '' THEN convert_from(decode(s_web_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_phone := CASE WHEN s_phone_b64 <> '' THEN convert_from(decode(s_phone_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_whatsapp := CASE WHEN s_whatsapp_b64 <> '' THEN convert_from(decode(s_whatsapp_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_email := CASE WHEN s_email_b64 <> '' THEN convert_from(decode(s_email_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_linkedin := CASE WHEN s_linkedin_b64 <> '' THEN convert_from(decode(s_linkedin_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_insta := CASE WHEN s_insta_b64 <> '' THEN convert_from(decode(s_insta_b64, 'base64'), 'UTF8') ELSE NULL END;
  v_face := CASE WHEN s_face_b64 <> '' THEN convert_from(decode(s_face_b64, 'base64'), 'UTF8') ELSE NULL END;

  -- Decodificar array de imágenes
  v_images := '{}';
  IF s_images_b64 IS NOT NULL THEN
    FOREACH v_img IN ARRAY s_images_b64 LOOP
      IF v_img <> '' THEN
        v_images := array_append(v_images, convert_from(decode(v_img, 'base64'), 'UTF8'));
      END IF;
    END LOOP;
  END IF;

  -- Actualizar tabla
  UPDATE public.stands
  SET
    title = v_title,
    description = v_desc,
    video_url = v_video,
    logo_url = v_logo,
    pdf_url = v_pdf,
    pdf_url_2 = v_pdf2,
    website_url = v_web,
    phone = v_phone,
    whatsapp = v_whatsapp,
    email = v_email,
    linkedin = v_linkedin,
    instagram = v_insta,
    facebook = v_face,
    images = v_images
  WHERE id = s_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
