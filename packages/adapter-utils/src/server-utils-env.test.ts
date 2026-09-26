import { describe, expect, it } from "vitest";
import { sanitizeInheritedPaperclipEnv } from "./server-utils.js";

describe("sanitizeInheritedPaperclipEnv", () => {
  it("drops the host-only Paperclip CLI command pointer", () => {
    expect(sanitizeInheritedPaperclipEnv({
      PAPERCLIPAI_CMD: "node /missing/paperclipai/dist/index.js",
      PAPERCLIP_RUNTIME_API_URL: "http://127.0.0.1:3100",
      PATH: "/usr/bin",
    })).toEqual({
      PAPERCLIP_RUNTIME_API_URL: "http://127.0.0.1:3100",
      PATH: "/usr/bin",
    });
  });

  it("drops server-only credentials and the configured denylist", () => {
    expect(sanitizeInheritedPaperclipEnv({
      BETTER_AUTH_SECRET: "s",
      DATABASE_URL: "postgres://paperclip:pw@db/paperclip",
      OPENCLAW_TOKEN: "t",
      OTHER_SECRET: "o",
      PAPERCLIP_AGENT_ENV_DENYLIST: "OPENCLAW_TOKEN, OTHER_SECRET",
      PATH: "/usr/bin",
    })).toEqual({ PATH: "/usr/bin" });
  });
});
