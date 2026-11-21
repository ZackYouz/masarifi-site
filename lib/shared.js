export const tokenPattern = /^(?!\d{12}$)[A-Za-z0-9_-]{12}$/;
export const policy = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff'
};

export function json(data, status = 200, headers = {}) {
  return Response.json(data, {status, headers: {...policy, ...headers}});
}
export const missing = () => json({error: 'Card not found.'}, 404);
