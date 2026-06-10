import React, { createContext, useContext } from 'react';

export interface APIRequestConfig {
  url: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
}

export interface APIClient {
  request<T = any>(config: APIRequestConfig): Promise<T>;
}

export const APIClientContext = createContext<APIClient | null>(null);

export const useAPIClient = (): APIClient | null => {
  return useContext(APIClientContext);
};

export interface APIClientProviderProps {
  client: APIClient;
  children: React.ReactNode;
}

export const APIClientProvider: React.FC<APIClientProviderProps> = ({ client, children }) => {
  return <APIClientContext.Provider value={client}>{children}</APIClientContext.Provider>;
};

/**
 * Creates a default fetch-based API client.
 */
export function createAPIClient(baseURL = ''): APIClient {
  return {
    async request<T = any>(config: APIRequestConfig): Promise<T> {
      const { url, method = 'GET', params, data, headers } = config;

      let fullUrl = `${baseURL}${url}`;

      if (params && Object.keys(params).length > 0) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          if (value !== undefined && value !== null) {
            if (typeof value === 'object' && !Array.isArray(value)) {
              searchParams.append(key, JSON.stringify(value));
            } else {
              searchParams.append(key, String(value));
            }
          }
        }
        fullUrl += `?${searchParams.toString()}`;
      }

      const response = await fetch(fullUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    },
  };
}

export default APIClientProvider;
