import { expect, test } from "vitest";

import { cn } from "./utils";

test("combines conditional classes and resolves Tailwind conflicts", () => {
  expect(cn("p-2", false && "hidden", { "text-center": true }, "p-4")).toBe(
    "text-center p-4",
  );
});
