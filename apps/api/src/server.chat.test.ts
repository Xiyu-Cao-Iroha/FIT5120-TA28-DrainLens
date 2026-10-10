import { afterEach, describe, expect, it, vi } from 'vitest';

const { requestMock, getIdTokenClientMock } = vi.hoisted(() => ({
  requestMock: vi.fn(),
  getIdTokenClientMock: vi.fn(),
}));

vi.mock('google-auth-library', () => ({
  GoogleAuth: vi.fn().mockImplementation(() => ({
    getIdTokenClient: getIdTokenClientMock,
  })),
}));

import { createApp } from './server.js';

afterEach(() => {
  delete process.env.AI_SERVICE_URL;
  requestMock.mockReset();
  getIdTokenClientMock.mockReset();
});

describe('POST /api/chat', () => {
  it('returns 503 when AI_SERVICE_URL is not configured', async () => {
    delete process.env.AI_SERVICE_URL;

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How should I prepare for heavy rain?',
      }),
    });

    expect(response.status).toBe(503);

    await expect(response.json()).resolves.toEqual({
      error: 'AI chat service is not configured.',
    });
  });

  it('returns 400 when the request body is not valid JSON', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{not-valid-json',
    });

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body.',
    });
  });

  it.each([
    {},
    { message: '' },
    { message: '   ' },
    { message: 123 },
    { message: null },
  ])('returns 400 for an invalid message: %j', async (body) => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toEqual({
      error: 'A message is required.',
    });
  });

  it('returns 502 without leaking an upstream error response', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockRejectedValue(
      new Error('internal model failure'),
    );

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'What should I do before heavy rain?',
      }),
    });

    expect(response.status).toBe(502);

    const result = await response.json();

    expect(result).toEqual({
      error: 'The chat assistant is temporarily unavailable.',
    });

    expect(JSON.stringify(result)).not.toContain(
      'internal model failure',
    );
  });

  it('forwards a trimmed message and returns the AI response', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000/';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({
      data: {
        answer: 'Clear gutters before heavy rain.',
        sources: [
          {
            title: 'Storm — plan and stay safe',
            organisation: 'VICSES',
          },
        ],
      },
    });

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '  What should I do before heavy rain?  ',
      }),
    });

    expect(response.status).toBe(200);

    expect(getIdTokenClientMock).toHaveBeenCalledWith(
      'http://127.0.0.1:8000',
    );

    expect(requestMock).toHaveBeenCalledWith({
      url: 'http://127.0.0.1:8000/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      data: {
        message: 'What should I do before heavy rain?',
      },
      timeout: 280_000,
    });

    await expect(response.json()).resolves.toEqual({
      answer: 'Clear gutters before heavy rain.',
      sources: [
        {
          title: 'Storm — plan and stay safe',
          organisation: 'VICSES',
        },
      ],
    });
  });
});