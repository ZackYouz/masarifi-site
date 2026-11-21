import {onRequest as handleCardApi} from './lib/nfc-api.js';
import {onRequest as handleCardPage} from './functions/k/[[path]].js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/').filter(Boolean);

    if (parts[0] === 'api' && parts[1] === 'card') {
      return handleCardApi({
        params: {path: ['card', ...parts.slice(2)]},
        request,
        env,
        waitUntil: promise => ctx.waitUntil(promise)
      });
    }

    if (parts[0] === 'k') {
      return handleCardPage({
        params: {path: parts.slice(1)},
        request,
        env
      });
    }

    return env.ASSETS.fetch(request);
  }
};
