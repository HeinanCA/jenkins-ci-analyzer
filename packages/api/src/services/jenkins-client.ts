import type { PlainCredentials } from './credential-vault';

export class JenkinsApiError extends Error {
  readonly statusCode: number;
  readonly userMessage: string;

  constructor(message: string, statusCode: number, userMessage: string) {
    super(message);
    this.name = 'JenkinsApiError';
    this.statusCode = statusCode;
    this.userMessage = userMessage;
  }
}

function buildAuthHeader(credentials: PlainCredentials): string {
  return `Basic ${Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64')}`;
}

function toUserMessage(status: number): string {
  switch (status) {
    case 401:
      return 'Invalid credentials. Check your username and API token.';
    case 403:
      return 'Insufficient permissions. Your account may not have access.';
    case 404:
      return 'Resource not found. Check the Jenkins URL.';
    default:
      return status >= 500
        ? 'Jenkins server error. Try again or check Jenkins logs.'
        : `Unexpected error (HTTP ${status}).`;
  }
}

export async function jenkinsGet<T>(
  url: string,
  credentials: PlainCredentials,
  options?: { signal?: AbortSignal },
): Promise<T> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(credentials),
      Accept: 'application/json',
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

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new JenkinsApiError(
      'Jenkins returned non-JSON response (possible SSO redirect)',
      403,
      'Authentication failed. Jenkins may be redirecting to SSO login.',
    );
  }

  return response.json() as Promise<T>;
}

export async function jenkinsGetText(
  url: string,
  credentials: PlainCredentials,
  options?: { signal?: AbortSignal },
): Promise<string> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: buildAuthHeader(credentials),
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

export async function testJenkinsConnection(
  baseUrl: string,
  credentials: PlainCredentials,
): Promise<{ success: boolean; message: string }> {
  try {
    const url = `${baseUrl.replace(/\/$/, '')}/api/json?tree=mode,nodeDescription,useSecurity`;
    await jenkinsGet(url, credentials);
    return { success: true, message: 'Connected successfully!' };
  } catch (error) {
    if (error instanceof JenkinsApiError) {
      return { success: false, message: error.userMessage };
    }
    return {
      success: false,
      message:
        error instanceof TypeError
          ? 'Cannot reach Jenkins server. Check the URL and network.'
          : 'Connection failed. Check your settings.',
    };
  }
}
