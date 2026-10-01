import type { SupabaseClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { beforeEach, expect, test, vi } from "vitest";

import { createClient } from "@/lib/supabase/server";
import {
  getCurrentClubMember,
  readClubAccess,
  requireClubMember,
} from "./member";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
}));

const subject = "00000000-0000-0000-0000-000000000001";
const memberId = "00000000-0000-0000-0000-000000000002";
const profile = {
  id: memberId,
  display_name: "Fixture member",
  auth_user_id: subject,
  is_active: true,
  role: "admin",
};
const getClaims = vi.fn();
const maybeSingle = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();
const getSession = vi.fn();
const client = {
  auth: { getClaims, getSession },
  from,
} as unknown as SupabaseClient;

beforeEach(() => {
  getClaims
    .mockReset()
    .mockResolvedValue({ data: { claims: { sub: subject } }, error: null });
  maybeSingle.mockReset().mockResolvedValue({ data: profile, error: null });
  eq.mockReset().mockReturnValue({ eq, maybeSingle });
  select.mockReset().mockReturnValue({ eq });
  from.mockReset().mockReturnValue({ select });
  vi.mocked(createClient).mockResolvedValue(client);
});

test("verifies claims then selects only own active member with a minimal DTO", async () => {
  expect(await readClubAccess(client)).toEqual({
    member: { id: memberId, display_name: "Fixture member" },
    hasIdentity: true,
  });
  expect(getClaims).toHaveBeenCalledOnce();
  expect(getSession).not.toHaveBeenCalled();
  expect(from).toHaveBeenCalledWith("club_members");
  expect(select).toHaveBeenCalledWith("id,display_name,auth_user_id,is_active");
  expect(eq.mock.calls).toEqual([
    ["auth_user_id", subject],
    ["is_active", true],
  ]);
});

test.each([null, {}, { sub: "" }, { sub: "not-a-uuid" }, { sub: 42 }])(
  "invalid claims %j never reach the database",
  async (claims) => {
    getClaims.mockResolvedValue({
      data: claims ? { claims } : null,
      error: null,
    });
    expect(await readClubAccess(client)).toEqual({
      member: null,
      hasIdentity: false,
    });
    expect(from).not.toHaveBeenCalled();
  },
);

test("claims errors and unavailable config fail closed", async () => {
  getClaims.mockResolvedValue({
    data: { claims: { sub: subject } },
    error: new Error("invalid"),
  });
  expect((await readClubAccess(client)).member).toBeNull();
  expect(from).not.toHaveBeenCalled();
  expect(await readClubAccess(null)).toEqual({
    member: null,
    hasIdentity: false,
  });
});

test.each([
  null,
  { ...profile, is_active: false },
  { ...profile, auth_user_id: memberId },
  { ...profile, id: "bad" },
  { ...profile, display_name: " padded " },
  { ...profile, display_name: "" },
  { ...profile, display_name: "x".repeat(41) },
])("invalid or absent membership %j is denied", async (data) => {
  maybeSingle.mockResolvedValue({ data, error: null });
  expect(await readClubAccess(client)).toEqual({
    member: null,
    hasIdentity: true,
  });
});

test("database errors and thrown transport failures deny rather than authorize", async () => {
  maybeSingle.mockResolvedValueOnce({
    data: profile,
    error: new Error("unavailable"),
  });
  expect((await readClubAccess(client)).member).toBeNull();
  maybeSingle.mockRejectedValueOnce(new Error("network"));
  expect(await readClubAccess(client)).toEqual({
    member: null,
    hasIdentity: true,
  });
  getClaims.mockRejectedValueOnce(new Error("network"));
  expect(await readClubAccess(client)).toEqual({
    member: null,
    hasIdentity: false,
  });
});

test("server access has no persistent member cache across independent calls", async () => {
  expect(await getCurrentClubMember()).toEqual({
    id: memberId,
    display_name: "Fixture member",
  });
  maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  expect(await getCurrentClubMember()).toBeNull();
  expect(createClient).toHaveBeenCalledTimes(2);
});

test("require returns members and redirects anonymous versus valid nonmembers", async () => {
  expect(await requireClubMember()).toEqual({
    id: memberId,
    display_name: "Fixture member",
  });
  maybeSingle.mockResolvedValueOnce({ data: null, error: null });
  await expect(requireClubMember()).rejects.toThrow(
    "redirect:/entrar?error=access",
  );
  vi.mocked(createClient).mockResolvedValueOnce(null);
  await expect(requireClubMember()).rejects.toThrow("redirect:/entrar");
  expect(redirect).toHaveBeenCalledWith("/entrar");
});

test("invalid configured client creation fails closed", async () => {
  vi.mocked(createClient).mockRejectedValueOnce(new Error("invalid config"));
  expect(await getCurrentClubMember()).toBeNull();
});
