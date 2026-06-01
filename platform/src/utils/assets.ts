// Dynamic asset URL utility
export function getAssetUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  
  // Always use relative path for admin panel assets
  // Admin panel assets are served from the same domain/port
  // Add cache busting parameter
  const timestamp = Date.now();
  return `/${cleanPath}?v=${timestamp}`;
}

// Get logo URL based on theme and current host
export function getLogoUrl(theme: 'light' | 'dark' = 'light'): string {
  return getAssetUrl(`ragleaf-logo-${theme}.svg`);
}
