// Shared by the pdfToken-authenticated print pages (ItineraryPrint.jsx,
// DepartureItineraryPrint.jsx) — they call the backend directly with plain
// fetch(), outside createApiClient.js's session-cookie flow (see its own
// comment for why), but still need the same protection that module's
// rawRequest has: a 2xx response whose body isn't valid JSON (an HTML error
// page, a misconfigured host) must not be treated as success with
// `data: null` and crash several layers away when a caller reads a field off
// of it.
export async function fetchJson(url, options) {
  const res = await fetch(url, options);

  let data = null;
  let invalidJson = false;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      invalidJson = true;
    }
  }

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  if (invalidJson) {
    throw new Error('Server returned an unexpected non-JSON response');
  }

  return data;
}
