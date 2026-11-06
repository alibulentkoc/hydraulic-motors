/* Shared helpers: units, number formatting, geometry */
window.HM = (function () {
  const fmt = (x, d) => (isFinite(x) ? x : 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  const sg = x => { if (!isFinite(x) || x === 0) return '0'; const a = Math.abs(x);
    if (a >= 1e-3 && a < 1e6) { const d = a >= 10000 ? 0 : a >= 1000 ? 1 : a >= 100 ? 1 : a >= 10 ? 2 : a >= 1 ? 3 : Math.max(4, 3 - Math.floor(Math.log10(a))); return fmt(x, d); }
    const e = Math.floor(Math.log10(a)); return `${(x / 10 ** e).toFixed(3)} × 10${String(e).split('').map(c => SUP[c]).join('')}`; };
  // consistent units used in substitutions, and everyday display units. Values stored in SI.
  const CONS = { si: { len: ['m', 1], area: ['m²', 1], vol: ['m³/rev', 1], p: ['Pa', 1], F: ['N', 1], Q: ['m³/s', 1], T: ['N·m', 1], P: ['W', 1], n: ['rev/s', 1], w: ['rad/s', 1] },
    us: { len: ['in', 1 / 0.0254], area: ['in²', 1 / 0.00064516], vol: ['in³/rev', 1 / 1.6387064e-5], p: ['psi', 1 / 6894.757], F: ['lbf', 1 / 4.448222], Q: ['in³/s', 1 / 1.6387064e-5], T: ['lb·in', 1 / 0.112985], P: ['in·lbf/s', 1 / 0.112985], n: ['rev/s', 1], w: ['rad/s', 1] } };
  const EVERY = { si: { len: ['mm', 1000, 1], area: ['cm²', 1e4, 2], vol: ['cm³/rev', 1e6, 1], p: ['bar', 1e-5, 1], F: ['kN', 1e-3, 2], Q: ['L/min', 60000, 1], T: ['N·m', 1, 1], P: ['kW', 1e-3, 2], n: ['rpm', 60, 0], w: ['rad/s', 1, 2], eff: ['%', 100, 1], deg: ['°', 1, 1], rpm: ['rpm', 1, 0], cnt: ['', 1, 0] },
    us: { len: ['in', 1 / 0.0254, 3], area: ['in²', 1 / 0.00064516, 3], vol: ['in³/rev', 1 / 1.6387064e-5, 3], p: ['psi', 1 / 6894.757, 0], F: ['lbf', 1 / 4.448222, 0], Q: ['gpm', 15850.32, 2], T: ['lb·ft', 0.737562, 1], P: ['hp', 1 / 745.7, 2], n: ['rpm', 60, 0], w: ['rad/s', 1, 2], eff: ['%', 100, 1], deg: ['°', 1, 1], rpm: ['rpm', 1, 0], cnt: ['', 1, 0] } };
  let units = 'si';
  const H = {
    get units() { return units; }, set units(u) { units = u; },
    n: (x, k) => { const t = sg(x * CONS[units][k][1]); return t.includes('×') ? `(${t})` : t; },
    c: (x, k) => `${sg(x * CONS[units][k][1])} ${CONS[units][k][0]}`,
    e: (x, k) => { const E = EVERY[units][k]; return `${fmt(x * E[1], E[2])}${E[0] ? ' ' + E[0] : ''}`; },
    r: (x, k) => (CONS[units][k] ? `${sg(x * CONS[units][k][1])} ${CONS[units][k][0]} = <b>${H.e(x, k)}</b>` : `<b>${H.e(x, k)}</b>`),
    f: fmt, sg, EVERY, CONS
  };
  // geometry
  const P = Math.PI;
  const circ = (cx, cy, r, n = 64, a0 = 0, a1 = 2 * P) => Array.from({ length: n }, (_, i) => { const a = a0 + (a1 - a0) * i / (a1 - a0 >= 2 * P - 1e-9 ? n : n - 1); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const arc = (cx, cy, r, a0, a1, n = 24) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const rot = (pts, a, cx = 0, cy = 0) => pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
  const move = (pts, dx, dy) => pts.map(([x, y]) => [x + dx, y + dy]);
  // toothed outline: teeth go from rBase to rTip (works for external and internal teeth)
  function teeth(N, rBase, rTip, wB = 0.26, wT = 0.12, phase = 0) {
    const p = 2 * P / N, out = [];
    for (let k = 0; k < N; k++) { const c = phase + k * p;
      out.push(...arc(0, 0, rBase, c - p + wB * p, c - wB * p, 5).slice(1));
      out.push(...arc(0, 0, rTip, c - wT * p, c + wT * p, 4)); }
    return out;
  }
  return { H, fmt, sg, circ, arc, rect, rot, move, teeth };
})();
