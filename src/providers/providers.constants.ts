export const DEV_ENDPOINTS = {
  taker: 'ws://localhost:3100/taker',
  maker: 'ws://localhost:3100/maker',
  data: 'ws://localhost:3100/data',
} as const;

export const MAX_RETRY_ATTEMPTS = 6;
export const RETRY_DELAY = 1000;
