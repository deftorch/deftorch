type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const isDev = process.env.NODE_ENV !== 'production';
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(meta && { meta }),
  };

  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else if (level === 'warn') {
    if (isDev) {
      console.warn(`[${level.toUpperCase()}] ${message}`, meta ?? '');
    } else {
      console.warn(JSON.stringify(entry));
    }
  } else if (isDev) {
    // In development, use a human-readable format
    console.log(`[${level.toUpperCase()}] ${message}`, meta ?? '');
  } else {
    // In production, use JSON for log aggregators
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};
