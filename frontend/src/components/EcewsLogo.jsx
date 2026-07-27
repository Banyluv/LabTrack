// ECEWS brand lockup, drawn inline so it needs no image asset.
// Roundel (arc text + Africa mark) on the left, wordmark + tagline on the right.
const GREEN = '#00833E';
const RED = '#D6202C';

export default function EcewsLogo({ className = '', showWordmark = true }) {
  // Roundel alone is square; the full lockup is wide.
  const viewBox = showWordmark ? '0 0 440 116' : '0 0 116 116';

  return (
    <svg
      className={className}
      viewBox={viewBox}
      role="img"
      aria-label="ECEWS — Excellence Community Education Welfare Scheme"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Arc baselines for the circular text. Both run left to right so the
            letters stay upright. Top text grows outward from its baseline and
            bottom text grows inward, so the radii differ to clear both rings. */}
        <path id="ecews-arc-top" d="M 18.5,72.4 A 42,42 0 1 1 97.5,72.4" fill="none" />
        <path id="ecews-arc-bottom" d="M 10,58 A 48,48 0 0 0 106,58" fill="none" />
      </defs>

      {/* --- Roundel --- */}
      <circle cx="58" cy="58" r="55" fill="none" stroke={RED} strokeWidth="2.5" />
      <circle cx="58" cy="58" r="36" fill="none" stroke={RED} strokeWidth="2" />

      <text fill={GREEN} fontFamily="Arial, Helvetica, sans-serif" fontSize="8.5" fontWeight="700" letterSpacing="0.3">
        <textPath href="#ecews-arc-top" startOffset="50%" textAnchor="middle">
          Excellence Community Education
        </textPath>
      </text>
      <text fill={GREEN} fontFamily="Arial, Helvetica, sans-serif" fontSize="9.5" fontWeight="700" letterSpacing="0.3">
        <textPath href="#ecews-arc-bottom" startOffset="50%" textAnchor="middle">
          Welfare Scheme
        </textPath>
      </text>

      {/* Africa silhouette */}
      <path
        fill={GREEN}
        d="M36,31 L50,28.5 L64,29 L72,32 L76,38 L80,43 L90,45
           L79,52 L76,60 L73,68 L68,76 L62,84 L56,88 L50,84
           L45,76 L41,68 L36,62 L30,60 L25,57 L23,51 L25,44 L30,36 Z"
      />

      {/* --- Wordmark --- */}
      {showWordmark && (
        <>
          <text
            x="132"
            y="70"
            fill={GREEN}
            fontFamily="Arial Black, Arial, Helvetica, sans-serif"
            fontSize="62"
            fontWeight="900"
            letterSpacing="1"
          >
            ECEWS
          </text>
          <text
            x="134"
            y="94"
            fill={GREEN}
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="13.5"
            fontStyle="italic"
            fontWeight="600"
          >
            ...Improving Education and Health in Nigeria
          </text>
        </>
      )}
    </svg>
  );
}
