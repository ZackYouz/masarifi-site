import {policy, tokenPattern} from '../../lib/shared.js';

export async function onRequest({request, params, env}) {
  const path = params.path || [];
  if (path.length !== 1 || !tokenPattern.test(path[0])) return new Response('Card not found.', {status:404,headers:policy});
  if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{...policy,Allow:'GET, HEAD'}});
  const asset = await env.ASSETS.fetch(new URL('/nfc/card.html',request.url));
  return new Response(request.method === 'HEAD' ? null : asset.body, {
    status:asset.status, headers:{
      ...policy,'Content-Type':'text/html; charset=utf-8',
      'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
    }
  });
}
