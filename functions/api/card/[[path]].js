import {onRequest as handleCard} from '../../../lib/nfc-api.js';

export function onRequest(context) {
  // Scope the handler to the card namespace so unrelated APIs keep their routing.
  return handleCard({
    params: {path: ['card', ...(context.params.path || [])]},
    request: context.request,
    env: context.env,
    waitUntil: promise => context.waitUntil(promise)
  });
}
