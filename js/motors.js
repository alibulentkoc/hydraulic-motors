/* Motor type definitions. Each type: build() -> model for the planar engine,
   frame(theta, dir, opts) -> moving parts, fluids and status text.
   theta is the output shaft angle (rad). dir = +1 forward, -1 reverse. */
window.MOTORS = (function () {
  const { circ, arc, rect, rot, move, teeth } = HM;
  const PI = Math.PI, TAU = 2 * PI;
  const hpIf = (cond, dir) => ((cond ? 1 : -1) * dir > 0 ? 'hp' : 'lp');
  const pipeCls = (hp) => hp ? 'pipe-hp' : 'pipe-lp';

  /* ---------- symbols (ISO-style) ---------- */
  function symbol(o = {}) {
    let s = '<circle cx="50" cy="50" r="26"/><line x1="50" y1="2" x2="50" y2="24"/><line x1="50" y1="76" x2="50" y2="98"/>';
    s += '<polygon class="fill" points="42,25 58,25 50,37"/>';
    if (o.bi) s += '<polygon class="fill" points="42,75 58,75 50,63"/>';
    if (o.variable) s += '<line x1="22" y1="80" x2="80" y2="20"/><polygon class="fill" points="80,20 70,24 76,30"/>';
    if (o.drain) s += '<path d="M68,68 L80,82 L80,92" stroke-dasharray="4 3"/><path d="M72,92 H88 M74,96 H86"/>';
    return s;
  }

  /* ---------- gerotor star profile: envelope of the rollers ---------- */
  function starProfile(N, Rp, rl, e, M = 360, S = 900) {
    const L = Array.from({ length: N + 1 }, (_, k) => [Rp * Math.cos(TAU * k / (N + 1)), Rp * Math.sin(TAU * k / (N + 1))]);
    const r = new Array(M).fill(1e9);
    for (let s = 0; s < S; s++) {
      const a = s / S * TAU * N, cx = e * Math.cos(a), cy = e * Math.sin(a), b = a / N, cb = Math.cos(b), sb = Math.sin(b);
      for (const [lx, ly] of L) {
        const qx = (lx - cx) * cb - (ly - cy) * sb, qy = (lx - cx) * sb + (ly - cy) * cb, c2 = qx * qx + qy * qy - rl * rl;
        for (let m = 0; m < M; m++) { const ph = TAU * m / M, ux = Math.cos(ph), uy = Math.sin(ph), bb = ux * qx + uy * qy, disc = bb * bb - c2;
          if (disc > 0) { const t = bb - Math.sqrt(disc); if (t > 0 && t < r[m]) r[m] = t; } }
      }
    }
    return r.map((t, m) => [t * Math.cos(TAU * m / M), t * Math.sin(TAU * m / M)]);
  }

  /* ---------- general calculator rows ---------- */
  function generalRows(v, V, H) {
    const n = v.Q * v.ev / V, T = v.dp * V * v.em / TAU, w = TAU * n, Ph = v.Q * v.dp, Po = T * w;
    const Vr = TAU * v.TL / (v.dp * v.em), Qr = Vr * (v.NL / 60) / v.ev;
    return [
      { label: 'Speed', eq: 'N = Q·η<sub>v</sub> / V<sub>D</sub>', sub: `${H.n(v.Q, 'Q')} × ${H.f(v.ev, 2)} / ${H.n(V, 'vol')}`, res: H.r(n, 'n') },
      { label: 'Torque', eq: 'T = Δp·V<sub>D</sub>·η<sub>m</sub> / 2π', sub: `${H.n(v.dp, 'p')} × ${H.n(V, 'vol')} × ${H.f(v.em, 2)} / 2π`, res: H.r(T, 'T') },
      { label: 'Hydraulic power in', eq: 'P<sub>in</sub> = Q·Δp', sub: `${H.n(v.Q, 'Q')} × ${H.n(v.dp, 'p')}`, res: H.r(Ph, 'P') },
      { label: 'Shaft power out', eq: 'P<sub>out</sub> = T·ω = T·2πN', sub: `${H.n(T, 'T')} × 2π × ${H.f(n, 3)}`, res: H.r(Po, 'P') },
      { label: 'Overall efficiency', eq: 'η = η<sub>v</sub>·η<sub>m</sub> = P<sub>out</sub>/P<sub>in</sub>', sub: `${H.f(v.ev, 2)} × ${H.f(v.em, 2)}`, res: `<b>${H.f(v.ev * v.em * 100, 1)} %</b>` },
      { label: 'Sizing: displacement for the load torque', eq: 'V<sub>D</sub> = 2π·T<sub>load</sub> / (Δp·η<sub>m</sub>)', sub: `2π × ${H.n(v.TL, 'T')} / (${H.n(v.dp, 'p')} × ${H.f(v.em, 2)})`, res: H.r(Vr, 'vol') },
      { label: 'Sizing: flow for the load speed', eq: 'Q = V<sub>D</sub>·N<sub>load</sub> / η<sub>v</sub>', sub: `${H.n(Vr, 'vol')} × ${H.f(v.NL / 60, 3)} / ${H.f(v.ev, 2)}`, res: H.r(Qr, 'Q') }];
  }
  const GEN = [['dp', 'Pressure drop Δp', 'p', 1.5e7], ['Q', 'Flow Q', 'Q', 30 / 60000], ['ev', 'Volumetric efficiency η<sub>v</sub>', 'eff', 0.92], ['em', 'Mechanical efficiency η<sub>m</sub>', 'eff', 0.9],
    ['TL', 'Load torque (for sizing)', 'T', 80], ['NL', 'Load speed (for sizing)', 'rpm', 500]];
  const Vin = (def) => [['V', 'Displacement V<sub>D</sub> (from datasheet)', 'vol', def]];

  /* ================= 1. External gear ================= */
  const extGear = (() => {
    const N = 12, RR = 5.2, RO = 6.8, Rc = 7.1, p = TAU / N;
    const half = s => { const y0 = Math.sqrt(Rc * Rc - 16), a0 = Math.atan2(-y0, -4), a1 = Math.atan2(y0, -4);
      const pts = [[2, 11], [16, 11], [16, -11], [2, -11], [2, -y0], ...arc(6, 0, Rc, a0, a1, 40), [2, y0]];
      return s > 0 ? pts : pts.map(([x, y]) => [-x, y]).reverse(); };
    return {
      id: 'external-gear', family: 'Gear motors', name: 'External gear motor', sym: { bi: true },
      summary: 'Two meshing spur gears in a close-fitting housing. One gear is on the output shaft.',
      steps: ['Pressure oil enters the inlet port and pushes on the gear teeth that face it.', 'The teeth carry pockets of oil around the outside of each gear, between the teeth and the housing, to the outlet.',
        'Where the teeth mesh in the middle, oil cannot pass back, so the pressure difference keeps pushing the gears round.', 'Reversing the flow reverses the rotation.'],
      uses: 'Fans, augers, conveyors, sweepers and mixers where moderate speed and torque, low cost and tolerance of dirt matter. Typical speeds 500 to 3,000 rpm.',
      watch: 'Leakage past the tooth tips and side plates grows with pressure and wear, so starting torque and low-speed performance are poorer than piston motors.',
      calc: { geom: [['Do', 'Gear outside diameter D<sub>o</sub>', 'len', 0.044], ['Di', 'Gear root diameter D<sub>i</sub>', 'len', 0.034], ['L', 'Gear width L', 'len', 0.025]],
        V: v => Math.PI / 4 * (v.Do ** 2 - v.Di ** 2) * v.L, Veq: 'V<sub>D</sub> = (π/4)·(D<sub>o</sub>² − D<sub>i</sub>²)·L',
        Vsub: (v, H) => `(π/4) × (${H.n(v.Do, 'len')}² − ${H.n(v.Di, 'len')}²) × ${H.n(v.L, 'len')}`, note: 'Textbook approximation for gear machines.' },
      vis: 20,
      build() {
        const g = teeth(N, RR, RO);
        return { vb: [-20, -18, 40, 36], depth: 8, backPlate: rect(-16, -11, 16, 11),
          parts: [{ id: 'hL', cls: 'housing', pts: half(-1) }, { id: 'hR', cls: 'housing', pts: half(1) },
            { id: 'pin', cls: 'pipe-hp', pts: rect(-2, -15, 2, -11), z: [2, 6] }, { id: 'pout', cls: 'pipe-lp', pts: rect(-2, 11, 2, 15), z: [2, 6] },
            { id: 'g1', cls: 'gearA', pts: g, holes: [circ(0, 0, 1.3, 24)], z: [.3, 7.7] }, { id: 'g2', cls: 'gearB', pts: g, holes: [circ(0, 0, 1.0, 24)], z: [.3, 7.7] },
            { id: 's1', cls: 'shaft', pts: circ(0, 0, 1.3, 24), z: [-2, 11] }, { id: 'k1', cls: 'key', pts: rect(-.3, .8, .3, 1.6), z: [-2, 11] }, { id: 's2', cls: 'shaft', pts: circ(0, 0, 1.0, 24), z: [-1, 9] }],
          labels: [{ text: 'Drive gear (on the output shaft)', at: [-6, -3], tx: -12, ty: -15.5 }, { text: 'Idler gear', at: [8, -3], tx: 12, ty: -15.5 },
            { text: 'Port A', at: [0, -13], tx: -5, ty: -13 }, { text: 'Port B', at: [0, 13], tx: -5, ty: 13 },
            { text: 'Oil carried around the outside', at: [-12.6, 2], tx: -13, ty: 15.5 }, { text: 'Housing', at: [14, 6], tx: 13, ty: 15.5 }] };
      },
      frame(th, dir) {
        const fwd = dir > 0, xf = { g1: { x: -6, r: -th }, s1: { x: -6, r: -th }, k1: { x: -6, r: -th }, g2: { x: 6, r: th + PI / N }, s2: { x: 6, r: th + PI / N },
          pin: { cls: pipeCls(fwd) }, pout: { cls: pipeCls(!fwd) } };
        const fluids = [{ pts: rect(-2, -11, 2, -2), f: fwd ? 'hp' : 'lp' }, { pts: rect(-2, 2, 2, 11), f: fwd ? 'lp' : 'hp' }];
        [[-6, -th, 1], [6, th + PI / N, -1]].forEach(([cx, r0, side]) => {
          for (let k = 0; k < N; k++) { const a = r0 + (k + .5) * p; if (Math.cos(a) * side > .72) continue;
            const pts = [...arc(cx, 0, RR + .05, a - .2 * p, a + .2 * p, 4), ...arc(cx, 0, Rc - .05, a + .36 * p, a - .36 * p, 4)];
            fluids.push({ pts, f: hpIf(Math.sin(a) < 0, dir) }); } });
        return { xf, fluids, status: fwd ? 'Pressure oil (red) enters port A at the bottom. It pushes on the teeth, turning the drive gear clockwise and the idler anticlockwise. Pockets of oil are carried round the outside to port B.'
          : 'Reversed: pressure oil enters port B at the top, so both gears turn the other way.' };
      }
    };
  })();

  /* ================= 2. Internal gear (crescent) ================= */
  const intGear = (() => {
    const N1 = 10, N2 = 16, E = 3;
    const crescent = (() => { const out = [], inn = [], a0 = 8 * PI / 180, a1 = 172 * PI / 180, n = 40;
      for (let i = 0; i <= n; i++) { const f = a0 + (a1 - a0) * i / n, ro = 6.85, t = -E * Math.sin(f) + Math.sqrt(E * E * Math.sin(f) ** 2 + 6.15 ** 2 - E * E);
        const w = Math.pow(Math.sin(PI * i / n), .45), ti = ro - (ro - t) * w; out.push([ro * Math.cos(f), ro * Math.sin(f)]); inn.unshift([ti * Math.cos(f), ti * Math.sin(f)]); }
      return out.concat(inn); })();
    return {
      id: 'internal-gear', family: 'Gear motors', name: 'Internal gear motor', sym: { bi: true },
      summary: 'A small external-toothed pinion runs inside a larger ring gear with internal teeth. A crescent-shaped filler separates the inlet side from the outlet side.',
      steps: ['The pinion is on the shaft and sits off-centre inside the ring gear; both turn in the same direction.', 'Pressure oil enters the tooth spaces on one side and pushes on the teeth.',
        'The crescent seals between the two sets of teeth, so oil is carried from the inlet side to the outlet side.', 'Compared with an external gear motor it runs quieter and smoother, with less flow ripple.'],
      uses: 'Quiet machinery, machine tools, and drives where smooth low-noise running is wanted.',
      watch: 'Displacement depends on the full tooth geometry, so take it from the manufacturer’s datasheet.',
      calc: { geom: Vin(3.2e-5) }, vis: 16,
      build() {
        return { vb: [-20, -17, 40, 34], depth: 8, backPlate: circ(0, 0, 12.5, 72),
          parts: [{ id: 'hous', cls: 'housing', pts: circ(0, 0, 12.5, 96), holes: [circ(0, 0, 10.6, 96)] },
            { id: 'ring', cls: 'ring', pts: circ(0, 0, 10.5, 96), holes: [teeth(N2, 9.1, 6.95)], z: [.3, 7.7] },
            { id: 'pin', cls: 'gearA', pts: teeth(N1, 3.9, 6.0), holes: [circ(0, 0, 1.4, 24)], z: [.3, 7.7] },
            { id: 'sh', cls: 'shaft', pts: circ(0, 0, 1.4, 24), z: [-2, 11] }, { id: 'key', cls: 'key', pts: rect(-.3, .9, .3, 1.7), z: [-2, 11] },
            { id: 'cres', cls: 'crescent', pts: crescent, z: [.2, 7.8] },
            { id: 'pA', cls: 'pipe-hp', pts: rect(-15, -1.3, -10.4, 1.3), z: [2, 6] }, { id: 'pB', cls: 'pipe-lp', pts: rect(10.4, -1.3, 15, 1.3), z: [2, 6] }],
          labels: [{ text: 'Pinion (on the shaft)', at: [0, -4], tx: -11, ty: -15.5 }, { text: 'Ring gear (internal teeth)', at: [6, -7], tx: 11, ty: -15.5 },
            { text: 'Crescent seal', at: [0, 5], tx: 0, ty: 15.5 }, { text: 'Port A', at: [-13, 1.3], tx: -15, ty: 6 }, { text: 'Port B', at: [13, 1.3], tx: 15, ty: 6 }] };
      },
      frame(th, dir) {
        const fwd = dir > 0, r1 = th - PI / 2, r2 = th * N1 / N2 - PI / 2 - PI / N2;
        return { xf: { ring: { r: r2 }, pin: { y: -E, r: r1 }, sh: { y: -E, r: r1 }, key: { y: -E, r: r1 }, pA: { cls: pipeCls(fwd) }, pB: { cls: pipeCls(!fwd) } },
          fluids: [{ pts: [[0, 9], ...arc(0, 0, 9, PI / 2, 3 * PI / 2, 30)], f: fwd ? 'hp' : 'lp' }, { pts: [[0, -9], ...arc(0, 0, 9, -PI / 2, PI / 2, 30)], f: fwd ? 'lp' : 'hp' }],
          status: (fwd ? 'Pressure oil enters port A (left). ' : 'Reversed: pressure oil enters port B (right). ') + 'It pushes on the teeth of the pinion and the ring, which turn together in the same direction. The crescent keeps the pressure side apart from the return side.' };
      }
    };
  })();

  /* ================= 3 and 4. Gerotor and geroller ================= */
  const GN = 6, GRp = 9, GRl = 2.0, GE = 1.0;
  let STAR = null; const star = () => STAR || (STAR = starProfile(GN, GRp, GRl, GE));
  const lobeAng = k => TAU * k / (GN + 1);
  function geroFluids(alpha, rotAll, dir) {
    const out = [];
    for (let k = 0; k <= GN; k++) { const a0 = lobeAng(k), a1 = lobeAng(k + 1), mid = (a0 + a1) / 2;
      let pts = [[0, 0], ...arc(0, 0, GRp, a0, a1, 10)]; if (rotAll) pts = rot(pts, rotAll);
      out.push({ pts, f: hpIf(Math.sin(mid - alpha) > 0, dir) }); }
    return out;
  }
  const gerotor = {
    id: 'gerotor', family: 'Gerotor and geroller motors', name: 'Gerotor motor', sym: { bi: true },
    summary: 'An inner rotor with N lobes turns inside an outer rotor with N + 1 lobes. Both turn, on fixed but offset centres.',
    steps: ['The inner rotor is on the shaft; the outer rotor turns in the housing at N/(N+1) of the inner speed.', 'Between the lobes are N + 1 chambers. On one side they grow, on the other they shrink.',
      'Ports in the end plate feed pressure oil to the growing chambers, so the pressure turns the rotors; the shrinking chambers push oil out to the return port.'],
    uses: 'Compact medium-speed drives, and the basis of the low-speed, high-torque geroller (orbital) motor.',
    watch: 'Here the inner rotor has 6 lobes and the outer has 7. The lobes slide against each other, so wear and leakage limit high-pressure use.',
    calc: { geom: Vin(4.0e-5) }, vis: 14,
    build() {
      const parts = [{ id: 'hous', cls: 'housing', pts: circ(0, 0, 14, 96), holes: [circ(0, 0, 12.6, 96)] }, { id: 'outer', cls: 'ring', pts: circ(0, 0, 12.4, 96), holes: [circ(0, 0, GRp, 96)], z: [.3, 7.7] }];
      for (let k = 0; k <= GN; k++) parts.push({ id: 'lobe' + k, cls: 'ring', pts: circ(GRp * Math.cos(lobeAng(k)), GRp * Math.sin(lobeAng(k)), GRl, 32), z: [.3, 7.7] });
      parts.push({ id: 'star', cls: 'rotor', pts: star(), holes: [circ(0, 0, 1.8, 24)], z: [.3, 7.7] }, { id: 'sh', cls: 'shaft', pts: circ(0, 0, 1.8, 24), z: [-2, 11] }, { id: 'key', cls: 'key', pts: rect(-.3, 1.1, .3, 2.0), z: [-2, 11] },
        { id: 'pA', cls: 'pipe-hp', pts: rect(-17, -1.2, -13.6, 1.2), z: [2, 6] }, { id: 'pB', cls: 'pipe-lp', pts: rect(13.6, -1.2, 17, 1.2), z: [2, 6] });
      return { vb: [-21, -17, 42, 34], depth: 8, backPlate: circ(0, 0, 14, 72), parts,
        labels: [{ text: 'Inner rotor (6 lobes, on the shaft)', at: [GE, -4], tx: -10, ty: -15.5 }, { text: 'Outer rotor (7 lobes)', at: [9, -7], tx: 11, ty: -15.5 },
          { text: 'Housing', at: [-10, 9.5], tx: -14, ty: 15.5 }, { text: 'Port A', at: [-16, 1.2], tx: -17, ty: 4.5 }, { text: 'Port B', at: [16, 1.2], tx: 17, ty: 4.5 }] };
    },
    frame(th, dir) {
      const alpha = -th * GN / (GN + 1), outerA = -alpha, fwd = dir > 0;
      const xf = { outer: { r: outerA }, star: { x: GE, r: th }, sh: { x: GE, r: th }, key: { x: GE, r: th }, pA: { cls: pipeCls(fwd) }, pB: { cls: pipeCls(!fwd) } };
      for (let k = 0; k <= GN; k++) xf['lobe' + k] = { r: outerA };
      return { xf, fluids: geroFluids(alpha, -alpha, dir), status: (fwd ? 'Forward: ' : 'Reversed: ') + 'pressure oil fills the chambers that are growing (red) and pushes the rotors round. The outer rotor turns 6/7 as fast as the inner rotor; shrinking chambers (blue) return oil to tank.' };
    }
  };
  const geroller = {
    id: 'geroller', family: 'Gerotor and geroller motors', name: 'Geroller (orbital) motor', sym: { bi: true },
    summary: 'A gerotor turned inside out: the outer ring is fixed and carries rollers, and the inner star orbits around the centre while it turns slowly. This gives high torque at low speed.',
    steps: ['The star has 6 teeth and the stator has 7 rollers. A rotary valve sends pressure oil to the chambers that are growing.', 'Pressure pushes the star so its centre orbits around the motor centre (dashed circle).',
      'Each orbit turns the star back by one tooth: 6 orbits make one turn of the output shaft, which is driven through a splined drive link (“dog bone”).', 'Because the chambers fill 6 × 7 = 42 times per shaft turn, the displacement is large for its size: high torque, low speed.'],
    uses: 'Wheel and track drives, augers, conveyors, sweepers, combine reels, planter and seeder drives, and car-wash brushes. Typically 10 to 800 rpm.',
    watch: 'The rollers turn as the star passes, which reduces friction compared with a plain gerotor. Side loads go on the output shaft bearings, so check the bearing rating.',
    calc: { geom: Vin(1.6e-4), extra: (v, H) => [{ label: 'Star orbits per shaft turn', eq: 'N<sub>star</sub> = 6', sub: '6 star teeth, 7 rollers', res: '<b>6 orbits per revolution</b>' }] }, vis: 4,
    build() {
      const parts = [{ id: 'stat', cls: 'housing', pts: circ(0, 0, 13.5, 96), holes: [circ(0, 0, GRp, 96)] }];
      for (let k = 0; k <= GN; k++) parts.push({ id: 'roll' + k, cls: 'roller', pts: circ(GRp * Math.cos(lobeAng(k)), GRp * Math.sin(lobeAng(k)), GRl, 32), z: [.3, 7.7] });
      parts.push({ id: 'star', cls: 'rotor', pts: star(), holes: [teeth(10, 2.1, 1.7)], z: [.3, 7.7] },
        { id: 'pA', cls: 'pipe-hp', pts: rect(-17, -1.2, -13.4, 1.2), z: [2, 6] }, { id: 'pB', cls: 'pipe-lp', pts: rect(13.4, -1.2, 17, 1.2), z: [2, 6] });
      return { vb: [-21, -17, 42, 34], depth: 8, backPlate: circ(0, 0, 13.5, 72), parts,
        overlays: [{ tag: 'circle', attr: { cx: 0, cy: 0, r: GE, class: 'orbit' } }],
        labels: [{ text: 'Star (6 teeth)', at: [3, -4], tx: -10, ty: -15.5 }, { text: 'Rollers (7)', at: [GRp * Math.cos(lobeAng(5)), GRp * Math.sin(lobeAng(5)) - 2], tx: 11, ty: -15.5 },
          { text: 'Stator (fixed)', at: [-10, 9], tx: -13, ty: 15.5 }, { text: 'Output shaft turns slowly', at: [0, 0], tx: 9, ty: 15.5 },
          { text: 'Port A', at: [-16, 1.2], tx: -17, ty: 4.5 }, { text: 'Port B', at: [16, 1.2], tx: 17, ty: 4.5 }] };
    },
    frame(th, dir) {
      const alpha = -GN * th, cx = GE * Math.cos(alpha), cy = GE * Math.sin(alpha), fwd = dir > 0;
      const above = [{ pts: circ(cx, cy, 2.0, 24), cls: 'gearB', z: [.2, 7.8] }, { pts: circ(0, 0, 1.25, 24), cls: 'shaft', z: [-2, 11] }, { pts: rot(rect(-.25, 0, .25, 1.25), th - PI / 2), cls: 'key', z: [-2, 11] }, { pts: circ(cx, cy, .35, 12), cls: 'key', no3d: true }];
      return { xf: { star: { x: cx, y: cy, r: th }, pA: { cls: pipeCls(fwd) }, pB: { cls: pipeCls(!fwd) } }, fluids: geroFluids(alpha, 0, dir), above,
        status: `${fwd ? 'Forward' : 'Reversed'}: the star’s centre orbits ${fwd ? 'clockwise' : 'anticlockwise'} six times for every turn of the output shaft, which turns slowly the other way. Pressure fills the growing chambers (red).` };
    }
  };

  /* ================= 5. Unbalanced vane ================= */
  const uVane = (() => {
    const Rc = 9, Rr = 7.4, e = Rc - Rr, NV = 8, Lv = 4.0;
    const tip = f => e * Math.sin(f) + Math.sqrt(Rc * Rc - e * e * Math.cos(f) ** 2);
    return {
      id: 'unbalanced-vane', family: 'Vane motors', name: 'Unbalanced vane motor', sym: { bi: true },
      summary: 'A slotted rotor sits off-centre in a round cam ring. Vanes slide in the slots and seal against the ring.',
      steps: ['Springs or oil pressure under the vanes hold them against the ring.', 'On the side where the gap between rotor and ring grows, pressure oil fills the chambers.',
        'In each pressurised chamber the leading vane sticks out further than the trailing one, so it is pushed harder: that difference is the torque.', 'All the pressure is on one side, so the shaft bearings carry a side load (“unbalanced”).'],
      uses: 'Medium-speed drives where smooth, quiet running and low ripple matter. Varying the offset (eccentricity) can vary the displacement.',
      watch: 'The side load on the bearings limits the working pressure. Vanes and ring wear over time.',
      calc: { geom: [['Dc', 'Cam ring diameter D<sub>c</sub>', 'len', 0.070], ['Dr', 'Rotor diameter D<sub>r</sub>', 'len', 0.060], ['e', 'Eccentricity e', 'len', 0.005], ['L', 'Rotor width L', 'len', 0.030]],
        V: v => Math.PI / 2 * (v.Dc + v.Dr) * v.e * v.L, Veq: 'V<sub>D</sub> = (π/2)·(D<sub>c</sub> + D<sub>r</sub>)·e·L',
        Vsub: (v, H) => `(π/2) × (${H.n(v.Dc, 'len')} + ${H.n(v.Dr, 'len')}) × ${H.n(v.e, 'len')} × ${H.n(v.L, 'len')}`,
        note: 'Textbook formula. It uses the crescent area between rotor and ring; a chamber-by-chamber analysis gives a larger value, so for real selection use the manufacturer’s displacement.' }, vis: 16,
      build() {
        const parts = [{ id: 'ring', cls: 'housing', pts: circ(0, 0, 12.5, 96), holes: [circ(0, 0, Rc, 96)] },
          { id: 'rotor', cls: 'rotor', pts: circ(0, 0, Rr, 96), holes: [circ(0, 0, 2, 24)], z: [.3, 7.7] }, { id: 'sh', cls: 'shaft', pts: circ(0, 0, 2, 24), z: [-2, 11] }, { id: 'key', cls: 'key', pts: rect(-.35, 1.3, .35, 2.2), z: [-2, 11] },
          { id: 'pA', cls: 'pipe-hp', pts: rect(9.5, -1.3, 15.5, 1.3), z: [2, 6] }, { id: 'pB', cls: 'pipe-lp', pts: rect(-15.5, -1.3, -9.5, 1.3), z: [2, 6] }];
        for (let k = 0; k < NV; k++) parts.push({ id: 'v' + k, cls: 'vane', pts: rect(0, -.3, Lv, .3), z: [.3, 7.7] });
        return { vb: [-20, -17, 40, 34], depth: 8, backPlate: circ(0, 0, 12.5, 72), parts,
          labels: [{ text: 'Cam ring (housing)', at: [-9.6, 5], tx: -13, ty: 15.5 }, { text: 'Vanes', at: [0, 9.3], tx: 6, ty: 15.5 }, { text: 'Rotor (off-centre)', at: [-4, -4], tx: -11, ty: -15.5 },
            { text: 'Seal point', at: [0, -8.9], tx: 9, ty: -15.5 }, { text: 'Port A', at: [14, 1.3], tx: 16, ty: 5 }, { text: 'Port B', at: [-14, 1.3], tx: -16, ty: 5 }] };
      },
      frame(th, dir) {
        const fwd = dir > 0, xf = { rotor: { y: -e, r: th }, sh: { y: -e, r: th }, key: { y: -e, r: th }, pA: { cls: pipeCls(fwd) }, pB: { cls: pipeCls(!fwd) } }, step = TAU / NV, fluids = [];
        for (let k = 0; k < NV; k++) { const f = th + k * step, t = tip(f) - .05, s = t - Lv; xf['v' + k] = { x: s * Math.cos(f), y: -e + s * Math.sin(f), r: f };
          const f2 = f + step, T1 = tip(f), T2 = tip(f2); let g1 = Math.atan2(-e + T1 * Math.sin(f), T1 * Math.cos(f)), g2 = Math.atan2(-e + T2 * Math.sin(f2), T2 * Math.cos(f2)); while (g2 < g1) g2 += TAU;
          fluids.push({ pts: [...arc(0, -e, Rr + .02, f, f2, 8), ...arc(0, 0, Rc - .02, g2, g1, 10)], f: hpIf(Math.cos(f + step / 2) > 0, dir) }); }
        return { xf, fluids, status: (fwd ? 'Pressure oil enters port A on the right, where the chambers grow, and turns the rotor anticlockwise. ' : 'Reversed: pressure enters port B on the left and the rotor turns clockwise. ') + 'All the pressure is on one side of the rotor, so the bearings carry a side load.' };
      }
    };
  })();

  /* ================= 6. Balanced vane ================= */
  const bVane = (() => {
    const Rm = 8.2, A = 1.2, Rr = 6.95, NV = 10, Lv = 3.4, rf = f => Rm - A * Math.cos(2 * f);
    const ringPts = Array.from({ length: 180 }, (_, i) => { const f = TAU * i / 180; return [rf(f) * Math.cos(f), rf(f) * Math.sin(f)]; });
    const pipe = a => rot(rect(9.8, -1.1, 14.5, 1.1), a);
    return {
      id: 'balanced-vane', family: 'Vane motors', name: 'Balanced vane motor', sym: { bi: true },
      summary: 'The rotor is centred in an oval (two-lobe) cam ring, so there are two pressure zones directly opposite each other.',
      steps: ['Each vane goes out and back in twice per revolution as it follows the oval ring.', 'Two opposite inlet ports feed the growing chambers; two opposite outlet ports take oil from the shrinking chambers.',
        'Because the two pressure zones face each other, the side forces on the shaft cancel: the motor is hydraulically balanced.'],
      uses: 'Higher-pressure industrial drives, mobile fan drives, and machine tools needing smooth, quiet rotation.',
      watch: 'Balanced vane units are fixed displacement (the ring shape is fixed). Vanes must be held out against the ring at start-up, usually by springs.',
      calc: { geom: [['R1', 'Major ring radius R<sub>1</sub>', 'len', 0.040], ['R2', 'Minor ring radius R<sub>2</sub>', 'len', 0.034], ['L', 'Rotor width L', 'len', 0.025]],
        V: v => Math.PI * (v.R1 ** 2 - v.R2 ** 2) * v.L, Veq: 'V<sub>D</sub> = π·(R<sub>1</sub>² − R<sub>2</sub>²)·L', Vsub: (v, H) => `π × (${H.n(v.R1, 'len')}² − ${H.n(v.R2, 'len')}²) × ${H.n(v.L, 'len')}`,
        note: 'Ideal value for a two-lobe ring, with the vane thickness ignored.' }, vis: 16,
      build() {
        const parts = [{ id: 'ring', cls: 'housing', pts: circ(0, 0, 12.5, 96), holes: [ringPts] },
          { id: 'rotor', cls: 'rotor', pts: circ(0, 0, Rr, 96), holes: [circ(0, 0, 2, 24)], z: [.3, 7.7] }, { id: 'sh', cls: 'shaft', pts: circ(0, 0, 2, 24), z: [-2, 11] }, { id: 'key', cls: 'key', pts: rect(-.35, 1.3, .35, 2.2), z: [-2, 11] },
          { id: 'pA1', cls: 'pipe-hp', pts: pipe(PI / 4), z: [2, 6] }, { id: 'pA2', cls: 'pipe-hp', pts: pipe(5 * PI / 4), z: [2, 6] }, { id: 'pB1', cls: 'pipe-lp', pts: pipe(3 * PI / 4), z: [2, 6] }, { id: 'pB2', cls: 'pipe-lp', pts: pipe(7 * PI / 4), z: [2, 6] }];
        for (let k = 0; k < NV; k++) parts.push({ id: 'v' + k, cls: 'vane', pts: rect(0, -.3, Lv, .3), z: [.3, 7.7] });
        return { vb: [-20, -17, 40, 34], depth: 8, backPlate: circ(0, 0, 12.5, 72), parts,
          labels: [{ text: 'Oval cam ring', at: [0, 10.5], tx: 0, ty: 15.5 }, { text: 'Rotor (centred)', at: [-3, -3], tx: -12, ty: -15.5 }, { text: 'Vanes', at: [7.2, -.5], tx: 14, ty: -15.5 },
            { text: 'Port A (two, opposite)', at: [9.5, 9.5], tx: 14, ty: 15.5 }, { text: 'Port B (two, opposite)', at: [-9.5, 9.5], tx: -14, ty: 15.5 }] };
      },
      frame(th, dir) {
        const fwd = dir > 0, xf = { rotor: { r: th }, sh: { r: th }, key: { r: th }, pA1: { cls: pipeCls(fwd) }, pA2: { cls: pipeCls(fwd) }, pB1: { cls: pipeCls(!fwd) }, pB2: { cls: pipeCls(!fwd) } }, step = TAU / NV, fluids = [];
        for (let k = 0; k < NV; k++) { const f = th + k * step, s = rf(f) - .05 - Lv; xf['v' + k] = { x: s * Math.cos(f), y: s * Math.sin(f), r: f };
          const ring = Array.from({ length: 11 }, (_, i) => { const g = f + step - step * i / 10, r = rf(g) - .02; return [r * Math.cos(g), r * Math.sin(g)]; });
          fluids.push({ pts: [...arc(0, 0, Rr + .02, f, f + step, 8), ...ring], f: hpIf(Math.sin(2 * (f + step / 2)) > 0, dir) }); }
        return { xf, fluids, status: (fwd ? 'Pressure oil enters both A ports. ' : 'Reversed: pressure oil enters both B ports. ') + 'The two pressure zones are directly opposite each other, so their side forces on the shaft cancel out.' };
      }
    };
  })();

  /* ================= 7. Axial piston (swashplate), fixed and variable ================= */
  function axialType(variable) {
    const Z = 9, Rb = 4.5, X0 = -7, PL = 6, BX = 9;
    const geo = (th, al) => Array.from({ length: Z }, (_, i) => { const t = th + TAU * i / Z, y = Rb * Math.cos(t), z = Rb * Math.sin(t), xh = X0 + .8 + .6 + y * Math.tan(al); return { t, y, z, xh }; });
    return {
      id: variable ? 'axial-variable' : 'axial-fixed', family: 'Piston motors', name: variable ? 'Axial piston, variable (swashplate)' : 'Axial piston, fixed (swashplate)', sym: variable ? { bi: true, variable: true, drain: true } : { bi: true, drain: true },
      summary: variable ? 'Pistons in a rotating cylinder block push against a swashplate whose angle can be changed. Changing the angle changes the displacement, and so the speed and torque.' : 'Pistons in a rotating cylinder block push against a tilted swashplate set at a fixed angle.',
      steps: ['The cylinder block is splined to the shaft. Its pistons run parallel to the shaft, and their shoes slide on the swashplate.', 'A valve plate behind the block connects the pistons on one half of the circle to pressure and the other half to return (see the end-view inset).',
        'Pressurised pistons push their shoes against the sloping plate. The plate pushes back at an angle, and the sideways part of that force turns the block and shaft.',
        variable ? 'A smaller swash angle means a shorter stroke: less displacement, so higher speed and lower torque for the same flow and pressure. At zero angle the motor stops.' : 'Leakage collects inside the case and must be drained to tank through a case drain line.'],
      uses: variable ? 'Hydrostatic drives (combine and windrower ground drive, wheel loaders), winches and mixer drums where speed range matters.' : 'High-pressure, high-power drives: mixer drums, fans, hydrostatic drives. Typical pressures 250 to 400 bar.',
      watch: 'Piston motors are the most efficient type but need clean oil. Always connect the case drain directly to tank.',
      calc: { geom: [['z', 'Number of pistons z', 'cnt', 9], ['d', 'Piston diameter d', 'len', 0.016], ['D', 'Pitch circle diameter D', 'len', 0.060], ['a', 'Swash angle α', 'deg', variable ? 15 : 18]],
        V: v => v.z * Math.PI * v.d ** 2 / 4 * v.D * Math.tan(v.a * PI / 180), Veq: 'V<sub>D</sub> = z·(π·d²/4)·D·tan α',
        Vsub: (v, H) => `${H.f(v.z, 0)} × (π × ${H.n(v.d, 'len')}² / 4) × ${H.n(v.D, 'len')} × tan ${H.f(v.a, 1)}°`, note: 'Stroke = D·tan α.' }, vis: 20,
      opts: variable ? [{ id: 'alpha', label: 'Swash angle', min: 0, max: 18, def: 12, unit: '°' }] : null,
      build(o) {
        const al = (variable ? o.alpha : 15) * PI / 180;
        const m = { vb: [-22, -16, 46, 32], depth: 0,
          parts: [{ id: 'hous', cls: 'housing', pts: rect(-16, -11, 14, 11), holes: [rect(-15, -10, 13, 10)] },
            { id: 'shaft', cls: 'shaft', pts: rect(-19, -1, 15.2, 1) }, { id: 'block', cls: 'block', pts: rect(-1, -7, BX, 7) },
            { id: 'swash', cls: 'swash', pts: rect(-.8, -8.5, .8, 8.5) }, { id: 'vp', cls: 'plate', pts: rect(BX, -7, BX + 1.2, 7) },
            { id: 'pA', cls: 'pipe-hp', pts: rect(10.3, 10, 11.9, 14) }, { id: 'pB', cls: 'pipe-lp', pts: rect(10.3, -14, 11.9, -10) }],
          overlays: [{ tag: 'circle', attr: { cx: 18.8, cy: 0, r: 3.4, class: 'p-plate' } }],
          labels: [{ text: variable ? 'Swashplate (angle adjustable)' : 'Swashplate (fixed angle)', at: [X0, 6], tx: -12, ty: 14 }, { text: 'Pistons and shoes', at: [-2, -3.5], tx: -11, ty: -14 },
            { text: 'Cylinder block (turns with the shaft)', at: [5, -6.5], tx: 3, ty: -14 }, { text: 'Valve plate', at: [9.6, 5], tx: 4, ty: 14 }, { text: 'Shaft', at: [-17.5, 1], tx: -19.5, ty: 5 },
            { text: 'Port A', at: [11.1, 14], tx: 14, ty: 14 }, { text: 'Port B', at: [11.1, -14], tx: 14, ty: -14 }, { text: 'Valve plate, end view', at: [18.8, 3.4], tx: 19, ty: 6.8 }] };
        m.al = al;
        m.custom3D = (T, M, root) => axial3D(T, M, root, () => m.al);
        return m;
      },
      frame(th, dir, o) {
        const al = (variable ? o.alpha : 15) * PI / 180, fwd = dir > 0, P = geo(th, al), above = [];
        P.slice().sort((a, b) => a.z - b.z).forEach(p => { const f = hpIf(Math.sin(p.t) > 0, dir), back = p.z < 0 ? 'back' : '';
          above.push({ pts: rect(p.xh + PL, p.y - .75, BX, p.y + .75), f, extra: back });
          above.push({ pts: rect(p.xh - .6, p.y - 1.1, p.xh, p.y + 1.1), cls: 'swash', extra: back }, { pts: rect(p.xh, p.y - .75, p.xh + PL, p.y + .75), cls: 'piston', extra: back }); });
        // end-view inset of the valve plate
        const cx = 18.8, kid = (a0, a1) => [...arc(cx, 0, 2.8, a0, a1, 16), ...arc(cx, 0, 1.9, a1, a0, 16)];
        above.push({ pts: kid(.25, PI - .25), f: fwd ? 'hp' : 'lp' }, { pts: kid(PI + .25, TAU - .25), f: fwd ? 'lp' : 'hp' });
        P.forEach(p => above.push({ pts: circ(cx + 2.35 * Math.cos(p.t), 2.35 * Math.sin(p.t), .32, 10), cls: 'piston' }));
        return { xf: { swash: { x: X0, r: -al }, pA: { cls: pipeCls(fwd) }, pB: { cls: pipeCls(!fwd) } }, above, axial: { th, al, P },
          status: `${fwd ? 'Pressure in port A' : 'Reversed: pressure in port B'}. Pistons on the pressure half of the valve plate (red) push against the ${H_deg(al)} swashplate and turn the block.` + (variable ? ` Stroke is now ${HM.fmt(2 * Rb * Math.tan(al) / (2 * Rb * Math.tan(18 * PI / 180)) * 100, 0)} % of maximum.` : '') };
      }
    };
  }
  const H_deg = a => HM.fmt(a * 180 / PI, 0) + '°';
  function axial3D(T, M, root, getAl) {
    const Z = 9, Rb = 4.5, X0 = -7, PL = 6, BX = 9, cyl = (r, l, mat, seg = 32, tl = Math.PI * 2) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, l, seg, 1, true, 0, tl), mat); m.rotation.z = -Math.PI / 2; return m; };
    const solid = (r, l, mat) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, l, 32), mat); m.rotation.z = -Math.PI / 2; return m; };
    const hous = cyl(11, 30, M.housing, 48, Math.PI * 1.5); hous.position.x = -1; hous.rotation.x = Math.PI * 0.25; root.add(hous);
    const sh = solid(1, 34, M.shaft); sh.position.x = -2; root.add(sh);
    const swash = new T.Mesh(new T.CylinderGeometry(8.5, 8.5, 1.6, 48), M.swash); swash.position.x = X0; root.add(swash);
    const vp = solid(7, 1.2, M.plate); vp.position.x = BX + .6; root.add(vp);
    const block = new T.Group(); root.add(block);
    const bm = solid(7, BX + 1, M.block); bm.position.x = (BX - 1) / 2; block.add(bm);
    const pis = [], fl = [];
    for (let i = 0; i < Z; i++) { const p = solid(.75, PL, M.piston); block.add(p); const s = solid(1.1, .6, M.swash); block.add(s); const f = solid(.72, 1, M.hp); block.add(f); pis.push({ p, s, f }); }
    return { update(fr) { const a = fr.axial; if (!a) return; swash.rotation.set(0, 0, -Math.PI / 2 - a.al); block.rotation.x = a.th;
      a.P.forEach((q, i) => { const phi = TAU * i / Z, y = Rb * Math.cos(phi), z = Rb * Math.sin(phi), o = pis[i];
        o.p.position.set(q.xh + PL / 2, y, z); o.s.position.set(q.xh - .3, y, z); const len = Math.max(.05, BX - (q.xh + PL)); o.f.position.set(q.xh + PL + len / 2, y, z); o.f.scale.y = len;
        o.f.material = M[hpIf(Math.sin(q.t) > 0, fr.dir || 1)]; }); } };
  }

  /* ================= 8. Bent-axis piston ================= */
  const bent = (() => {
    const Z = 7, Rb = 4.2, AL = 25 * PI / 180, Lr = 7.5, O = [-6, 0], u = [Math.cos(AL), -Math.sin(AL)], nn = [Math.sin(AL), Math.cos(AL)];
    const W = (s, w) => [O[0] + s * u[0] + w * nn[0], O[1] + s * u[1] + w * nn[1]];
    const sOf = w => -w * Math.sin(AL) + Math.sqrt(w * w * Math.sin(AL) ** 2 - w * w * (2 - 2 * Math.cos(AL)) + Lr * Lr);
    const bp = (s0, s1, w0, w1) => [W(s0, w0), W(s1, w0), W(s1, w1), W(s0, w1)];
    return {
      id: 'bent-axis', family: 'Piston motors', name: 'Bent-axis piston motor', sym: { bi: true, drain: true },
      summary: 'The cylinder block is tilted at an angle to the output shaft. The pistons are joined to a drive flange on the shaft by ball-ended connecting rods.',
      steps: ['Pressure oil from the valve plate pushes the pistons on the pressure side out of the block.', 'The connecting rods push on the drive flange at an angle, and that turns the flange and shaft. The block turns with it.',
        'Stroke depends on the bend angle: a larger angle gives more displacement. Variable versions swing the block to change the angle.'],
      uses: 'High-torque, high-efficiency drives: winches, slew drives, mixer drums, excavator travel and swing, hydrostatic transmissions.',
      watch: 'The bend angle (often up to 40° or 45°) gives high starting torque and efficiency, but the unit is longer than a swashplate motor. Case drain needed.',
      calc: { geom: [['z', 'Number of pistons z', 'cnt', 7], ['d', 'Piston diameter d', 'len', 0.020], ['D', 'Pitch circle diameter (flange) D', 'len', 0.070], ['a', 'Bend angle α', 'deg', 25]],
        V: v => v.z * Math.PI * v.d ** 2 / 4 * v.D * Math.sin(v.a * PI / 180), Veq: 'V<sub>D</sub> = z·(π·d²/4)·D·sin α',
        Vsub: (v, H) => `${H.f(v.z, 0)} × (π × ${H.n(v.d, 'len')}² / 4) × ${H.n(v.D, 'len')} × sin ${H.f(v.a, 1)}°`, note: 'Stroke = D·sin α.' }, vis: 18,
      build() {
        const m = { vb: [-20, -16, 44, 32], depth: 0,
          parts: [{ id: 'shaft', cls: 'shaft', pts: rect(-19, -1.2, -7.6, 1.2) }, { id: 'flange', cls: 'rotor', pts: rect(-8, -7.5, -6, 7.5) },
            { id: 'block', cls: 'block', pts: bp(5, 15, -6.5, 6.5) }, { id: 'vp', cls: 'plate', pts: bp(15, 16.2, -6.5, 6.5) },
            { id: 'pA', cls: 'pipe-hp', pts: bp(16.2, 20, 2.2, 4.2) }, { id: 'pB', cls: 'pipe-lp', pts: bp(16.2, 20, -4.2, -2.2) }],
          labels: [{ text: 'Output shaft and drive flange', at: [-7, 6], tx: -12, ty: 12 }, { text: 'Connecting rods', at: [-2, 3], tx: -6, ty: -13 }, { text: 'Pistons', at: W(8, -2), tx: 4, ty: -13 },
            { text: 'Cylinder block (tilted 25°)', at: W(12, 6.5), tx: 6, ty: 12 }, { text: 'Valve plate', at: W(15.6, -6.5), tx: 16, ty: -13 }, { text: 'Port A', at: W(20, 3.2), tx: 21, ty: 4 }, { text: 'Port B', at: W(20, -3.2), tx: 21, ty: -9 }] };
        m.custom3D = (T, M, root) => bent3D(T, M, root);
        return m;
      },
      frame(th, dir) {
        const fwd = dir > 0, above = [], P = [];
        for (let i = 0; i < Z; i++) { const t = th + TAU * i / Z, w = Rb * Math.cos(t), z = Rb * Math.sin(t), s = sOf(w), s2 = sOf(Rb * Math.cos(t + .01)); P.push({ t, w, z, s, press: (s2 - s) * dir < 0 }); }
        P.slice().sort((a, b) => a.z - b.z).forEach(p => { const back = p.z < 0 ? 'back' : '';
          above.push({ pts: bp(p.s + 5, 15, p.w - .75, p.w + .75), f: p.press ? 'hp' : 'lp', extra: back });
          above.push({ pts: [[O[0], p.w], W(p.s, p.w)], cls: 'rodline', lines: true, extra: back });
          above.push({ pts: bp(p.s, p.s + 5, p.w - .75, p.w + .75), cls: 'piston', extra: back }); });
        return { xf: { pA: { cls: pipeCls(fwd) }, pB: { cls: pipeCls(!fwd) } }, above, bent: { th, P, dir },
          status: (fwd ? 'Pressure in port A. ' : 'Reversed: pressure in port B. ') + 'Pistons on the pressure side (red) are pushed out of the block. Their rods push on the drive flange at 25°, which turns the shaft and the block together.' };
      }
    };
    function bent3D(T, M, root) {
      const mk = (r, l, mat) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, l, 28), mat); m.rotation.z = -Math.PI / 2; return m; };
      const sh = mk(1.2, 12, M.shaft); sh.position.x = -13; root.add(sh);
      const fl = mk(7.5, 2, M.rotor); fl.position.x = -7; root.add(fl);
      const grp = new T.Group(); grp.position.set(O[0], O[1], 0); grp.rotation.z = -AL; root.add(grp);
      const spin = new T.Group(); grp.add(spin);
      const bm = mk(6.5, 10, M.block); bm.position.x = 10; spin.add(bm);
      const vp = mk(6.5, 1.2, M.plate); vp.position.x = 15.6; grp.add(vp);
      const pis = [], rods = [], fls = [];
      for (let i = 0; i < Z; i++) { const p = mk(.75, 5, M.piston); spin.add(p); pis.push(p); const f = mk(.72, 1, M.hp); spin.add(f); fls.push(f);
        const r = new T.Mesh(new T.CylinderGeometry(.3, .3, 1, 10), M.shaft); root.add(r); rods.push(r); }
      const up = new T.Vector3(0, 1, 0);
      return { update(fr) { const b = fr.bent; if (!b) return; spin.rotation.x = b.th; fl.rotation.x = b.th;
        b.P.forEach((q, i) => { const phi = TAU * i / Z, ly = Rb * Math.cos(phi), lz = Rb * Math.sin(phi);
          pis[i].position.set(q.s + 2.5, ly, lz); const len = Math.max(.05, 15 - (q.s + 5)); fls[i].position.set(q.s + 5 + len / 2, ly, lz); fls[i].scale.y = len; fls[i].material = q.press ? M.hp : M.lp;
          root.updateMatrixWorld(true);
          const A = new T.Vector3(O[0], Rb * Math.cos(q.t), Rb * Math.sin(q.t)), Bw = spin.localToWorld(new T.Vector3(q.s, ly, lz)), B = root.worldToLocal(Bw);
          const mid = A.clone().add(B).multiplyScalar(.5), dvec = B.clone().sub(A); rods[i].position.copy(mid); rods[i].scale.y = dvec.length(); rods[i].quaternion.setFromUnitVectors(up, dvec.normalize()); }); } };
    }
  })();

  /* ================= 9. Radial piston (eccentric) ================= */
  const radial = (() => {
    const Z = 5, E = 1.6, Re = 3.2, PLn = 4.5, ang = k => PI / 2 + TAU * k / Z;
    const U = [[5.6, -2.1], [12.8, -2.1], [12.8, 2.1], [5.6, 2.1], [5.6, 1.35], [12.0, 1.35], [12.0, -1.35], [5.6, -1.35]];
    const dist = (th, f) => E * Math.cos(th - f) + Math.sqrt(Re * Re - E * E * Math.sin(th - f) ** 2);
    return {
      id: 'radial-piston', family: 'Piston motors', name: 'Radial piston motor', sym: { bi: true, drain: true },
      summary: 'Pistons arranged like the spokes of a wheel push inward on an eccentric (crank) on the output shaft.',
      steps: ['A rotary valve on the shaft sends pressure oil to the cylinders whose pistons are on the “downhill” side of the eccentric.', 'Pressure pushes those pistons inward; pressing on the off-centre eccentric turns it.',
        'Pistons on the other side are pushed back out by the eccentric and return their oil to tank.', 'Large pistons and a short, strong crank give very high torque at low speed.'],
      uses: 'Low-speed, high-torque drives: winches, injection-moulding screw drives, deck machinery, crushers, wheel drives (multi-lobe cam versions).',
      watch: 'Here there is one eccentric, so each piston makes one stroke per revolution. Multi-lobe cam ring motors make several strokes per revolution for even more torque.',
      calc: { geom: [['z', 'Number of pistons z', 'cnt', 5], ['d', 'Piston diameter d', 'len', 0.040], ['e', 'Eccentricity e', 'len', 0.015]],
        V: v => v.z * Math.PI * v.d ** 2 / 4 * 2 * v.e, Veq: 'V<sub>D</sub> = z·(π·d²/4)·2e', Vsub: (v, H) => `${H.f(v.z, 0)} × (π × ${H.n(v.d, 'len')}² / 4) × 2 × ${H.n(v.e, 'len')}`, note: 'Stroke = 2e (twice the eccentricity).' }, vis: 10,
      build() {
        const parts = [];
        for (let k = 0; k < Z; k++) parts.push({ id: 'c' + k, cls: 'housing', pts: rot(U, ang(k)) });
        parts.push({ id: 'ecc', cls: 'rotor', pts: circ(E, 0, Re, 64), holes: [circ(0, 0, 1.2, 20)], z: [.3, 7.7] }, { id: 'sh', cls: 'shaft', pts: circ(0, 0, 1.2, 20), z: [-2, 11] }, { id: 'key', cls: 'key', pts: rect(-.25, .7, .25, 1.3), z: [-2, 11] });
        for (let k = 0; k < Z; k++) parts.push({ id: 'p' + k, cls: 'piston', pts: rect(0, -1.3, PLn, 1.3), z: [1, 7] });
        return { vb: [-20, -17, 40, 34], depth: 8, parts,
          labels: [{ text: 'Eccentric (crank) on the shaft', at: [0, -2.5], tx: -12, ty: -15.5 }, { text: 'Piston', at: [0, 8], tx: 9, ty: 15.5 },
            { text: 'Cylinder', at: [-2.1, 12], tx: -9, ty: 15.5 }, { text: 'Pressure pushes pistons inward', at: [10.5, -8], tx: 12, ty: -15.5 }] };
      },
      frame(th, dir) {
        const fwd = dir > 0, xf = { ecc: { r: th }, sh: { r: th }, key: { r: th } }, fluids = [];
        for (let k = 0; k < Z; k++) { const f = ang(k), dd = dist(th, f); xf['p' + k] = { x: dd * Math.cos(f), y: dd * Math.sin(f), r: f };
          fluids.push({ pts: rot(rect(dd + PLn, -1.35, 12.0, 1.35), f), f: hpIf(Math.sin(th - f) > 0, dir) }); }
        return { xf, fluids, status: (fwd ? 'Forward: ' : 'Reversed: ') + 'cylinders shown red are connected to pressure and push their pistons inward against the eccentric, turning the shaft. Blue cylinders are being emptied as the eccentric pushes their pistons back out.' };
      }
    };
  })();

  const list = [extGear, intGear, gerotor, geroller, uVane, bVane, axialType(false), axialType(true), bent, radial];
  list.forEach(t => { t.calc.inputs = (t.calc.geom || []).concat(GEN); });
  return { list, symbol, generalRows };
})();
