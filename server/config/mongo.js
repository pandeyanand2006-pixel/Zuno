import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

// Fix SRV DNS on networks that block default DNS (college/corporate WiFi)
// Defaults to ISP DNS 10.x which ECONNREFUSED _mongodb._tcp... — fallback to Google/Cloudflare
try { dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch {}

let isConnected = false;

export async function connectMongo() {
  if (!env.mongoUri) return false;
  if (isConnected) return true;
  // Vercel/Render serverless: cache connection on global
  if (global._mongooseConnection) {
    isConnected = true;
    return true;
  }
  try {
    logger.info('Connecting to MongoDB Atlas…');
    await mongoose.connect(env.mongoUri, {
      dbName: 'zuno',
      maxPoolSize: 10,
    });
    isConnected = true;
    global._mongooseConnection = mongoose.connection;
    logger.info('MongoDB Atlas connected');
    return true;
  } catch (e) {
    logger.error('MongoDB connect failed', e.message);
    if (e.message?.includes('whitelist') || e.message?.includes('Could not connect to any servers')) {
      logger.error('-> Atlas IP whitelist: add 0.0.0.0/0 or your IP in Atlas > Network Access');
    }
    // fallback to SQLite — don't crash
    return false;
  }
}

export function isMongoConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

export { mongoose };
