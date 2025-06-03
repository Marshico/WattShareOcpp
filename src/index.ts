import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';

// Get the absolute path to the .env file
const envPath = path.resolve(process.cwd(), '.env');

// Check if .env file exists
if (!fs.existsSync(envPath)) {
  console.error(`❌ .env file not found at: ${envPath}`);
  console.error('Please create a .env file with the required environment variables');
  process.exit(1);
}

// Read the .env file content for debugging
const envContent = fs.readFileSync(envPath, 'utf8');
console.log('Raw .env file content:', envContent);

// Load environment variables with explicit path
const result = config({ path: envPath, override: true });

if (result.error) {
  console.error('❌ Error loading .env file:', result.error);
  process.exit(1);
}

// Debug environment variables
console.log('Environment variables loaded from:', envPath);
console.log('Environment variables:', {
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
  REDIS_URL: process.env.REDIS_URL,
  PORT: process.env.PORT,
  CHARGER_SECRET: process.env.CHARGER_SECRET,
  ADMIN_DASHBOARD_USERNAME: process.env.ADMIN_DASHBOARD_USERNAME,
  ADMIN_DASHBOARD_PASSWORD: process.env.ADMIN_DASHBOARD_PASSWORD,
  NEXTJS_APP_URL: process.env.NEXTJS_APP_URL
});

// Import server after environment variables are loaded
import { app } from './server';

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 