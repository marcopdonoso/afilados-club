import { expect, test, vi } from "vitest";

import { requireClubMember } from "@/lib/auth/member";
import { createClient } from "@/lib/supabase/server";
import { loadAfiladero } from "./load";

vi.mock("@/lib/auth/member", () => ({ requireClubMember: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

test("the loader independently authorizes before any session data access", async () => {
  const denied = new Error("NEXT_REDIRECT");
  vi.mocked(requireClubMember).mockRejectedValueOnce(denied);
  vi.mocked(createClient).mockResolvedValueOnce(null);
  await expect(loadAfiladero()).rejects.toBe(denied);
  expect(createClient).not.toHaveBeenCalled();
});
