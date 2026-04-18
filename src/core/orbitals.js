export function getOrbitalOffsets(time, focus) {
  const radius = focus ? 30 : 38;
  return [0, 1, 2].map((index) => {
    const angle = time * 2.6 + index * ((Math.PI * 2) / 3);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * 0.72,
      angle,
    };
  });
}
