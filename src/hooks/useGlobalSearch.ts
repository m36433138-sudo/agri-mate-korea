import { useEffect, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type SearchResult = {
  id: string; label: string; sub: string;
  category: 'machine' | 'customer' | 'repair' | 'part'; link: string;
};
export const SEARCH_PAGE_SIZE = 20;

export function useGlobalSearch(query: string) {
  const term = query.trim();
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(timer);
  }, [term]);
  const search = useInfiniteQuery({
    queryKey: ['global-search', debounced],
    enabled: !!debounced && term === debounced,
    initialPageParam: 0,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error } = await supabase.rpc('global_search', {
        search_query: debounced, page_offset: pageParam, page_size: SEARCH_PAGE_SIZE,
      }).abortSignal(signal);
      if (error) throw new Error(error.message);
      return (data ?? []) as SearchResult[];
    },
    getNextPageParam: (page, pages) => page.length === SEARCH_PAGE_SIZE ? pages.length * SEARCH_PAGE_SIZE : undefined,
    staleTime: 120_000,
    gcTime: 600_000,
    retry: 1,
  });
  const current = term === debounced && !!term;
  return {
    ...search,
    results: current ? search.data?.pages.flat() ?? [] : [],
    pending: !!term && (!current || search.isPending),
    isError: current && search.isError,
    hasNextPage: current && search.hasNextPage,
  };
}