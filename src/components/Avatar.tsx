// The avatar gains an item per level: 1 magnifier, 2 pen, 3 laptop, 4 suit and tie, 5 lanyard badge,
// 6 glasses, 7 crown, 8+ golden glow. Colors are fixed so the character looks the same in both themes.
const SKIN = "#f1c7a5";
const HAIR = "#3b2f2a";
const INK = "#2b2b2b";
const GOLD = "#f5c84c";

export function Avatar({ level }: { level: number }) {
  const n = Math.max(1, level);
  const suit = n >= 4;
  const shirt = n >= 8 ? "#c99a1e" : suit ? "#2f3b52" : ["#9aa5b1", "#5598e7", "#1baf7a"][Math.min(n, 3) - 1];
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      {n >= 8 && (
        <g fill={GOLD}>
          <circle cx="50" cy="50" r="48" opacity=".35" />
          {[
            [18, 22],
            [82, 26],
            [16, 62],
            [84, 60],
          ].map(([x, y]) => (
            <path key={x} d={`M${x} ${y - 5}l1.5 3.5 3.5 1.5-3.5 1.5-1.5 3.5-1.5-3.5-3.5-1.5 3.5-1.5z`} />
          ))}
        </g>
      )}
      <path d="M16 104 Q18 74 50 71 Q82 74 84 104 Z" fill={shirt} />
      {suit && (
        <>
          <path d="M41 72 L50 90 L59 72 Q50 75 41 72Z" fill="#fff" />
          <path d="M48 76 L52 76 L54 92 L50 97 L46 92 Z" fill={n >= 8 ? "#2f3b52" : "#d03b3b"} />
        </>
      )}
      <rect x="45" y="58" width="10" height="14" rx="4" fill={SKIN} />
      <circle cx="50" cy="42" r="17" fill={SKIN} />
      <path d="M33 41 Q32 22 50 22 Q68 22 67 41 Q63 31 54 30 Q46 34 33 41Z" fill={HAIR} />
      <circle cx="44" cy="44" r="1.9" fill={INK} />
      <circle cx="56" cy="44" r="1.9" fill={INK} />
      <path
        d={suit ? "M43.5 51 Q50 56.5 56.5 51" : "M45 51.5 Q50 54.5 55 51.5"}
        stroke={INK}
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="40" cy="49" r="2.4" fill="#e89a8a" opacity=".5" />
      <circle cx="60" cy="49" r="2.4" fill="#e89a8a" opacity=".5" />
      {n >= 6 && (
        <g fill="none" stroke={INK} strokeWidth="1.6">
          <circle cx="44" cy="44" r="5" />
          <circle cx="56" cy="44" r="5" />
          <path d="M49 44h2M39 43l-5-2M61 43l5-2" />
        </g>
      )}
      {n >= 2 && (
        <g transform="translate(3 6) rotate(-35 68 33)">
          <rect x="60" y="31" width="16" height="3.4" rx="1" fill="#eda100" />
          <path d="M76 31 L80 32.7 L76 34.4Z" fill={SKIN} />
          <rect x="60" y="31" width="3" height="3.4" fill="#e34948" />
        </g>
      )}
      {n >= 7 && (
        <>
          <path d="M37 24 L39 13 L45 19 L50 10 L55 19 L61 13 L63 24 Z" fill={GOLD} stroke="#c99a1e" strokeWidth="1.2" />
          <circle cx="50" cy="16" r="1.6" fill="#e34948" />
        </>
      )}
      {n >= 5 && (
        <>
          <path d="M42 72 L47 88 M58 72 L53 88" stroke="#2a78d6" strokeWidth="2" />
          <rect x="43" y="86" width="14" height="11" rx="2" fill="#fff" stroke="#c3c2b7" />
          <rect x="45.5" y="89" width="9" height="1.8" fill="#2a78d6" />
          <rect x="45.5" y="92.5" width="6" height="1.4" fill="#c3c2b7" />
        </>
      )}
      {n === 3 && (
        <>
          <rect x="28" y="82" width="44" height="22" rx="3" fill="#c3c9d1" />
          <rect x="31" y="85" width="38" height="19" rx="1.5" fill="#5f6b78" />
          <circle cx="50" cy="93" r="2" fill="#c3c9d1" />
        </>
      )}
      {n === 1 && (
        <>
          <path d="M64 82 L77 96" stroke="#7a5a3a" strokeWidth="4" strokeLinecap="round" />
          <circle cx="62" cy="79" r="8" fill="#d8ecff" fillOpacity=".7" stroke="#5f6b78" strokeWidth="2.6" />
        </>
      )}
    </svg>
  );
}
