import { z } from "zod";

export const ROUTES = {
  HOME: '/',
  CHAT: '/chat',
  MEMBERS: '/members'
};

export const api = {
  codes: {
    search: { path: '/api/codes/search' },
    get: { path: '/api/codes/:type/:code' }
  },
  favorites: {
    list: { path: '/api/favorites' },
    create: { 
      path: '/api/favorites',
      method: 'POST',
      input: z.object({
        userId: z.number(),
        codeType: z.string(),
        code: z.string(),
        description: z.string(),
      })
    },
    delete: { path: '/api/favorites/:id', method: 'DELETE' }
  },
  guidelines: {
    get: { path: '/api/guidelines' }
  },
  workspace: {
    analyze: { path: '/api/workspace/analyze' }
  }
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url = url.replace(`:${key}`, encodeURIComponent(String(value)));
    }
  }
  return url;
}
