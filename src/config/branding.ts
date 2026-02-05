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

// Helper to generate page titles
export const getPageTitle = (page?: string): string => {
  if (page) {
    return `${branding.name} - ${page}`;
  }
  return branding.name;
};
