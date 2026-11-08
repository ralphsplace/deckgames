// Turns contract wording ("Run of 4+book of3", "2 Books of 3", "1 Book+1 Run of 3") into requirements:
// [{type:'book'|'run', n}]. Parsing the sheet's own text keeps the sheet as the single source of truth.
export function parseContract(text) {
  const reqs = [];
  // "1 Book+1 Run of 3": a shared "of N" at the end applies to every part without its own size
  const parts = text.split('+').map(p => p.trim());
  const shared = /of\s*(\d+)\s*$/i.exec(text);
  for (const p of parts) {
    const m = /^(\d+)?\s*(book|run)s?(?:\s*of\s*(\d+))?$/i.exec(p);
    if (!m) throw new Error(`Can't read contract part "${p}" in "${text}"`);
    const count = m[1] ? +m[1] : 1;
    const n = m[3] ? +m[3] : shared ? +shared[1] : NaN;
    if (!(n >= 3)) throw new Error(`No size for "${p}" in "${text}"`);
    for (let i = 0; i < count; i++) reqs.push({ type: m[2].toLowerCase(), n });
  }
  return reqs;
}

export const describe = reqs => {
  const groups = new Map();
  for (const q of reqs) { const k = `${q.type} of ${q.n}`; groups.set(k, (groups.get(k) || 0) + 1); }
  return [...groups].map(([k, c]) => (c === 1 ? `1 ${k}` : `${c} ${k.replace(/^(book|run)/, '$1s')}`)).join(' + ');
};

// Does a list of groups ({type, size}) meet the contract? Each requirement is matched to a different group of its
// type that is at least as long. (Groups may be longer than required.)
export function meetsContract(groups, reqs) {
  if (groups.length !== reqs.length) return false;
  const used = new Array(groups.length).fill(false);
  const order = [...reqs].sort((a, b) => b.n - a.n);
  const go = i => {
    if (i === order.length) return true;
    for (let g = 0; g < groups.length; g++) {
      if (used[g] || groups[g].type !== order[i].type || groups[g].size < order[i].n) continue;
      used[g] = true; if (go(i + 1)) return true; used[g] = false;
    }
    return false;
  };
  return go(0);
}
