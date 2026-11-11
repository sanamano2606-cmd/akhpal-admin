"use client";

// ─────────────────────────────────────────────────────────────────────────────
// MOCK 242 (Sana 11 Nov 2026: "Needs me Today is occupying a very big space.
// can we create and put this in a separate Tab on top?" -> "Approved").
//
// The Mock 237 box, unchanged, on its own Stores tab. It used to sit at the
// top of All Stores and push the shop list off the screen. Here it starts at
// once (there is no list to wait for). A shop switched on from here is live
// the next time All Stores is opened - All Stores reads its list fresh.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { getMyPerms } from "@/lib/perms";
import { NeedsMeToday } from "../parts-needs-today";

export default function NeedsMeTodayPage() {
  const [isMain, setIsMain] = useState(false);
  useEffect(() => setIsMain(getMyPerms().isSuper), []);
  return <NeedsMeToday start isMain={isMain} onShown={() => {}} />;
}
