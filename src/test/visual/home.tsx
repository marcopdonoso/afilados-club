import { createRoot } from "react-dom/client";

import { SeasonHome } from "@/features/season/season-home";

// Component-only visual fixture. No Auth clients, private route, or authorization bypass.
createRoot(document.getElementById("fixture")!).render(
  <SeasonHome
    initialNow={Date.parse("2026-10-30T00:00:00-04:00")}
    member={{ display_name: "Marco" }}
  />,
);
