import { APP_NAME, APP_NAME_HEAD, APP_NAME_TAIL } from "@/lib/brand";

// Die Wortmarke als inline-SVG statt als zwei PNGs.
//
// WARUM INLINE: ein SVG in einem <img> ist vom Dokument isoliert und kann
// dessen Schriften nicht laden — die Wortmarke fiele auf Arial zurück. Inline
// gerendert greift Manrope, und der Themewechsel ist eine CSS-Klasse statt
// eines zweiten Bildes, das erst nachgeladen wird und dabei springt.
//
// Die Geometrie stammt aus public/bb-lockup-{light,dark}.svg (Markenbuch,
// Stand 20.08.2026): Zeichen auf 72px, Wortmarke ab x=96 — der Abstand von 24
// entspricht der geforderten Balkenlänge. Beide Balken sind gleich lang; das
// ist der Kern des Zeichens ("eine Bilanz, die aufgeht") und keine Zierde.

type LogoProps = {
  /** Höhe steuern wie zuvor beim <img>, z. B. "h-9 w-auto". */
  className?: string;
};

export function Logo({ className = "h-9 w-auto" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 520 96"
      className={className}
      role="img"
      aria-label={APP_NAME}
      focusable="false"
    >
      <g transform="translate(0 12) scale(1.125)">
        <rect
          x="1.5"
          y="1.5"
          width="61"
          height="61"
          rx="19"
          fill="none"
          strokeWidth="3"
          className="stroke-[#0F1522] dark:stroke-white/35"
        />
        <rect x="15" y="21" width="34" height="7" rx="3.5" className="fill-[#0F1522] dark:fill-white" />
        <rect x="15" y="36" width="34" height="7" rx="3.5" className="fill-[#D4AF37]" />
      </g>
      <text
        x="96"
        y="62"
        fontSize="48"
        fontWeight="800"
        letterSpacing="-1.4"
        className="font-brand fill-[#0F1522] dark:fill-white"
      >
        {APP_NAME_HEAD}
        <tspan className="fill-[#B8952F] dark:fill-[#D4AF37]">{APP_NAME_TAIL}</tspan>
      </text>
    </svg>
  );
}
