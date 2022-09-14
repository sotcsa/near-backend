import isBase64 from "is-base64";

export async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function decodeBase64(str: string) {
  try {
    if (isBase64(str)) {
      return Buffer.from(str, "base64").toString();
    }
    return str;
  } catch {
    return str;
  }
}

export function encodeBase64(str: string) {
  try {
    return Buffer.from(str).toString("base64");
  } catch {
    return str;
  }
}
