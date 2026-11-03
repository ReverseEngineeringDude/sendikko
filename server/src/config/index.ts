import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

function cleanDatabaseUrl(url?: string): string | undefined {
  if (!url) return url;
  let res = url.trim();
  // 1. Replace unroutable IPv6 direct domain with IPv4 pooler
  if (res.includes('db.cioeerrhpqiqmsbouufp.supabase.co')) {
    res = res
      .replace('db.cioeerrhpqiqmsbouufp.supabase.co:5432', 'aws-1-eu-central-1.pooler.supabase.com:6543')
      .replace('postgres:', 'postgres.cioeerrhpqiqmsbouufp:');
  }
  // 2. Fix unencoded '@' in password '@Red_is_god_03'
  if (res.includes(':@Red_is_god_03@')) {
    res = res.replace(':@Red_is_god_03@', ':%40Red_is_god_03@');
  }
  // 3. Ensure pgbouncer=true if connecting to port 6543
  if (res.includes(':6543') && !res.includes('pgbouncer=true')) {
    res += res.includes('?') ? '&pgbouncer=true' : '?pgbouncer=true';
  }
  return res;
}

if (process.env.DATABASE_URL) {
  process.env.DATABASE_URL = cleanDatabaseUrl(process.env.DATABASE_URL);
}
if (process.env.DIRECT_URL) {
  process.env.DIRECT_URL = cleanDatabaseUrl(process.env.DIRECT_URL);
}

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  CLIENT_URL: z.string().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DIRECT_URL: z.string().optional(),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),
  CHUNK_ENC_KEY: z.string().length(64, 'CHUNK_ENC_KEY must be a 64-character (32-byte) hex string'),
  IP_SALT: z.string().min(8, 'IP_SALT must be at least 8 characters'),
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHANNEL_ID: z.string().min(1, 'TELEGRAM_CHANNEL_ID is required'),
  TELEGRAM_API_ROOT: z.string().default('https://api.telegram.org'),
  FIREBASE_PROJECT_ID: z.string().default('sendikko-8b6e6'),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional().default('mock-client-id'),
  CHUNK_SIZE_MB: z.coerce.number().default(19),
  MAX_USER_QUOTA_BYTES: z.coerce.bigint().default(BigInt(10737418240)), // 10 GB
});

const parseConfig = () => {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    if (process.env.NODE_ENV === 'test') {
      return {
        NODE_ENV: 'test',
        PORT: 4000,
        CLIENT_URL: 'http://localhost:5173',
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://sendikko:sendikko@localhost:5432/sendikko?schema=public',
        DIRECT_URL: undefined,
        JWT_ACCESS_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef',
        JWT_REFRESH_SECRET: 'fedcba9876543210fedcba9876543210fedcba9876543210',
        COOKIE_SECRET: 'cookie_secret_super_secure_123',
        CHUNK_ENC_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        IP_SALT: 'secure_ip_salt_123',
        TELEGRAM_BOT_TOKEN: '123456:mock_token',
        TELEGRAM_CHANNEL_ID: '-100123456789',
        TELEGRAM_API_ROOT: 'https://api.telegram.org',
        FIREBASE_PROJECT_ID: 'sendikko-test',
        FIREBASE_SERVICE_ACCOUNT_KEY: undefined,
        GOOGLE_CLIENT_ID: 'mock-google-client-id.apps.googleusercontent.com',
        CHUNK_SIZE_MB: 19,
        MAX_USER_QUOTA_BYTES: BigInt(10737418240),
      };
    }
    console.error('Configuration validation failed:');
    result.error.issues.forEach((issue) => {
      console.error(`- ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
};

export const config = parseConfig();
export type Config = z.infer<typeof configSchema>;
