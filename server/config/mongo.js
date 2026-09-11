import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

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
    // fallback to SQLite — don't crash
    return false;
  }
}

export function isMongoConnected() {
  return isConnected && mongoose.connection.readyState === 1;
}

export { mongoose };
