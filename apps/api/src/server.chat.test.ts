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
    { message: [] },
    { message: {} },
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

it('accepts a message exactly 500 characters long', async () => {
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

  getIdTokenClientMock.mockResolvedValue({
    request: requestMock,
  });

  requestMock.mockResolvedValue({
    data: {
      answer: 'Accepted.',
      sources: [],
    },
  });

  const app = createApp({} as never);

  const response = await app.request('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'a'.repeat(500),
    }),
  });

  expect(response.status).toBe(200);
  expect(getIdTokenClientMock).toHaveBeenCalledTimes(1);
  expect(requestMock).toHaveBeenCalledTimes(1);
});

it('rejects a message over 500 characters without calling the AI service', async () => {
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

  const app = createApp({} as never);

  const response = await app.request('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'a'.repeat(501),
    }),
  });

  expect(response.status).toBe(400);

  await expect(response.json()).resolves.toEqual({
    error: 'Message is too long.',
  });

  expect(getIdTokenClientMock).not.toHaveBeenCalled();
  expect(requestMock).not.toHaveBeenCalled();
});

it('rejects a request body larger than 4096 bytes without calling the AI service', async () => {
  process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

  const app = createApp({} as never);

  const response = await app.request('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Valid question',
      padding: 'Ã©'.repeat(3000),
    }),
  });

  expect(response.status).toBe(413);

  await expect(response.json()).resolves.toEqual({
    error: 'Request body is too large.',
  });

  expect(getIdTokenClientMock).not.toHaveBeenCalled();
  expect(requestMock).not.toHaveBeenCalled();
});

  it('accepts multibyte Unicode when the limits are satisfied', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({
      data: {
        answer: 'Accepted.',
        sources: [],
      },
    });

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: '\u00E9'.repeat(500),
      }),
    });

    expect(response.status).toBe(200);
    expect(requestMock).toHaveBeenCalledTimes(1);
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

    it('sets Cache-Control no-store on a successful chat response', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({
      data: {
        answer: 'Accepted.',
        sources: [],
      },
    });

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

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    {
      name: '400 invalid message',
      body: JSON.stringify({ message: '' }),
      expectedStatus: 400,
    },
    {
      name: '413 oversized body',
      body: JSON.stringify({
        message: 'Valid question',
        padding: 'Ã©'.repeat(3000),
      }),
      expectedStatus: 413,
    },
  ])('sets Cache-Control no-store on $name', async ({ body, expectedStatus }) => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    });

    expect(response.status).toBe(expectedStatus);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('sets Cache-Control no-store on a 502 upstream failure', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockRejectedValue(
      new Error('internal failure'),
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
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('sets Cache-Control no-store when AI service is not configured', async () => {
    delete process.env.AI_SERVICE_URL;

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

    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    {
      name: 'javascript URL',
      data: {
        answer: 'Test answer.',
        sources: [
          {
            title: 'Bad source',
            organisation: 'Unknown',
            url: 'javascript:alert(1)',
          },
        ],
      },
    },
    {
      name: 'data URL',
      data: {
        answer: 'Test answer.',
        sources: [
          {
            title: 'Bad source',
            organisation: 'Unknown',
            url: 'data:text/html,<script>alert(1)</script>',
          },
        ],
      },
    },
    {
      name: 'HTTP URL',
      data: {
        answer: 'Test answer.',
        sources: [
          {
            title: 'Bad source',
            organisation: 'VICSES',
            url: 'http://www.ses.vic.gov.au/flood',
          },
        ],
      },
    },
    {
      name: 'unapproved HTTPS host',
      data: {
        answer: 'Test answer.',
        sources: [
          {
            title: 'Bad source',
            organisation: 'Unknown',
            url: 'https://example.com/flood',
          },
        ],
      },
    },
  ])('rejects an upstream response with $name', async ({ data }) => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({ data });

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How should I prepare for flooding?',
      }),
    });

    expect(response.status).toBe(502);

    await expect(response.json()).resolves.toEqual({
      error: 'The chat assistant is temporarily unavailable.',
    });
  });

  it('rejects an oversized upstream answer', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({
      data: {
        answer: 'a'.repeat(4001),
        sources: [],
      },
    });

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How should I prepare for flooding?',
      }),
    });

    expect(response.status).toBe(502);
  });

  it('rejects an upstream response with more than two sources', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({
      data: {
        answer: 'Test answer.',
        sources: [
          { title: 'One' },
          { title: 'Two' },
          { title: 'Three' },
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
        message: 'How should I prepare for flooding?',
      }),
    });

    expect(response.status).toBe(502);
  });

  it('rejects a malformed upstream response shape', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({
      data: {
        sources: [],
      },
    });

    const app = createApp({} as never);

    const response = await app.request('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'How should I prepare for flooding?',
      }),
    });

    expect(response.status).toBe(502);
  });

  it('accepts a valid approved source response', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockResolvedValue({
      data: {
        answer: 'Prepare before heavy rain.',
        sources: [
          {
            title: 'Flood Checklist',
            organisation: 'VICSES',
            page: 1,
            url: 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/flood',
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
        message: 'How should I prepare for flooding?',
      }),
    });

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toEqual({
      answer: 'Prepare before heavy rain.',
      sources: [
        {
          title: 'Flood Checklist',
          organisation: 'VICSES',
          page: 1,
          url: 'https://www.ses.vic.gov.au/plan-and-stay-safe/emergencies/flood',
        },
      ],
    });
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
            title: 'Storm â€” plan and stay safe',
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
      timeout: 90_000,
    });

    await expect(response.json()).resolves.toEqual({
      answer: 'Clear gutters before heavy rain.',
      sources: [
        {
          title: 'Storm â€” plan and stay safe',
          organisation: 'VICSES',
        },
      ],
    });
  });
});
describe('AI-02 concurrent request protection', () => {
  it('limits simultaneous AI requests and releases the slot', async () => {
    process.env.AI_SERVICE_URL = 'http://127.0.0.1:8000';

    let releaseUpstream!: () => void;
    let signalStarted!: () => void;

    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });

    const pending = new Promise<void>((resolve) => {
      releaseUpstream = resolve;
    });

    getIdTokenClientMock.mockResolvedValue({
      request: requestMock,
    });

    requestMock.mockImplementation(async () => {
      signalStarted();
      await pending;

      return {
        data: {
          answer: 'Prepare an emergency kit.',
          sources: [],
        },
      };
    });

    const app = createApp({} as never);

    const sendChat = () =>
      app.request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'How should I prepare for flooding?',
        }),
      });

    const firstRequest = sendChat();
    await started;

    const secondResponse = await sendChat();

    expect(secondResponse.status).toBe(429);
    expect(secondResponse.headers.get('Retry-After')).toBe('5');
    expect(secondResponse.headers.get('Cache-Control')).toBe('no-store');
    expect(requestMock).toHaveBeenCalledTimes(1);

    releaseUpstream();

    const firstResponse = await firstRequest;
    expect(firstResponse.status).toBe(200);

    const thirdResponse = await sendChat();

    expect(thirdResponse.status).toBe(200);
    expect(requestMock).toHaveBeenCalledTimes(2);
  });
});