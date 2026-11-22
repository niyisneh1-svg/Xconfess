import { resolveBackendRoute } from '@/app/lib/api/proxy';
import { createApiErrorResponse } from '@/lib/apiErrorHandler';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ commitment: string }> },
) {
  const { commitment } = await params;
  if (!/^[0-9a-fA-F]{64}$/.test(commitment)) {
    return createApiErrorResponse('Invalid commitment format', {
      status: 400,
    });
  }

  try {
    const backend = resolveBackendRoute(
      request,
      `/stellar/anchor/proofs/${commitment}`,
    );
    const response = await fetch(backend.url, { method: 'GET' });
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
      { status: 503, route: 'GET /api/stellar/anchor/proofs/[commitment]' },
    );
  }
}
