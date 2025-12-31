import type { Configuration } from '@azure/msal-browser';
import { LogLevel } from '@azure/msal-browser';

// API base URL
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Azure auth config cache
let cachedAuthConfig: { azure_tenant_id: string; azure_client_id: string } | null = null;

/**
 * Fetch Azure auth config from the API
 * Falls back to environment variables if API call fails
 */
export async function fetchAuthConfig(): Promise<{ tenantId: string; clientId: string }> {
  // Return cached config if available
  if (cachedAuthConfig) {
    return {
      tenantId: cachedAuthConfig.azure_tenant_id,
      clientId: cachedAuthConfig.azure_client_id,
    };
  }

  try {
    const response = await fetch(`${API_URL}/settings/auth-config`);
    if (response.ok) {
      cachedAuthConfig = await response.json();
      if (cachedAuthConfig && (cachedAuthConfig.azure_tenant_id || cachedAuthConfig.azure_client_id)) {
        console.log('Azure auth config loaded from database');
        return {
          tenantId: cachedAuthConfig.azure_tenant_id || import.meta.env.VITE_AZURE_TENANT_ID || 'common',
          clientId: cachedAuthConfig.azure_client_id || import.meta.env.VITE_AZURE_CLIENT_ID || '',
        };
      }
    }
  } catch (error) {
    console.warn('Failed to fetch auth config from API, using environment variables:', error);
  }

  // Fallback to environment variables
  return {
    tenantId: import.meta.env.VITE_AZURE_TENANT_ID || 'common',
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID || '',
  };
}

/**
 * Create MSAL configuration with the given tenant and client IDs
 */
export function createMsalConfig(tenantId: string, clientId: string): Configuration {
  return {
    auth: {
      clientId: clientId,
      authority: `https://login.microsoftonline.com/${tenantId}`,
      redirectUri: window.location.origin,
      postLogoutRedirectUri: '/',
      navigateToLoginRequestUrl: false,
    },
    cache: {
      cacheLocation: 'sessionStorage',
      storeAuthStateInCookie: false,
    },
    system: {
      loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
          if (containsPii) return;
          switch (level) {
            case LogLevel.Error:
              console.error(message);
              break;
            case LogLevel.Warning:
              console.warn(message);
              break;
            case LogLevel.Info:
              console.info(message);
              break;
            case LogLevel.Verbose:
              console.debug(message);
              break;
          }
        },
      },
    },
  };
}

/**
 * Create API request scopes for the given client ID
 */
export function createApiRequest(clientId: string) {
  return {
    scopes: [`${clientId}/.default`],
  };
}

// Default config using environment variables (for backwards compatibility)
export const msalConfig: Configuration = createMsalConfig(
  import.meta.env.VITE_AZURE_TENANT_ID || 'common',
  import.meta.env.VITE_AZURE_CLIENT_ID || ''
);

// Scopes for Microsoft Graph (user photo, profile)
export const loginRequest = {
  scopes: ['User.Read'],
};

// Scopes for our own API - uses the client ID as the audience
const CLIENT_ID = import.meta.env.VITE_AZURE_CLIENT_ID || '';
export const apiRequest = {
  scopes: [`${CLIENT_ID}/.default`],
};

export const graphConfig = {
  graphMeEndpoint: 'https://graph.microsoft.com/v1.0/me',
  graphMePhotoEndpoint: 'https://graph.microsoft.com/v1.0/me/photo/$value',
};
