export function getApiBaseUrl() {
  if (typeof window === 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1306';
  }
  
  if (window.location.hostname.includes('ragleaf.com')) {
    return 'https://api.ragleaf.com';
  }
  
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  return `${protocol}//${hostname}:1306`;
}
