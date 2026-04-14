export const getAssetUrl = (path) => {
  if (!path) return path;
  if (typeof path !== 'string') return path;
  
  // If it's already an absolute URL, return it
  if (path.startsWith('http')) return path;
  
  // If it's a relative path starting with /uploads, prepend the base URL
  if (path.startsWith('/uploads')) {
    const baseUrl = (import.meta.env.VITE_BASE_URL || '').trim();
    // Ensure we don't end up with double slashes if baseUrl has a trailing slash
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    return `${normalizedBase}${path}`;
  }
  
  return path;
};
