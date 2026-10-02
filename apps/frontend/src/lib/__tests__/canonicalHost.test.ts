import { describe, expect, it } from "vitest";
import { CANONICAL_ORIGIN, canonicalRedirectUrl } from "../canonicalHost";

const at = (hostname: string, pathname = "/", search = "", hash = "") => ({ hostname, pathname, search, hash });

describe("canonicalRedirectUrl", () => {
  it("sends the old Amplify address to the real domain, keeping path, query and hash", () => {
    expect(canonicalRedirectUrl(at("main.d2dqny356lcrsz.amplifyapp.com", "/share/abc123", "?x=1", "#top"))).toBe(
      `${CANONICAL_ORIGIN}/share/abc123?x=1#top`,
    );
  });

  it("leaves the real domain, localhost and other Amplify preview branches alone", () => {
    expect(canonicalRedirectUrl(at("travel.uditnegi.com", "/share/abc"))).toBeNull();
    expect(canonicalRedirectUrl(at("localhost", "/chat"))).toBeNull();
    expect(canonicalRedirectUrl(at("feature-x.d2dqny356lcrsz.amplifyapp.com"))).toBeNull();
  });
});
