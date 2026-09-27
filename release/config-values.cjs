const httpsUrl = value => {
  if (typeof value !== 'string' || /\s/.test(value)) return false;
  try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password; } catch { return false; }
};
const email = value => typeof value === 'string' && /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(value);
module.exports = { httpsUrl, email };
