/**
 * Hand-drawn brand glyphs for the integrations MagicPen plugs into. Lucide
 * dropped its brand icons, so Slack and Google Docs are drawn inline here;
 * the fills are the brands' official colours and must stay hardcoded.
 */

/**
 * Slack's pinwheel: one pill rotated four times about the centre, with one of
 * the four official Slack colours per quarter turn.
 */
export function SlackMark({ size = 20 }) {
  const pill = { x: 11.6, y: 4.2, width: 10.6, height: 5.6, rx: 2.8 };
  const colors = ["#36C5F0", "#2EB67D", "#ECB22E", "#E01E5A"];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {colors.map((fill, i) => (
        <rect key={fill} {...pill} fill={fill} transform={`rotate(${i * 90} 12 12)`} />
      ))}
    </svg>
  );
}

/** Google Docs page: blue sheet, darker folded corner, white rule lines. */
export function DocsMark({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5.5 2.5h8.2L19 7.9v13.6H5.5z" fill="#3086F6" />
      <path d="M13.7 2.5 19 7.9h-5.3z" fill="#0C67D6" />
      <path d="M8.4 11.4h8.2M8.4 14.2h8.2M8.4 17h5.4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
