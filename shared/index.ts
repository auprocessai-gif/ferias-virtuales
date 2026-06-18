export interface User {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
}

export interface Company {
  id: string;
  name: string;
  logo_url: string;
  description: string;
  website_url?: string;
}

export interface Stand {
  id: string;
  company_id: string;
  event_id: string;
  pavilion_id?: string | null;
  title: string;
  description: string;
  video_url?: string;
  pdf_url?: string;
  pdf_url_2?: string;
  logo_url?: string;
  website_url?: string;
  phone?: string;
  whatsapp?: string;
  linkedin?: string;
  instagram?: string;
  facebook?: string;
  images: string[];
  theme_color?: string; // Hex color for the stand branding
  position: { x: number; y: number }; // Relative position in the pavilion (0-100)
  position_x?: number;
  position_y?: number;
  email?: string;
}

export interface Event {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  banner_url?: string;
  start_date?: string;
  end_date?: string;
  slug?: string;
  status?: 'draft' | 'active' | 'archived' | string;
  visibility?: 'public' | 'private';
  registration_mode?: 'open' | 'approval_required' | 'invite_only';
}

export interface Pavilion {
  id: string;
  event_id: string;
  name: string;
  background_url?: string;
  stands: Stand[];
}
