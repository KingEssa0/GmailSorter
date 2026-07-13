const request = require('supertest');
const { createApp } = require('../server');

describe('CORS for frontend origins', () => {
  it('allows preflight requests from the Vite dev server origin', async () => {
    const app = createApp();

    const res = await request(app)
      .options('/api/emails/sync')
      .set('Origin', 'http://127.0.0.1:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://127.0.0.1:5173');
  });
});
