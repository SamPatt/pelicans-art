// Never forward a server-owned secret to a destination chosen by the caller.
export function proxyAuthHeaders({ target, preset, authHeader, authToken }, { endpoint, token, header = 'X-Watch-Token' } = {}) {
  if (authHeader && authToken) return { [authHeader]: authToken };
  if (preset !== 'hermes-piper' || !endpoint || !token) return {};
  let configured;
  try { configured = new URL(endpoint); } catch { return {}; }
  if (target.href !== configured.href) return {};
  return { [header]: token };
}
