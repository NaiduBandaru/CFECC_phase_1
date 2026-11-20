let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = import('../apps/server/dist/index.js').then((m) => m.default || m.app || m);
  }
  const app = await appPromise;
  return app(req, res);
}
