export const MAX_PREVIEW_BYTES = 500 * 1024;
export const PREVIEW_SOURCES = { 'unity-preview': 'Unity preview', device: 'Device screenshot' };
export function validatePreviewImage(dataUrl) {
  if (typeof dataUrl !== 'string' || dataUrl.length > MAX_PREVIEW_BYTES * 1.34 + 100) throw Error('Choose a PNG or JPEG smaller than 500 KB.');
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match || match[2].length % 4) throw Error('This is not a supported screenshot.');
  const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
  const png = bytes.length >= 24 && [137,80,78,71,13,10,26,10].every((b,i) => bytes[i] === b);
  const jpeg = bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217;
  if (!bytes.length || bytes.length > MAX_PREVIEW_BYTES || !(match[1] === 'image/png' ? png : jpeg)) throw Error('The screenshot format or size is invalid.');
  return { mime: match[1], bytes: bytes.length, dataUrl };
}
export function safeStoreLink(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'play.google.com' && !u.username && !u.password && u.pathname === '/store/apps/details' && /^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+$/.test(u.searchParams.get('id') || '') && [...u.searchParams.keys()].every(k => k === 'id') && !u.hash ? u.href : ''; } catch { return ''; }
}
export function validatePreviewMetadata(value, now = Date.now()) {
  if (!['sikhi-khoj','drivenix','reflex-trainer','brainforge-company','bcc-improvements'].includes(value.projectId)) throw Error('Choose a known project.');
  for (const [key,max] of [['title',120],['caption',600],['origin',240]]) if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > max) throw Error('Provide a short title, caption and capture origin.');
  if (!PREVIEW_SOURCES[value.source]) throw Error('Source must be unity-preview or device.');
  if (!Number.isFinite(value.capturedAt) || value.capturedAt > now + 60000 || value.capturedAt < now - 7*86400000) throw Error('Use an actual capture from the last seven days.');
  return value;
}
