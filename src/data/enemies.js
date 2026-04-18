export const enemyArchetypes = [
  {
    key: "cherub",
    showcaseLabel: "Enemy Study: Nebula Cherub",
    renderKey: "cherub",
    r: 16,
    hp: 3,
    color: "#7ad7ff",
    accent: "#ffe7f6",
    glowColor: "rgba(122, 215, 255, 0.34)",
  },
  {
    key: "halo",
    showcaseLabel: "Enemy Study: Halo Sentinel",
    renderKey: "halo",
    r: 22,
    hp: 5,
    color: "#83ffe6",
    accent: "#f7ffff",
    glowColor: "rgba(131, 255, 230, 0.36)",
  },
  {
    key: "oracle",
    showcaseLabel: "Enemy Study: Oracle Sigil",
    renderKey: "oracle",
    r: 18,
    hp: 4,
    color: "#ffd480",
    accent: "#fff6d7",
    glowColor: "rgba(255, 212, 128, 0.28)",
  },
  {
    key: "shard",
    showcaseLabel: "Enemy Study: Choir Shard",
    renderKey: "shard",
    r: 14,
    hp: 3,
    color: "#9efbff",
    accent: "#f0fdff",
    glowColor: "rgba(158, 251, 255, 0.34)",
  },
  {
    key: "weaver",
    showcaseLabel: "Enemy Study: Refraction Weaver",
    renderKey: "weaver",
    r: 20,
    hp: 6,
    color: "#c5a3ff",
    accent: "#ffdffb",
    glowColor: "rgba(197, 163, 255, 0.3)",
  },
  {
    key: "harp",
    showcaseLabel: "Enemy Study: Hymnal Harp",
    renderKey: "harp",
    r: 16,
    hp: 4,
    color: "#ffd5ff",
    accent: "#fff0f8",
    glowColor: "rgba(255, 213, 255, 0.34)",
  },
  {
    key: "spear",
    showcaseLabel: "Enemy Study: Penitent Spear",
    renderKey: "spear",
    r: 14,
    hp: 3,
    color: "#ff9b85",
    accent: "#fff0d6",
    glowColor: "rgba(255, 155, 133, 0.3)",
  },
  {
    key: "throne",
    showcaseLabel: "Enemy Study: Solar Throne",
    renderKey: "throne",
    r: 24,
    hp: 7,
    color: "#ffb85b",
    accent: "#fff2c4",
    glowColor: "rgba(255, 184, 91, 0.3)",
  },
  {
    key: "fang",
    showcaseLabel: "Enemy Study: Cathedral Fang",
    renderKey: "fang",
    r: 18,
    hp: 5,
    color: "#ff79b0",
    accent: "#ffe0f1",
    glowColor: "rgba(255, 121, 176, 0.3)",
  },
];

const enemyArchetypeMap = new Map(enemyArchetypes.map((archetype) => [archetype.key, archetype]));

export function getEnemyArchetype(key) {
  return enemyArchetypeMap.get(key) ?? null;
}

export function listEnemyShowcaseEntries() {
  return enemyArchetypes.map(({ key, showcaseLabel }) => ({
    key,
    label: showcaseLabel,
  }));
}
