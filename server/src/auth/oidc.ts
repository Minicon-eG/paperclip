/**
 * Optional OpenID Connect sign-in for board users (Minicon patch, see upstream #3028).
 *
 * Entirely environment-gated: without PAPERCLIP_OIDC_DISCOVERY_URL, CLIENT_ID and
 * CLIENT_SECRET nothing is registered and the instance behaves exactly like upstream.
 *
 *   PAPERCLIP_OIDC_DISCOVERY_URL     issuer discovery document (…/.well-known/openid-configuration)
 *   PAPERCLIP_OIDC_CLIENT_ID         OAuth client id
 *   PAPERCLIP_OIDC_CLIENT_SECRET     OAuth client secret
 *   PAPERCLIP_OIDC_PROVIDER_ID       provider id in routes/accounts (default "oidc")
 *   PAPERCLIP_OIDC_DISPLAY_NAME      button label on the sign-in page (default "Single Sign-On")
 *   PAPERCLIP_OIDC_SCOPES            space separated (default "openid email profile")
 *   PAPERCLIP_OIDC_ALLOW_SIGNUP      "true" lets unknown IdP users create an account.
 *                                    Default follows auth.disableSignUp (off when sign-up is disabled).
 *   PAPERCLIP_OIDC_LINK_ACCOUNTS     "true" links an IdP login to an existing account with the
 *                                    same email. Trust decision: only enable when the IdP asserts
 *                                    verified email addresses. Default off.
 *   PAPERCLIP_OIDC_DISABLE_PASSWORD  "true" turns off email/password sign-in once SSO works.
 *                                    Default off.
 *
 * Accounts created or linked through SSO still need a company membership (invite) to see
 * anything — OIDC only answers "who is this", never "what may they do".
 */
import { genericOAuth } from "better-auth/plugins";

export type OidcSettings = {
  providerId: string;
  displayName: string;
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  allowSignUp: boolean;
  linkAccounts: boolean;
  disablePassword: boolean;
};

/** What the unauthenticated sign-in page may know. Never contains client credentials. */
export type OidcPublicInfo = {
  enabled: true;
  providerId: string;
  displayName: string;
  passwordLoginDisabled: boolean;
};

const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

function flag(value: string | undefined): boolean | undefined {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return undefined;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`Invalid boolean value "${value}" in PAPERCLIP_OIDC_* configuration`);
}

export function resolveOidcSettings(
  env: NodeJS.ProcessEnv = process.env,
  opts: { signUpDisabled?: boolean } = {},
): OidcSettings | null {
  const discoveryUrl = env.PAPERCLIP_OIDC_DISCOVERY_URL?.trim();
  const clientId = env.PAPERCLIP_OIDC_CLIENT_ID?.trim();
  const clientSecret = env.PAPERCLIP_OIDC_CLIENT_SECRET?.trim();
  if (!discoveryUrl && !clientId && !clientSecret) return null;
  if (!discoveryUrl || !clientId || !clientSecret) {
    throw new Error(
      "PAPERCLIP_OIDC_DISCOVERY_URL, PAPERCLIP_OIDC_CLIENT_ID and PAPERCLIP_OIDC_CLIENT_SECRET must be set together",
    );
  }
  const parsed = new URL(discoveryUrl);
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("PAPERCLIP_OIDC_DISCOVERY_URL must use https");
  }
  const providerId = env.PAPERCLIP_OIDC_PROVIDER_ID?.trim() || "oidc";
  if (!PROVIDER_ID_RE.test(providerId)) {
    throw new Error("PAPERCLIP_OIDC_PROVIDER_ID must match /^[a-z0-9][a-z0-9_-]{0,39}$/");
  }
  return {
    providerId,
    displayName: env.PAPERCLIP_OIDC_DISPLAY_NAME?.trim() || "Single Sign-On",
    discoveryUrl,
    clientId,
    clientSecret,
    scopes: (env.PAPERCLIP_OIDC_SCOPES?.trim() || "openid email profile").split(/\s+/),
    allowSignUp: flag(env.PAPERCLIP_OIDC_ALLOW_SIGNUP) ?? !opts.signUpDisabled,
    linkAccounts: flag(env.PAPERCLIP_OIDC_LINK_ACCOUNTS) ?? false,
    disablePassword: flag(env.PAPERCLIP_OIDC_DISABLE_PASSWORD) ?? false,
  };
}

export function buildOidcPlugins(settings: OidcSettings | null) {
  if (!settings) return [];
  return [
    genericOAuth({
      config: [
        {
          providerId: settings.providerId,
          discoveryUrl: settings.discoveryUrl,
          clientId: settings.clientId,
          clientSecret: settings.clientSecret,
          scopes: settings.scopes,
          pkce: true,
          disableImplicitSignUp: !settings.allowSignUp,
        },
      ],
    }),
  ];
}

/** Better Auth account-linking options; empty unless explicitly enabled. */
export function buildOidcAccountLinking(settings: OidcSettings | null) {
  if (!settings?.linkAccounts) return {};
  return {
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: [settings.providerId],
        // Native accounts are created without email verification, so linking has to
        // trust the IdP's assertion. This is why linking is opt-in.
        requireLocalEmailVerified: false,
      },
    },
  };
}

export function oidcPublicInfo(settings: OidcSettings | null): OidcPublicInfo | undefined {
  if (!settings) return undefined;
  return {
    enabled: true,
    providerId: settings.providerId,
    displayName: settings.displayName,
    passwordLoginDisabled: settings.disablePassword,
  };
}
