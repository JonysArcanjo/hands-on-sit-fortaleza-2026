import { appEnv } from "../app/lib/runtime";

export function getDb() {
  return appEnv().DB;
}
