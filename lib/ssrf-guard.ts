import dns from 'dns';
import { promisify } from 'util';
import { Agent, fetch as undiciFetch } from 'undici';

const lookup = promisify(dns.lookup);

/**
 * Check if a given IP address is loopback, link-local, private, or unspecified.
 */
export function isPrivateIp(ip: string): boolean {
  // Check IPv4
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);
  if (match) {
    const octet1 = parseInt(match[1], 10);
    const octet2 = parseInt(match[2], 10);
    const octet3 = parseInt(match[3], 10);
    const octet4 = parseInt(match[4], 10);

    if (
      octet1 < 0 || octet1 > 255 ||
      octet2 < 0 || octet2 > 255 ||
      octet3 < 0 || octet3 > 255 ||
      octet4 < 0 || octet4 > 255
    ) {
      return true; // Treat invalid octet ranges as unsafe
    }

    // Loopback: 127.0.0.0/8
    if (octet1 === 127) return true;

    // Private network Class A: 10.0.0.0/8
    if (octet1 === 10) return true;

    // Private network Class B: 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
    if (octet1 === 172 && octet2 >= 16 && octet2 <= 31) return true;

    // Private network Class C: 192.168.0.0/16
    if (octet1 === 192 && octet2 === 168) return true;

    // Link-local: 169.254.0.0/16
    if (octet1 === 169 && octet2 === 254) return true;

    // Unspecified: 0.0.0.0
    if (octet1 === 0 && octet2 === 0 && octet3 === 0 && octet4 === 0) return true;

    return false;
  }

  // Check IPv6
  const cleanIp = ip.toLowerCase().trim();
  // Loopback: ::1
  if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1') return true;
  // Unspecified: ::
  if (cleanIp === '::' || cleanIp === '0:0:0:0:0:0:0:0') return true;
  // Link-local: fe80::/10
  if (cleanIp.startsWith('fe80:')) return true;
  // Unique local: fc00::/7
  if (cleanIp.startsWith('fc00:') || cleanIp.startsWith('fd00:')) return true;

  return false;
}

/**
 * Validate that a URL uses safe protocols (http/https) and resolves to a public, non-private IP.
 */
export async function isSafeUrl(urlStr: string): Promise<boolean> {
  try {
    const parsedUrl = new URL(urlStr);

    // Only allow http and https protocols
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return false;
    }

    const hostname = parsedUrl.hostname;

    // If it's already an IP address, validate it directly
    if (/^[0-9.]+$/.test(hostname) || hostname.includes(':')) {
      return !isPrivateIp(hostname);
    }

    // Resolve the domain name to its IP address
    const { address } = await lookup(hostname);
    return !isPrivateIp(address);
  } catch (error) {
    // If parsing fails or DNS fails, treat as unsafe
    return false;
  }
}

/**
 * Safely fetch a URL by preventing DNS rebinding (TOCTOU).
 * It resolves the IP once, validates it, and forces the HTTP client to use that exact IP.
 */
export async function safeFetch(urlStr: string, options?: any): Promise<Response> {
  const parsedUrl = new URL(urlStr);

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('Unsupported protocol');
  }

  const hostname = parsedUrl.hostname;

  let ip = hostname;
  if (!(/^[0-9.]+$/.test(hostname) || hostname.includes(':'))) {
    try {
      const lookupResult = await lookup(hostname);
      ip = lookupResult.address;
    } catch (err) {
      throw new Error('Failed to resolve hostname');
    }
  }

  if (isPrivateIp(ip)) {
    throw new Error('Unsafe or private IP address resolved');
  }

  // Create a custom dispatcher that forces connection to the validated IP
  const agent = new Agent({
    connect: {
      lookup: (host, opts, callback) => {
        // Bypass normal DNS resolution and use the IP we just validated
        callback(null, [{ address: ip, family: ip.includes(':') ? 6 : 4 }]);
      },
    },
  });

  return undiciFetch(urlStr, { ...options, dispatcher: agent }) as unknown as Promise<Response>;
}
