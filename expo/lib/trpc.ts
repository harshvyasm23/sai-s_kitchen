import { createTRPCReact } from "@trpc/react-query";
import { httpLink } from "@trpc/client";
import type { AppRouter } from "@/backend/trpc/app-router";
import superjson from "superjson";
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export const trpc = createTRPCReact<AppRouter>();

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_RORK_API_BASE_URL) {
    console.log('[tRPC] Using EXPO_PUBLIC_RORK_API_BASE_URL:', process.env.EXPO_PUBLIC_RORK_API_BASE_URL);
    return process.env.EXPO_PUBLIC_RORK_API_BASE_URL;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const url = window.location.origin;
    console.log('[tRPC] Using window.location.origin:', url);
    return url;
  }

  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const host = debuggerHost.split(':')[0];
    const url = `http://${host}:8081`;
    console.log('[tRPC] Using debuggerHost:', url);
    return url;
  }

  console.log('[tRPC] Using default localhost:8081');
  return 'http://localhost:8081';
};

const baseUrl = getBaseUrl();
console.log('[tRPC] Final baseUrl:', baseUrl);

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${baseUrl}/api/trpc`,
      transformer: superjson,
      fetch: async (url, options) => {
        try {
          console.log('[tRPC] Fetching:', url);
          const response = await fetch(url, {
            ...options,
            headers: {
              ...options?.headers,
              'Content-Type': 'application/json',
            },
          });
          console.log('[tRPC] Response status:', response.status);
          return response;
        } catch (error) {
          console.error('[tRPC] Fetch error:', error);
          console.error('[tRPC] Failed URL:', url);
          console.error('[tRPC] Base URL:', baseUrl);
          throw new Error(`Failed to connect to backend at ${baseUrl}. Make sure the backend server is running.`);
        }
      },
    }),
  ],
});
