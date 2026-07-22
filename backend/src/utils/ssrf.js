const dns = require('dns').promises;
const net = require('net');
const { URL } = require('url');
const env = require('../config/env');

// IPv4 private, loopback, and reserved ranges that must never be the target
// of an outbound server-side fetch. An attacker who controls the URL could
// otherwise use this server as a proxy to reach internal services.
const PRIVATE_RANGES_V4 = [
  { base: '0.0.0.0', prefix: 8 },
  { base: '10.0.0.0', prefix: 8 },
  { base: '100.64.0.0', prefix: 10 }, // shared address space (RFC 6598)
  { base: '127.0.0.0', prefix: 8 },   // loopback
  { base: '169.254.0.0', prefix: 16 }, // link-local
  { base: '172.16.0.0', prefix: 12 },
  { base: '192.0.0.0', prefix: 24 },  // IETF protocol assignments
  { base: '192.168.0.0', prefix: 16 },
  { base: '198.18.0.0', prefix: 15 }, // benchmarking
  { base: '240.0.0.0', prefix: 4 },   // reserved
  { base: '255.255.255.255', prefix: 32 },
];

function ipv4ToUint32(ip) {
  return ip.split('.').reduce((acc, octet) => (acc * 256 + parseInt(octet, 10)) >>> 0, 0);
}

function isPrivateIPv4(ip) {
  const ipInt = ipv4ToUint32(ip);
  return PRIVATE_RANGES_V4.some(({ base, prefix }) => {
    if (prefix === 0) return true;
    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    return (ipInt & mask) === (ipv4ToUint32(base) & mask);
  });
}

// IPv6 private/loopback/link-local ranges. Checking by prefix string is
// sufficient for the ranges we care about (loopback ::1, link-local fe80::/10,
// unique-local fc00::/7).
function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true;
  if (lower.startsWith('fe8') || lower.startsWith('fe9') ||
      lower.startsWith('fea') || lower.startsWith('feb')) return true; // fe80::/10
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local
  if (lower.startsWith('::ffff:')) {
    // IPv4-mapped IPv6: check the embedded IPv4 address.
    const v4Part = lower.slice(7);
    if (net.isIPv4(v4Part) && isPrivateIPv4(v4Part)) return true;
  }
  return false;
}

function isPrivateAddress(addr) {
  if (net.isIPv4(addr)) return isPrivateIPv4(addr);
  if (net.isIPv6(addr)) return isPrivateIPv6(addr);
  return true; // unknown format: block by default
}

function getAllowedDomains() {
  return env.SSRF_ALLOWED_DOMAINS
    ? env.SSRF_ALLOWED_DOMAINS.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean)
    : [];
}

async function checkUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, reason: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { safe: false, reason: 'Only http and https URLs are allowed' };
  }

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

  let resolved;
  try {
    const result = await dns.lookup(parsed.hostname);
    resolved = result.address;
  } catch {
    return { safe: false, reason: 'Hostname could not be resolved' };
  }

  if (isPrivateAddress(resolved)) {
    return { safe: false, reason: 'URL resolves to a private or reserved IP address' };
  }

  return { safe: true, resolvedIp: resolved };
}

// Fetches a URL only after verifying it passes the SSRF check. Redirects are
// deliberately disabled: a redirect could bypass the IP check by pointing to
// a private address that was not present in the original DNS lookup.
async function safeFetch(rawUrl, options = {}) {
  const check = await checkUrl(rawUrl);
  if (!check.safe) {
    const err = new Error(`SSRF check failed: ${check.reason}`);
    err.status = 400;
    throw err;
  }

  const response = await fetch(rawUrl, {
    ...options,
    redirect: 'error',
  });

  return response;
}

module.exports = { checkUrl, safeFetch };
