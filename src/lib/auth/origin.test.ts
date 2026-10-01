import { expect, test } from "vitest";

import { getTrustedOrigin } from "./origin";

test.each([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3100",
  "https://afilados-club.vercel.app",
  "https://afilados-club-git-feat-private-club-access-marco-perez-donosos-projects.vercel.app",
])("allows the approved origin %s", (origin) => {
  expect(getTrustedOrigin(`${origin}/auth/callback?next=//evil.example`)).toBe(
    origin,
  );
});

test.each([
  "https://evil.example",
  "http://afilados-club.vercel.app",
  "https://afilados-club.vercel.app.evil.example",
  "https://other-team.vercel.app",
  "https://x.marco-perez-donosos-projects.vercel.app",
  "https://x-marco-perez-donosos-projects.vercel.app:444",
  "http://localhost:9999",
  "http://localhost.evil.example:3000",
  "https://evil@afilados-club.vercel.app",
  "//evil.example",
  "javascript:alert(1)",
  "not a URL",
])("rejects an untrusted origin %s", (origin) => {
  expect(getTrustedOrigin(origin)).toBeNull();
});
