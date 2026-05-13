/**
 * Extracts optional Retry-After semantics from an upstream Response for logs and API details.
 * RFC 7231: Retry-After can be a delay in seconds or an HTTP-date.
 */
export function buildRateLimitDetails(response: Response): Record<string, unknown> {
  const statusCode = response.status;
  const retryAfterRaw = response.headers.get('retry-after');

  const details: Record<string, unknown> = { statusCode };

  if (!retryAfterRaw || retryAfterRaw.trim() === '') {
    return details;
  }

  const trimmed = retryAfterRaw.trim();
  const asSeconds = Number.parseInt(trimmed, 10);

  if (!Number.isNaN(asSeconds) && String(asSeconds) === trimmed) {
    details.retryAfterSeconds = asSeconds;
    return details;
  }

  details.retryAfter = trimmed;
  return details;
}
