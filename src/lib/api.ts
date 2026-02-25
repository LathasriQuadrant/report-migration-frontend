const BACKEND_BASE_URL =
  "https://powerbi-azure-auth-app-e6dtdsb2ccawg9cy.eastus-01.azurewebsites.net";

/**
 * Wrapper around fetch that includes credentials and handles 401/403.
 * On 401 → clears session and redirects to /login.
 * On 403 → throws with a clear "Forbidden" message.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${BACKEND_BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    credentials: "include",
  });

  if (response.status === 401) {
    // Session expired or not authenticated – clear local state & redirect
    sessionStorage.removeItem("powerbi_authenticated");
    sessionStorage.removeItem("azure_user_name");
    sessionStorage.removeItem("azure_user_email");
    sessionStorage.removeItem("local_authenticated");
    window.location.href = "/login";
    throw new Error("Session expired. Please log in again.");
  }

  if (response.status === 403) {
    throw new Error(
      "Access denied. You do not have permission to access this resource."
    );
  }

  return response;
}

export { BACKEND_BASE_URL };
