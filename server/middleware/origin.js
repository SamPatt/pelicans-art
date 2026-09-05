// The authoring API is private. CORS alone does not stop cross-site writes.
export function isAllowedOrigin(req, extraOrigins = '') {
  const origin = req.headers.origin;
  if (!origin) return true; // CLI tools and server-to-server clients.
  const allowed = extraOrigins.split(',').map(value => value.trim()).filter(value => value && value !== '*');
  if (allowed.includes(origin)) return true;
  try {
    const url = new URL(origin);
    const protocol = req.socket.encrypted ? 'https:' : 'http:';
    return url.origin === origin && url.protocol === protocol && url.host === req.headers.host;
  } catch {
    return false;
  }
}

export function originGuard(extraOrigins = '') {
  return (req, res, next) => {
    if (!isAllowedOrigin(req, extraOrigins)) {
      return res.status(403).json({ error: true, message: 'This browser origin is not allowed to access the local studio.' });
    }
    next();
  };
}
