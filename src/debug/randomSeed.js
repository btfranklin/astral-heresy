export function getRandomSeed(searchString = window.location.search) {
  const value = new URLSearchParams(searchString).get("seed");
  if (value === null || !/^\d+$/.test(value)) return null;
  const seed = Number(value);
  return Number.isInteger(seed) && seed <= 0xffffffff ? seed : null;
}
