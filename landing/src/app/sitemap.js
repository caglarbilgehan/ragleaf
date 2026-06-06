export const dynamic = 'force-static';

export default function sitemap() {
  const baseUrl = 'https://ragleaf.com';
  const routes = ['', '/about', '/installation', '/pricing', '/developers', '/blog', '/contact', '/legal'];

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1.0 : 0.8,
  }));
}
