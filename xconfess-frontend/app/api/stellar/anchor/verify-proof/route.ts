import { resolveBackendRoute } from '@/app/lib/api/proxy';
import { createApiErrorResponse } from '@/lib/apiErrorHandler';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return createApiErrorResponse('Invalid proof JSON body', { status: 400 });
  }

  try {
    const backend = resolveBackendRoute(
      request,
      '/stellar/anchor/verify-proof',
    );
    const response = await fetch(backend.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const responseBody = await response.text();
    return new Response(responseBody, {
      status: response.status,
      headers: {
        'Content-Type':
          response.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch {
    return createApiErrorResponse(
      'Anchor proof verification is temporarily unavailable. Please retry.',
      { status: 503, route: 'POST /api/stellar/anchor/verify-proof' },
    );
  }
}
