import { httpServerHandler } from 'cloudflare:node';
import app from '../server/index.js';
import publishing from '../server/publishing.js';

const PORT = 3000;
app.listen(PORT);
const expressHandler = httpServerHandler({ port: PORT });

export default {
  async fetch(request, env, ctx) {
    globalThis.__NOVLY_CF_ENV = env;
    return expressHandler.fetch(request, env, ctx);
  },
  async scheduled(controller, env, ctx) {
    globalThis.__NOVLY_CF_ENV = env;
    ctx.waitUntil(publishing.publishDueChapters());
  },
};
