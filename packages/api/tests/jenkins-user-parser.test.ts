import { describe, it, expect } from "vitest";
import {
  parseJenkinsUserResponse,
  type JenkinsUserApiResponse,
} from "../src/services/jenkins-user-parser";

describe("parseJenkinsUserResponse", () => {
  it("extracts displayName and email from a valid response", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "Heinan Landa",
      property: [
        { _class: "some.other.Property" },
        {
          _class: "hudson.tasks.Mailer$UserProperty",
          address: "heinan@example.com",
        },
      ],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBe("Heinan Landa");
    expect(result.email).toBe("heinan@example.com");
  });

  it("returns null for both fields when data is null", () => {
    const result = parseJenkinsUserResponse(null);

    expect(result.displayName).toBeNull();
    expect(result.email).toBeNull();
  });

  it("returns null for both fields when data is undefined", () => {
    const result = parseJenkinsUserResponse(undefined);

    expect(result.displayName).toBeNull();
    expect(result.email).toBeNull();
  });

  it("returns null email when property array is missing", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "No Props User",
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBe("No Props User");
    expect(result.email).toBeNull();
  });

  it("returns null email when property array is empty", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "Empty Props",
      property: [],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBe("Empty Props");
    expect(result.email).toBeNull();
  });

  it("returns null email when no property has an address field", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "Jenkins User",
      property: [
        { _class: "hudson.security.HudsonPrivateSecurityRealm$Details" },
        { _class: "jenkins.security.LastGrantedAuthoritiesProperty" },
      ],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBe("Jenkins User");
    expect(result.email).toBeNull();
  });

  it("picks the first property with a non-empty address", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "Multi Address",
      property: [
        { _class: "prop1" },
        { _class: "prop2", address: "first@example.com" },
        { _class: "prop3", address: "second@example.com" },
      ],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.email).toBe("first@example.com");
  });

  it("skips properties with empty string address", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "Blank Address",
      property: [
        { _class: "prop1", address: "" },
        { _class: "prop2", address: "  " },
        { _class: "prop3", address: "real@example.com" },
      ],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.email).toBe("real@example.com");
  });

  it("trims whitespace from display name", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "  Padded Name  ",
      property: [],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBe("Padded Name");
  });

  it("trims whitespace from email address", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "User",
      property: [{ address: "  user@example.com  " }],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.email).toBe("user@example.com");
  });

  it("returns null displayName when fullName is empty string", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "",
      property: [],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBeNull();
  });

  it("returns null displayName when fullName is whitespace only", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "   ",
      property: [],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBeNull();
  });

  it("handles property with address set to a non-string value gracefully", () => {
    // Jenkins API can return weird data
    const data = {
      fullName: "Weird Data",
      property: [
        { _class: "prop1", address: 42 },
        { _class: "prop2", address: "valid@example.com" },
      ],
    } as unknown as JenkinsUserApiResponse;

    const result = parseJenkinsUserResponse(data);

    expect(result.email).toBe("valid@example.com");
  });

  it("handles multiple properties with mixed valid/invalid addresses", () => {
    const data: JenkinsUserApiResponse = {
      fullName: "Mixed Props",
      property: [
        { _class: "a" },
        { _class: "b", address: "" },
        { _class: "c", address: "found@corp.com" },
      ],
    };

    const result = parseJenkinsUserResponse(data);

    expect(result.displayName).toBe("Mixed Props");
    expect(result.email).toBe("found@corp.com");
  });
});
