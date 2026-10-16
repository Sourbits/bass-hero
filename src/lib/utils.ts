import { cn as mergeClassNames } from "cn";

export function cn(...inputs: Parameters<typeof mergeClassNames>) {
  return mergeClassNames(...inputs);
}
