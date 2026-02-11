/**
 * Wrapper around fetch that includes credentials and handles 401 globally.
 * Use this for all Power BI backend calls.
 */
const BACKEND_BASE_URL = "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BACKEND_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (response.status === 401) {
    // Dispatch global unauthorized event
    window.dispatchEvent(new Event("auth:unauthorized"));
  }

  return response;
}

export { BACKEND_BASE_URL };
