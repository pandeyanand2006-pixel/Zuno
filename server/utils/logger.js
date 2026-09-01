const isProd = process.env.NODE_ENV === 'production';

function ts() {
  return new Date().toISOString();
}

export const logger = {
  info: (msg, meta) => console.log(`[${ts()}] INFO  ${msg}`, meta ? JSON.stringify(meta) : ''),
  warn: (msg, meta) => console.warn(`[${ts()}] WARN  ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg, err) => {
    const detail = err && err.stack ? err.stack : (err ? JSON.stringify(err) : '');
    console.error(`[${ts()}] ERROR ${msg}`, detail);
  },
  audit: (msg, meta) => console.log(`[${ts()}] AUDIT ${msg}`, meta ? JSON.stringify(meta) : ''),
};

export function safeLogSensitive() {
  // Never call this with secrets. Placeholder for clarity.
  if (isProd) return;
}
