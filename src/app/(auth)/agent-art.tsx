// A futuristic network drawn in code, so there's no photo to license or download.
// Seeded, so the server and the browser always draw the same picture.

const WIDTH = 1200;
const HEIGHT = 1400;

function seeded(seed: number) {
  let value = seed;
  return () => ((value = (value * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

const random = seeded(7);
const CORE = { x: 760, y: 560 };

// Nodes on rings around a central core, like agents around a shared brain.
const NODES = Array.from({ length: 46 }, (_, index) => {
  const ring = index % 3;
  const angle = random() * Math.PI * 2;
  const distance = 170 + ring * 150 + random() * 90;
  return { x: CORE.x + Math.cos(angle) * distance * 1.25, y: CORE.y + Math.sin(angle) * distance, r: 1.8 + random() * 2.6, bright: random() > 0.72 };
});

const LINKS = NODES.flatMap((node, index) =>
  NODES.slice(index + 1)
    .map((other) => ({ other, distance: Math.hypot(node.x - other.x, node.y - other.y) }))
    .filter(({ distance }) => distance < 190)
    .slice(0, 3)
    .map(({ other }) => ({ from: node, to: other })),
);

const SPOKES = NODES.filter((node) => node.bright);

export function AgentArt() {
  return (
    <svg aria-hidden viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 -z-20 size-full">
      <defs>
        <radialGradient id="art-glow-cyan" cx="64%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="art-glow-violet" cx="18%" cy="78%" r="60%">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="art-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#e0f2fe" stopOpacity="1" />
          <stop offset="35%" stopColor="#38bdf8" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="art-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="55%" stopColor="#030712" stopOpacity="0" />
          <stop offset="100%" stopColor="#030712" stopOpacity="0.92" />
        </linearGradient>
        <pattern id="art-grid" width="56" height="56" patternUnits="userSpaceOnUse">
          <path d="M56 0H0V56" fill="none" stroke="#38bdf8" strokeOpacity="0.07" strokeWidth="1" />
        </pattern>
      </defs>

      <rect width={WIDTH} height={HEIGHT} fill="#030712" />
      <rect width={WIDTH} height={HEIGHT} fill="url(#art-grid)" />
      <rect width={WIDTH} height={HEIGHT} fill="url(#art-glow-violet)" />
      <rect width={WIDTH} height={HEIGHT} fill="url(#art-glow-cyan)" />

      {[160, 310, 460].map((radius) => (
        <ellipse key={radius} cx={CORE.x} cy={CORE.y} rx={radius * 1.25} ry={radius} fill="none" stroke="#7dd3fc" strokeOpacity="0.12" strokeDasharray="2 10" />
      ))}

      {LINKS.map(({ from, to }, index) => (
        <line key={index} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#67e8f9" strokeOpacity="0.16" strokeWidth="1" />
      ))}
      {SPOKES.map((node, index) => (
        <line key={index} x1={CORE.x} y1={CORE.y} x2={node.x} y2={node.y} stroke="#a78bfa" strokeOpacity="0.22" strokeWidth="1" />
      ))}

      {NODES.map((node, index) => (
        <g key={index}>
          {node.bright && <circle cx={node.x} cy={node.y} r={node.r * 4} fill="#22d3ee" fillOpacity="0.12" />}
          <circle cx={node.x} cy={node.y} r={node.r} fill={node.bright ? "#e0f2fe" : "#7dd3fc"} fillOpacity={node.bright ? 0.95 : 0.55} />
        </g>
      ))}

      <circle cx={CORE.x} cy={CORE.y} r="120" fill="url(#art-core)" />
      <circle cx={CORE.x} cy={CORE.y} r="46" fill="none" stroke="#e0f2fe" strokeOpacity="0.55" strokeWidth="1.5" />
      <circle cx={CORE.x} cy={CORE.y} r="70" fill="none" stroke="#7dd3fc" strokeOpacity="0.3" strokeWidth="1" strokeDasharray="1 6" />

      <rect width={WIDTH} height={HEIGHT} fill="url(#art-fade)" />
    </svg>
  );
}
