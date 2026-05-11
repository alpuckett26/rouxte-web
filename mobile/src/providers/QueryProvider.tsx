import React from 'react';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:   30_000,        // 30s — feels fresh but avoids hammering /api/*
      gcTime:      1000 * 60 * 60 * 24,  // 24h cache for offline reads
      retry:       2,
      refetchOnReconnect: 'always',
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'rouxte-rq-cache',
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => q.state.status === 'success',
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export { queryClient };
