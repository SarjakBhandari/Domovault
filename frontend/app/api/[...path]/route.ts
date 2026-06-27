import { NextRequest, NextResponse } from 'next/server';

// Every /api/* request from the browser is forwarded here, server-side, to the
// Express backend. The backend origin is never reachable from the browser
// directly - this is the only same-origin surface, which is what lets us use
// httpOnly cookies safely and keeps CORS exposure to a single trusted caller.
//
// This proxy never inspects, decodes, or makes trust decisions based on the
// contents of any auth token - it only forwards the Cookie/Authorization
// headers byte-for-byte and lets the backend's jwt.verify() be the sole
// authority on whether a token is valid.

const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN ?? 'http://localhost:4000';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
  'host',
  'content-length',
]);

async function proxy(req: NextRequest, path: string[]) {
  const targetUrl = new URL(`/api/${path.join('/')}`, BACKEND_ORIGIN);
  targetUrl.search = req.nextUrl.search;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const hasBody = !['GET', 'HEAD'].includes(req.method);

  const backendResponse = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    redirect: 'manual',
    cache: 'no-store',
  });

  const responseHeaders = new Headers();
  backendResponse.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      responseHeaders.append(key, value);
    }
  });

  const body = await backendResponse.arrayBuffer();

  return new NextResponse(body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

type RouteParams = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  return proxy(req, (await params).path);
}
