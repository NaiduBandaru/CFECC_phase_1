import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'cfecc-enterprise-super-secret-key-2026-vzkp',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  databaseUrl: process.env.DATABASE_URL || '',
  uploadDir: path.resolve(process.cwd(), 'uploads'),
  corsOrigins: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:5173', 'http://127.0.0.1:5173'],
  clientDetails: {
    name: 'CFECC Stores',
    location: 'Visakhapatnam, Andhra Pradesh, India',
    gstin: '37AAAAA0000A1Z5',
  }
};
