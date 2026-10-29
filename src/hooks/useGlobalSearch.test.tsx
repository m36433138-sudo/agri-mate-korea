import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useGlobalSearch } from './useGlobalSearch';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
const item = (label: string) => ({ id: label, label, sub: '', category: 'machine', link: '/machines/' + label });
function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => rpc.mockReset());
describe('current global search results', () => {
  it('ignores older responses after a newer search completes', async () => {
    let resolveOld: (value: unknown) => void = () => {};
    rpc.mockImplementation((_name, args) => ({ abortSignal: () => args.search_query === 'old'
      ? new Promise(resolve => { resolveOld = resolve; })
      : Promise.resolve({ data: [item('D4351')], error: null }) }));
    const { result, rerender } = renderHook(({ query }) => useGlobalSearch(query), { initialProps: { query: 'old' }, wrapper });
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(1));
    rerender({ query: 'D4351' });
    await waitFor(() => expect(result.current.results[0]?.label).toBe('D4351'));
    await act(async () => resolveOld({ data: [item('old')], error: null }));
    expect(result.current.results[0]?.label).toBe('D4351');
    rerender({ query: '' });
    expect(result.current.results).toEqual([]);
  });
  it('fetches subsequent pages instead of hiding matches after the first page', async () => {
    rpc.mockImplementation((_name, args) => ({ abortSignal: () => Promise.resolve({
      data: args.page_offset === 0 ? Array.from({ length: 20 }, (_, i) => item(String(i))) : [item('D4351')], error: null,
    }) }));
    const { result } = renderHook(() => useGlobalSearch('D'), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    await act(async () => { await result.current.fetchNextPage(); });
    expect(result.current.results).toHaveLength(21);
    expect(result.current.results[20].label).toBe('D4351');
    expect(result.current.hasNextPage).toBe(false);
  });
});