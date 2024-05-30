import { hash } from "node:crypto";

export const hash256 = (val: string | string[]) =>
  hash("sha256", Array.isArray(val) ? val.join("") : val);
