const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const env = require('../config/env');

// The complete list of IPv4 address ranges that belong to private networks,
// loopback, or reserved allocations. If a user-supplied URL resolves to any
// of these, we block the request - the server must never be used as a proxy
// to reach internal services (database, admin panels, cloud metadata, etc.).
const PRIVATE_RANGES_V4 = [
  { base: '0.0.0.0', prefix: 8 },           // "this" network
  { base: '10.0.0.0', prefix: 8 },           // private LAN (RFC 1918)
  { base: '100.64.0.0', prefix: 10 },        // shared address space used by ISPs (RFC 6598)
  { base: '127.0.0.0', prefix: 8 },          // loopback - 127.0.0.1 is "this machine"
  { base: '169.254.0.0', prefix: 16 },       // link-local - includes AWS metadata at 169.254.169.254
  { base: '172.16.0.0', prefix: 12 },        // private LAN (RFC 1918)
  { base: '192.0.0.0', prefix: 24 },         // IETF protocol assignments
  { base: '192.168.0.0', prefix: 16 },       // private home/office LAN (RFC 1918)
  { base: '198.18.0.0', prefix: 15 },        // benchmarking range - not routable
  { base: '240.0.0.0', prefix: 4 },          // reserved for future use
  { base: '255.255.255.255', prefix: 32 },   // broadcast
];

// Convert a dotted IPv4 string (e.g. "192.168.1.1") to a single 32-bit integer
// so we can do bitmask comparisons against the ranges above.
function ipv4ToUint32(ip) {
  return ip.split('.').reduce((acc, octet) => (acc * 256 + parseInt(octet, 10)) >>> 0, 0);
}

// Check whether a given IPv4 address falls inside any of the blocked ranges.
// We build a bitmask from the prefix length and compare the masked bits.
function isPrivateIPv4(ip) {
  const ipInt = ipv4ToUint32(ip);
  return PRIVATE_RANGES_V4.some(({ base, prefix }) => {
    if (prefix === 0) return true; // covers everything
    // Build a mask that keeps the top "prefix" bits, e.g. /8 gives 0xFF000000
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    // If the masked IP equals the masked base address, the IP is in this range
    return (ipInt & mask) === (ipv4ToUint32(base) & mask);
  });
}

// IPv6 equivalent. We check by string prefix because the ranges we care about
// have well-known prefixes (loopback ::1, link-local fe80::/10, unique-local fc00::/7).
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;          // IPv6 loopback - equivalent to 127.0.0.1
  // fe80::/10 is link-local - covers fe80 through fe bf
  if (lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true;
  // fc00::/7 is unique-local (private LAN equivalent in IPv6)
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('::ffff:')) {
    // An IPv4-mapped IPv6 address embeds an IPv4 address after "::ffff:".
    // We strip the prefix and check the embedded IPv4 address normally.
    const v4Part = lower.slice(7);
    if (net.isIPv4(v4Part) && isPrivateIPv4(v4Part)) return true;
  }
  return false;
}

// Unified check: determine if an address string (IPv4 or IPv6) is private.
// If we cannot determine the format, we block it by default (fail-safe).
function isPrivateAddress(addr) {
  if (net.isIPv4(addr)) return isPrivateIPv4(addr);
  if (net.isIPv6(addr)) return isPrivateIPv6(addr);
  return true; // unrecognised format - block rather than allow
}

// Read the optional domain allow-list from the environment.
// If set, only domains listed here (or their subdomains) can be fetched.
function getAllowedDomains() {
  return env.SSRF_ALLOWED_DOMAINS
    ? env.SSRF_ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
    : [];
}

// Full SSRF safety check for a URL before we make any outbound fetch.
// Returns { safe: true, resolvedIp } on success or { safe: false, reason } on failure.
async function checkUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl); // parse the URL to extract hostname, protocol, etc.
  } catch {
    return { safe: false, reason: 'Invalid URL' }; // malformed URL - reject immediately
  }

  // Block non-HTTP schemes. file://, ftp://, gopher://, dict:// etc. could
  // be used to read local files or probe internal services.
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: 'Only http and https URLs are allowed' };
  }

  // If a domain allow-list is configured, the hostname must appear on it.
  // This stops an attacker from supplying any arbitrary internet URL.
  const allowedDomains = getAllowedDomains();
  if (allowedDomains.length > 0) {
    const hostname = parsed.hostname.toLowerCase();
    const permitted = allowedDomains.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (!permitted) {
      return { safe: false, reason: 'Domain not in the SSRF allow-list' };
    }
  }

  // Resolve the hostname to an IP address NOW, before we fetch.
  // An attacker could register "safe-looking.com" and point its DNS at 10.0.0.1.
  // By resolving here and checking the result, we catch that.
  let resolved;
  try {
    const result = await dns.lookup(parsed.hostname);
    resolved = result.address;
  } catch {
    return { safe: false, reason: 'Hostname could not be resolved' };
  }

  // Check the resolved IP against every private/reserved range.
  if (isPrivateAddress(resolved)) {
    return { safe: false, reason: 'URL resolves to a private or reserved IP address' };
  }

  return { safe: true, resolvedIp: resolved };
}

// The only function callers use. It runs the full safety check first,
// then fetches with redirect:'error'.
//
// redirect:'error' is critical: without it, an attacker could supply a URL
// that points to a public server, but that server immediately redirects to
// http://169.254.169.254/ (AWS instance metadata). By the time the redirect
// fires, our DNS check has already passed. Setting redirect:'error' means
// the fetch throws on any 3xx response instead of following it.
async function safeFetch(rawUrl, options = {}) {
  const check = await checkUrl(rawUrl);
  if (!check.safe) {
    const err = new Error(`SSRF check failed: ${check.reason}`);
    err.status = 400;
    throw err;
  }

  // Only reach here if checkUrl returned safe:true - fetch with no redirects
  const response = await fetch(rawUrl, {
    ...options,
    redirect: 'error', // any redirect throws - prevents redirect-based bypass
  });

  return response;
}

module.exports = { checkUrl, safeFetch };
