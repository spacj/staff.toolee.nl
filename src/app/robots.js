const SITE_URL = 'https://staff2.app';

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Keep the signed-in product surface out of the index — it's private
        // and behind auth. Only public marketing/auth pages should rank.
        disallow: [
          '/dashboard', '/settings', '/staff', '/calendar', '/costs', '/attendance',
          '/stock', '/recipes', '/checklists', '/knowledge', '/chat', '/time',
          '/shifts', '/availability', '/staff-availability', '/shops', '/reports',
          '/inventory', '/my-checklists', '/webmaster', '/checklist', '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
