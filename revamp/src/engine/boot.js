export function takeBootFragment(target = globalThis.window) {
  const take = target?.__lynkBootTake;
  if (typeof take !== "function") return "";
  try {
    return take();
  } catch {
    return "";
  }
}
