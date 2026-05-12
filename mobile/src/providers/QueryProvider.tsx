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

// Query keys whose responses are too big for Android SQLite's 2MB-per-row
// CursorWindow limit. Persisting these caused "Row too big to fit into
// CursorWindow" errors on launch and the entire cache being discarded.
// Refetch on next open instead — they're cheap enough.
const NON_PERSISTED_KEY_PREFIXES = [
  'fcc-coverage',     // up to 50k AT&T address points OR 3k hex polygons
  'fcc-blocks',       // FCC block polygons
  'fiber-heatmap',    // BDC lead heatmap GeoJSON
  'leads-map',        // map viewport's leads list
];

export function QueryProvider({ children }: { children: React.ReactNode }) {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h
        dehydrateOptions: {
          shouldDehydrateQuery: (q) => {
            if (q.state.status !== 'success') return false;
            const key = String(q.queryKey?.[0] ?? '');
            return !NON_PERSISTED_KEY_PREFIXES.includes(key);
          },
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}

export { queryClient };
