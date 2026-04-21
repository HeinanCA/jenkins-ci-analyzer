/**
 * Parses Jenkins user API JSON responses.
 *
 * Jenkins /user/{id}/api/json?tree=fullName,property[address] returns:
 * {
 *   "fullName": "Some Name",
 *   "property": [
 *     { "_class": "hudson.tasks.Mailer$UserProperty", "address": "user@example.com" },
 *     { "_class": "some.other.Property" },
 *     ...
 *   ]
 * }
 */

export interface JenkinsUserProperty {
  readonly _class?: string;
  readonly address?: string;
}

export interface JenkinsUserApiResponse {
  readonly fullName?: string;
  readonly property?: readonly JenkinsUserProperty[];
}

export interface ParsedJenkinsUser {
  readonly displayName: string | null;
  readonly email: string | null;
}

/**
 * Extracts display name and email from a Jenkins user API response.
 *
 * Email is taken from the first property that has a non-empty `address` field
 * (typically the Mailer plugin property). Returns null for missing/empty values.
 */
export function parseJenkinsUserResponse(
  data: JenkinsUserApiResponse | null | undefined,
): ParsedJenkinsUser {
  if (!data) {
    return { displayName: null, email: null };
  }

  const displayName = data.fullName?.trim() || null;

  const email = extractEmail(data.property);

  return { displayName, email };
}

function extractEmail(
  properties: readonly JenkinsUserProperty[] | null | undefined,
): string | null {
  if (!properties || !Array.isArray(properties)) {
    return null;
  }

  for (const prop of properties) {
    if (prop.address && typeof prop.address === "string") {
      const trimmed = prop.address.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}
