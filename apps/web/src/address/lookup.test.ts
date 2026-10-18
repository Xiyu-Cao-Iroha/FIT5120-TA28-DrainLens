import { describe, expect, it, vi } from 'vitest';

import type { AddressIndex, IndexedAddress } from '@drainlens/address';

import { lookupAddress } from './lookup.js';

const at = (id: string, number: string, street: string): IndexedAddress => ({
  id,
  label: `${number} ${street}, Kensington`,
  number,
  street,
  suburb: 'Kensington',
  e: 500,
  n: 500,
  at: 0,
});

const index: AddressIndex = {
  area: 'kensington',
  addresses: [at('a', '46', 'Gatehouse Drive'), at('b', '89', 'Market Street')],
  streets: ['Gatehouse Drive', 'Market Street', 'Bangalore Street'],
};

const answering = (body: unknown, status = 200): typeof fetch =>
  vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    } as Response),
  ) as unknown as typeof fetch;

const refusing = (): typeof fetch =>
  vi.fn(() => Promise.reject(new Error('network down'))) as unknown as typeof fetch;

describe('looking an address up', () => {
  it('takes the API when it answers', async () => {
    const got = await lookupAddress({
      index,
      typed: '46 gatehouse drive',
      url: '/api/addresses/search',
      fetchImpl: answering({ kind: 'found', address: at('a', '46', 'Gatehouse Drive') }),
    });
    expect(got.from).toBe('api');
    expect(got.answer.kind).toBe('found');
  });

  it('sends the query and nothing else', async () => {
    const fetchImpl = answering({ kind: 'not-an-address', typed: 'x' });
    await lookupAddress({ index, typed: 'x', url: '/api/addresses/search', fetchImpl });

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(init.method).toBe('POST');
    // The whole body, compared whole. A test asserting only that `q` is
    // present would pass while something else was added beside it, and what
    // this route must not grow is a second field.
    expect(JSON.parse(String(init.body))).toEqual({ q: 'x' });
  });

  it('never puts the address in the URL', async () => {
    const fetchImpl = answering({ kind: 'not-an-address', typed: '46 gatehouse drive' });
    await lookupAddress({
      index,
      typed: '46 gatehouse drive',
      url: '/api/addresses/search',
      fetchImpl,
    });
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string];
    expect(url).toBe('/api/addresses/search');
    expect(url).not.toMatch(/gatehouse/i);
  });

  it('answers from the index when there is no API to ask', async () => {
    const fetchImpl = refusing();
    const got = await lookupAddress({ index, typed: '46 gatehouse drive', url: null, fetchImpl });
    expect(got.from).toBe('bundled');
    expect(got.answer).toEqual({ kind: 'found', address: index.addresses[0] });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('falls back on a network failure, and says why', async () => {
    const onFallback = vi.fn();
    const got = await lookupAddress({
      index,
      typed: '46 gatehouse drive',
      url: '/api/addresses/search',
      fetchImpl: refusing(),
      onFallback,
    });
    expect(got.from).toBe('bundled');
    expect(got.answer.kind).toBe('found');
    expect(onFallback).toHaveBeenCalledWith('network down');
  });

  it('falls back on a 500', async () => {
    const got = await lookupAddress({
      index,
      typed: '46 gatehouse drive',
      url: '/api/addresses/search',
      fetchImpl: answering({ error: 'the request could not be answered' }, 500),
    });
    expect(got.from).toBe('bundled');
    expect(got.answer.kind).toBe('found');
  });

  it.each([
    ['nothing at all', null],
    ['a verdict with no kind', { address: at('a', '46', 'Gatehouse Drive') }],
    ['a kind nobody defined', { kind: 'maybe' }],
    ['found with no address', { kind: 'found' }],
    ['found with an address that has no label', { kind: 'found', address: { id: 'a' } }],
    ['ambiguous with no matches', { kind: 'ambiguous' }],
  ])('refuses %s and falls back', async (_what, body) => {
    const got = await lookupAddress({
      index,
      typed: '46 gatehouse drive',
      url: '/api/addresses/search',
      fetchImpl: answering(body),
    });
    expect(got.from).toBe('bundled');
    expect(got.answer.kind).toBe('found');
  });

  it('keeps the two failures apart on the fallback path too', async () => {
    // AC 1.1.8 is the reason the fallback runs the same matcher rather than
    // a simpler one: a street we publish with a number we do not is not the
    // same thing as an address we have never heard of, on either route.
    const outside = await lookupAddress({
      index,
      typed: '999999 bangalore street',
      url: null,
    });
    expect(outside.answer.kind).toBe('outside-pilot');

    const unknown = await lookupAddress({ index, typed: 'nowhere parade', url: null });
    expect(unknown.answer.kind).toBe('not-an-address');
  });
});
