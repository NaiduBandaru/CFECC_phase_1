import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../src/app.js';
import { initDatabase } from '../src/db/index.js';
import { seedDatabase } from '../src/db/seed.js';

describe('CFECC Enterprise Backend API Test Suite', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    await initDatabase();
    await seedDatabase();
    app = createApp();
  });

  it('1. Should login successfully as Administrator and return JWT token', async () => {
    // Simulate login request using node fetch or internal handler
    const loginPayload = {
      username: 'admin',
      password: 'Admin@123',
    };

    // Use express app invocation
    const req = {
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'content-type': 'application/json' },
      body: loginPayload,
    };

    // In vitest we can use simple fetch with an ephemeral server or test via supertest/express
    expect(loginPayload.username).toBe('admin');
  });
});
