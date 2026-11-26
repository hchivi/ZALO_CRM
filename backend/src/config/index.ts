import path from 'path';

function resolveUploadDir(): string {
  const envDir = process.env.UPLOAD_DIR;
  if (!envDir) return path.join(process.cwd(), 'uploads');
  // If running on Linux/macOS but envDir is a Windows path (e.g. C:\...), fallback to process.cwd()/uploads
  if (process.platform !== 'win32' && /^[a-zA-Z]:[/\\]/.test(envDir)) {
    return path.join(process.cwd(), 'uploads');
  }
  return envDir;
}

export const config = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  encryptionKey: process.env.ENCRYPTION_KEY || 'dev-key-change-me-16b',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://crmuser:password@localhost:5432/zalocrm',
  uploadDir: resolveUploadDir(),
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  isProduction: process.env.NODE_ENV === 'production',
};
