// Branding configuration - reads from environment variables
// Configure these in .env.production before building for deployment

export const branding = {
  // System name - can be overridden via VITE_SYSTEM_NAME
  name: import.meta.env.VITE_SYSTEM_NAME || 'GUARDA OPERACIONAL',
  
  // Tagline
  tagline: 'Sistema de Controle de Acesso',
  
  // Logo path - place your logo at /public/branding/logo.png
  logoPath: '/branding/logo.png',
  
  // Favicon path - place your favicon at /public/branding/favicon.ico
  faviconPath: '/branding/favicon.ico',
  
  // Whether to show logo image or fallback to icon
  useLogo: true,
} as const;

// API configuration for self-hosted environments
export const apiConfig = {
  // Admin API URL - used for creating users without logging out admin
  // In Docker self-hosted: set via VITE_ADMIN_API_URL build arg
  // Falls back to supabase URL + /admin/v1 path
  adminApiUrl: import.meta.env.VITE_ADMIN_API_URL || 
    (import.meta.env.VITE_SUPABASE_URL ? `${import.meta.env.VITE_SUPABASE_URL}/admin/v1` : ''),
};

// Helper to generate page titles
export const getPageTitle = (page?: string): string => {
  if (page) {
    return `${branding.name} - ${page}`;
  }
  return branding.name;
};
