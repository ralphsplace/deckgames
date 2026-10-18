// Duplicate-bridge contract score from the declarer's point of view (negative = went down).
export function score({ level, strain, dbl }, tricks, vul) {
  const diff = tricks - (level + 6);
  if (diff < 0) {
    const down = -diff;
    if (!dbl) return -down * (vul ? 100 : 50);
    let p = 0;
    for (let i = 1; i <= down; i++) p += vul ? (i === 1 ? 200 : 300) : (i === 1 ? 100 : i <= 3 ? 200 : 300);
    return -p * (dbl === 2 ? 2 : 1);
  }
  const per = strain === 'C' || strain === 'D' ? 20 : 30;
  const trick = (per * level + (strain === 'N' ? 10 : 0)) * (dbl === 2 ? 4 : dbl === 1 ? 2 : 1);
  let p = trick + (trick >= 100 ? (vul ? 500 : 300) : 50);
  if (level === 6) p += vul ? 750 : 500;
  if (level === 7) p += vul ? 1500 : 1000;
  if (dbl) p += dbl === 1 ? 50 : 100;
  p += dbl ? diff * (vul ? 200 : 100) * (dbl === 2 ? 2 : 1) : diff * per;
  return p;
}
