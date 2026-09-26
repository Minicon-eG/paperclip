import { describe, expect, it } from "vitest";
import {
  buildOidcAccountLinking,
  buildOidcPlugins,
  oidcPublicInfo,
  resolveOidcSettings,
} from "../auth/oidc.js";

const base = {
  PAPERCLIP_OIDC_DISCOVERY_URL: "https://auth.example.com/application/o/paperclip/.well-known/openid-configuration",
  PAPERCLIP_OIDC_CLIENT_ID: "client",
  PAPERCLIP_OIDC_CLIENT_SECRET: "secret",
};

describe("resolveOidcSettings", () => {
  it("is inert without configuration", () => {
    expect(resolveOidcSettings({})).toBeNull();
    expect(buildOidcPlugins(null)).toEqual([]);
    expect(buildOidcAccountLinking(null)).toEqual({});
    expect(oidcPublicInfo(null)).toBeUndefined();
  });

  it("rejects partial configuration instead of silently disabling SSO", () => {
    expect(() => resolveOidcSettings({ PAPERCLIP_OIDC_CLIENT_ID: "client" })).toThrow(/must be set together/);
  });

  it("requires https for the discovery document", () => {
    expect(() =>
      resolveOidcSettings({ ...base, PAPERCLIP_OIDC_DISCOVERY_URL: "http://auth.example.com/.well-known/openid-configuration" }),
    ).toThrow(/https/);
  });

  it("applies safe defaults", () => {
    const s = resolveOidcSettings(base, { signUpDisabled: true })!;
    expect(s.providerId).toBe("oidc");
    expect(s.scopes).toEqual(["openid", "email", "profile"]);
    expect(s.allowSignUp).toBe(false);
    expect(s.linkAccounts).toBe(false);
    expect(s.disablePassword).toBe(false);
  });

  it("follows instance sign-up policy unless overridden", () => {
    expect(resolveOidcSettings(base, { signUpDisabled: false })!.allowSignUp).toBe(true);
    expect(resolveOidcSettings({ ...base, PAPERCLIP_OIDC_ALLOW_SIGNUP: "true" }, { signUpDisabled: true })!.allowSignUp).toBe(true);
  });

  it("only links accounts when explicitly enabled", () => {
    const s = resolveOidcSettings({ ...base, PAPERCLIP_OIDC_LINK_ACCOUNTS: "yes", PAPERCLIP_OIDC_PROVIDER_ID: "authentik" })!;
    expect(buildOidcAccountLinking(s)).toEqual({
      account: { accountLinking: { enabled: true, trustedProviders: ["authentik"], requireLocalEmailVerified: false } },
    });
  });

  it("rejects malformed flags and provider ids", () => {
    expect(() => resolveOidcSettings({ ...base, PAPERCLIP_OIDC_LINK_ACCOUNTS: "maybe" })).toThrow(/Invalid boolean/);
    expect(() => resolveOidcSettings({ ...base, PAPERCLIP_OIDC_PROVIDER_ID: "../x" })).toThrow(/PROVIDER_ID/);
  });

  it("never exposes client credentials publicly", () => {
    const info = oidcPublicInfo(resolveOidcSettings({ ...base, PAPERCLIP_OIDC_DISPLAY_NAME: "Minicon SSO" }))!;
    expect(info).toEqual({ enabled: true, providerId: "oidc", displayName: "Minicon SSO", passwordLoginDisabled: false });
    expect(JSON.stringify(info)).not.toContain("secret");
  });

  it("registers exactly one generic OAuth plugin", () => {
    expect(buildOidcPlugins(resolveOidcSettings(base))).toHaveLength(1);
  });
});
