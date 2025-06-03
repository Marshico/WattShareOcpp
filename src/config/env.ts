import { z } from 'zod';

// Debug: Log the current state of environment variables
console.log('Current environment variables:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
  DIRECT_URL: process.env.DIRECT_URL ? 'Set' : 'Not set',
  REDIS_URL: process.env.REDIS_URL ? 'Set' : 'Not set',
  PORT: process.env.PORT ? 'Set' : 'Not set',
  CHARGER_SECRET: process.env.CHARGER_SECRET ? 'Set' : 'Not set',
  ADMIN_DASHBOARD_USERNAME: process.env.ADMIN_DASHBOARD_USERNAME ? 'Set' : 'Not set',
  ADMIN_DASHBOARD_PASSWORD: process.env.ADMIN_DASHBOARD_PASSWORD ? 'Set' : 'Not set'
});

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.string().transform(Number),
  CHARGER_SECRET: z.string(),
  ADMIN_DASHBOARD_USERNAME: z.string(),
  ADMIN_DASHBOARD_PASSWORD: z.string(),
  NEXTJS_APP_URL: z.string().url().optional(),
});

let parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);
  console.log('✅ Environment variables validated successfully');
} catch (error) {
  console.error('❌ Invalid environment variables:');
  if (error instanceof z.ZodError) {
    error.errors.forEach((err) => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
  }
  console.error('\nPlease ensure all required environment variables are set in your .env file');
  process.exit(1);
}

export const env = parsedEnv; 