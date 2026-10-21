"use client";

import type { ReactNode } from "react";
import { useSettings } from "@/components/settings-provider";

/**
 * Words that change in left-handed mode, such as which side the nut is on,
 * for pages that are otherwise static.
 */
export function Handed({ left, right }: { left: ReactNode; right: ReactNode }) {
  const { leftHanded } = useSettings().settings;
  return leftHanded ? left : right;
}
