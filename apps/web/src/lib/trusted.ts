// SPDX-License-Identifier: AGPL-3.0-or-later
// Trusted Types (CSP `require-trusted-types-for 'script'`): the only script URLs this app ever
// loads are its own same-origin worker and service worker. Anything else is rejected.
interface TrustedTypePolicyLike {
  createScriptURL(url: string): unknown;
}
interface TrustedTypesLike {
  createPolicy(name: string, rules: { createScriptURL: (url: string) => string }): TrustedTypePolicyLike;
}

let policy: TrustedTypePolicyLike | null | undefined;

function getPolicy(): TrustedTypePolicyLike | null {
  if (policy !== undefined) return policy;
  const tt = (globalThis as { trustedTypes?: TrustedTypesLike }).trustedTypes;
  policy = tt
    ? tt.createPolicy("astro-beat-script-url", {
        createScriptURL: (url) => {
          const u = new URL(url, location.href);
          if (u.origin !== location.origin || !/^\/(sw\.js|assets\/[\w.-]+\.js|src\/.+\.ts)$/.test(u.pathname)) {
            throw new TypeError(`Blocked script URL: ${u.pathname}`);
          }
          return u.href;
        },
      })
    : null;
  return policy;
}

/** A same-origin script URL, as a TrustedScriptURL where Trusted Types are enforced. */
export function scriptUrl(url: URL | string): string {
  const p = getPolicy();
  return (p ? p.createScriptURL(String(url)) : String(url)) as string;
}
