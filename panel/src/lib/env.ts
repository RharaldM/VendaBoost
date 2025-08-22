import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_BRIDGE_URL: z.string().default('http://127.0.0.1:49017'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_BRIDGE_URL: process.env.NEXT_PUBLIC_BRIDGE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

export type Env = z.infer<typeof envSchema>;