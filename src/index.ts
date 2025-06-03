import { config } from 'dotenv';
import path from 'path';
import fs from 'fs';
import { startHttpAndOcppServer } from './server'; // Import the new function from server.ts
import { logInfo, logError, OcppMessageType, LogDirection } from './services/logService';
import { env } from './config/env';

// Debug: Log the current working directory and .env file path
const envPath = path.resolve(process.cwd(), '.env');
console.log('Current working directory:', process.cwd());
console.log('Looking for .env file at:', envPath);

// Check if .env file exists and load it
if (!fs.existsSync(envPath)) {
  console.error(`❌ FATAL ERROR: .env file not found at: ${envPath}`);
  console.error('Please create a .env file with the required environment variables.');
  process.exit(1);
}

console.log('Found .env file, attempting to load...');

// Load environment variables
const result = config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

// Debug: Log if .env file was found and loaded
if (result.parsed) {
  console.log('✅ .env file found and loaded');
  console.log('Available environment variables:', {
    DATABASE_URL: process.env.DATABASE_URL ? 'Set' : 'Not set',
    DIRECT_URL: process.env.DIRECT_URL ? 'Set' : 'Not set',
    REDIS_URL: process.env.REDIS_URL ? 'Set' : 'Not set',
    PORT: process.env.PORT ? 'Set' : 'Not set',
    CHARGER_SECRET: process.env.CHARGER_SECRET ? 'Set' : 'Not set',
    ADMIN_DASHBOARD_USERNAME: process.env.ADMIN_DASHBOARD_USERNAME ? 'Set' : 'Not set',
    ADMIN_DASHBOARD_PASSWORD: process.env.ADMIN_DASHBOARD_PASSWORD ? 'Set' : 'Not set'
  });
} else {
  console.error('❌ .env file not found or empty');
}

// Main server startup
(async () => {
  try {
    // Start the server logic, which returns the http server instance
    const { httpServer, ocppServer } = await startHttpAndOcppServer();
    const port = process.env.PORT || 3000; // Port will be validated in config/env.ts by 'env' import

    httpServer.listen(port, () => {
      console.log(`✅ OCPP Central System Backend is running on port ${port}`);
      console.log(`   Connect chargers to ws://localhost:${port}/ocpp/<chargerIdentity> (for local testing)`);
      console.log(`   API endpoints available at http://localhost:${port}/api/`);
    });

    // Graceful Shutdown for the entire process
    const gracefulShutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);
      try {
        // Close the HTTP server, which will stop accepting new connections
        await new Promise<void>((resolve, reject) => {
          httpServer.close((err) => {
            if (err) {
              console.error('Error closing HTTP server:', err);
              return reject(err);
            }
            resolve();
          });
        });

        // Close the OCPP server, waiting for pending messages
        await ocppServer.close({ awaitPending: true, force: false });

        // Prisma client graceful disconnect is handled automatically by its own listener in prismaClient.ts
        
        console.log('✅ HTTP and OCPP server closed gracefully. Exiting.');
        process.exit(0);
      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM')); // kill signal

    logInfo('Server started successfully', {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });

  } catch (error) {
    logError('Failed to start server:', error, {
      ocppMessageType: OcppMessageType.SYSTEM,
      direction: LogDirection.SERVER,
    });
    process.exit(1);
  }
})(); 