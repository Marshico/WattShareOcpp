import { z } from 'zod';

// Define the schema for environment variables
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  DIRECT_URL: z.string().url('DIRECT_URL must be a valid URL'),

  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // Server
  PORT: z.string().transform(Number).pipe(z.number().int().positive('PORT must be a positive integer')),

  // Authentication
  CHARGER_SECRET: z.string().min(1, 'CHARGER_SECRET is required'),
  ADMIN_DASHBOARD_USERNAME: z.string().min(1, 'ADMIN_DASHBOARD_USERNAME is required'),
  ADMIN_DASHBOARD_PASSWORD: z.string().min(1, 'ADMIN_DASHBOARD_PASSWORD is required'),

  // Optional: Next.js app URL for CORS
  NEXTJS_APP_URL: z.string().url('NEXTJS_APP_URL must be a valid URL').optional(),
});

// Parse and validate environment variables
const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:');
  const formattedErrors = _env.error.format();
  Object.entries(formattedErrors).forEach(([key, value]) => {
    if (key !== '_errors' && typeof value === 'object' && value !== null && '_errors' in value) {
      const errors = (value as { _errors: string[] })._errors;
      if (errors.length > 0) {
        console.error(`  ${key}: ${errors.join(', ')}`);
      }
    }
  });
  console.error('\nPlease ensure all required environment variables are set in your .env file');
  process.exit(1);
}

// Export validated environment variables
export const env = _env.data; 