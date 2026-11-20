let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = import('../apps/server/dist/index.js').then(async (m) => {
      if (m.bootstrapPromise) {
        try {
          await m.bootstrapPromise;
        } catch (e) {
          console.error('[API Serverless Init Error]:', e);
        }
      }
      return m.default || m.app || m;
    });
  }
  const app = await appPromise;
  return app(req, res);
}
