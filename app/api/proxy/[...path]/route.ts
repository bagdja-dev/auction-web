import { NextRequest, NextResponse } from 'next/server';

import { backendFetch } from '@/lib/backend-api';

type RouteContext = { params: Promise<{ path: string[] }> };

function buildPath(segments: string[], searchParams: URLSearchParams): string {
  const path = '/' + segments.join('/');
  const qs = searchParams.toString();
  return qs ? `${path}?${qs}` : path;
}

async function proxyRequest(request: NextRequest, context: RouteContext) {
  const { path: segments } = await context.params;
  const path = buildPath(segments, request.nextUrl.searchParams);
  const method = request.method;

  const options: RequestInit = { method };

  if (method !== 'GET' && method !== 'HEAD') {
    const body = await request.text();
    if (body) options.body = body;
  }

  const result = await backendFetch(path, options);

  if (result.status === 401) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  if (!result.data && result.status >= 400) {
    return NextResponse.json(
      { error: result.error ?? 'Request failed' },
      { status: result.status },
    );
  }

  if (result.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json(result.data, { status: result.status });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PATCH = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
