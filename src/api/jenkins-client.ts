import type { ConnectionConfig } from "../store/connection-store";

export class JenkinsApiError extends Error {
  readonly statusCode: number;
  readonly userMessage: string;

  constructor(message: string, statusCode: number, userMessage: string) {
    super(message);
    this.name = "JenkinsApiError";
    this.statusCode = statusCode;
    this.userMessage = userMessage;
  }
}

function buildAuthHeader(config: ConnectionConfig): string {
  return `Basic ${btoa(`${config.username}:${config.token}`)}`;
}

function toUserMessage(status: number): string {
  switch (status) {
    case 401:
      return "Invalid credentials. Check your username and API token.";
    case 403:
      return "Insufficient permissions. Your account may not have access to this resource.";
    case 404:
      return "Resource not found. Check the Jenkins URL and job name.";
    default:
      return status >= 500
        ? "Jenkins server error. Try again or check Jenkins logs."
        : `Unexpected error (HTTP ${status}).`;
  }
}

export async function jenkinsGet<T>(
  url: string,
  config: ConnectionConfig,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: buildAuthHeader(config),
      Accept: "application/json",
    },
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new JenkinsApiError(
      `Jenkins API error: ${response.status} ${response.statusText}`,
      response.status,
      toUserMessage(response.status),
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new JenkinsApiError(
      "Jenkins returned non-JSON response (possible SSO redirect)",
      403,
      "Authentication failed. Jenkins is redirecting to SSO login. Check your username and API token.",
    );
  }

  return response.json() as Promise<T>;
}

export async function jenkinsGetText(
  url: string,
  config: ConnectionConfig,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: buildAuthHeader(config),
    },
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new JenkinsApiError(
      `Jenkins API error: ${response.status} ${response.statusText}`,
      response.status,
      toUserMessage(response.status),
    );
  }

  return response.text();
}

export async function testConnection(
  config: ConnectionConfig,
): Promise<{ success: boolean; message: string }> {
  try {
    const url = `${config.baseUrl.replace(/\/$/, "")}/api/json?tree=mode,nodeDescription,useSecurity`;
    await jenkinsGet(url, config);
    return { success: true, message: "Connected successfully!" };
  } catch (error) {
    if (error instanceof JenkinsApiError) {
      return { success: false, message: error.userMessage };
    }
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Connection test failed:", msg, error);
    return {
      success: false,
      message: `Connection failed: ${msg}`,
    };
  }
}
