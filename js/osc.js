/* Oscillators (rotary actuators): types for the planar engine, plus application scenes */
window.OSC = (function () {
  const { circ, arc, rect, rot, move, teeth } = HM; const PI = Math.PI, TAU = 2 * PI;
  const pipe = (on) => on ? 'pipe-hp' : 'pipe-lp';
  /* swing helper: u in [0,1] -> angle between a0 and a1 */
  const sw = (u, a0, a1) => a0 + (a1 - a0) * u;
  function vaneType(n) {
    const R = 9, Rr = 3.6, Ro = 12, half = (n === 1 ? 14 : 13) * PI / 180, swing = n === 1 ? 270 : 90;
    const stops = Array.from({ length: n }, (_, k) => -PI / 2 + k * TAU / n);
    const sector = (r0, r1, a0, a1, m = 24) => [...arc(0, 0, r1, a0, a1, m), ...arc(0, 0, r0, a1, a0, m)];
    return {
      id: n === 1 ? 'single-vane' : 'double-vane', name: n === 1 ? 'Single-vane rotary actuator' : 'Double-vane rotary actuator',
      summary: n === 1 ? 'One vane on the output shaft swings between a fixed stop. Up to about 280° of swing.' : 'Two vanes and two stops, 180° apart. Twice the torque of a single vane of the same size, but only about 100° of swing.',
      steps: ['Oil enters port A and pushes on the vane, turning the shaft until the vane reaches the stop.', 'Switching the valve sends oil to port B and the shaft swings back.', n === 2 ? 'The two pressure chambers are opposite each other (linked through the shaft), so the side loads on the bearings cancel.' : 'All the pressure is on one side, so the bearings carry a side load.'],
      uses: 'Clamping, valve operation, flipping and turning parts, steering, loader buckets, and gate opening.',
      watch: 'Internal leakage past the vane seals means the actuator can creep under load; use a lock or holding valve when the position must be held.',
      calc: { inputs: [['n', 'Number of vanes n', 'cnt', n], ['p', 'Pressure difference p', 'p', 1e7], ['L', 'Vane length L', 'len', 0.1], ['Rv', 'Vane tip radius R<sub>v</sub>', 'len', 0.06], ['Rr', 'Hub radius R<sub>r</sub>', 'len', 0.025]],
        rows: (v, H) => { const T = v.n * v.p * v.L / 2 * (v.Rv ** 2 - v.Rr ** 2); return [
          { label: 'Vane area', eq: 'A = (R<sub>v</sub> − R<sub>r</sub>)·L', sub: `(${H.n(v.Rv, 'len')} − ${H.n(v.Rr, 'len')}) × ${H.n(v.L, 'len')}`, res: H.r((v.Rv - v.Rr) * v.L, 'area') },
          { label: 'Force on each vane', eq: 'F = p·A', sub: `${H.n(v.p, 'p')} × ${H.n((v.Rv - v.Rr) * v.L, 'area')}`, res: H.r(v.p * (v.Rv - v.Rr) * v.L, 'F') },
          { label: 'Torque', eq: 'T = n·(p·L/2)·(R<sub>v</sub>² − R<sub>r</sub>²)', sub: `${H.f(v.n, 0)} × ${H.n(v.p, 'p')} × ${H.n(v.L, 'len')} / 2 × (${H.n(v.Rv, 'len')}² − ${H.n(v.Rr, 'len')}²)`, res: H.r(T, 'T') }]; } },
      build() {
        const parts = [{ id: 'hous', cls: 'housing', pts: circ(0, 0, Ro, 96), holes: [circ(0, 0, R, 96)] }];
        stops.forEach((a, k) => parts.push({ id: 'stop' + k, cls: 'crescent', pts: sector(Rr + .05, R, a - half, a + half), z: [.2, 7.8] }));
        parts.push({ id: 'hub', cls: 'rotor', pts: circ(0, 0, Rr, 48), holes: [circ(0, 0, 1.6, 24)], z: [.2, 7.8] }, { id: 'sh', cls: 'shaft', pts: circ(0, 0, 1.6, 24), z: [-2, 11] }, { id: 'key', cls: 'key', pts: rect(-.3, 1, .3, 1.8), z: [-2, 11] });
        for (let k = 0; k < n; k++) parts.push({ id: 'v' + k, cls: 'vane', pts: rect(Rr - .2, -.55, R - .05, .55), z: [.2, 7.8] });
        parts.push({ id: 'pA', cls: 'pipe-hp', pts: rot(rect(R, -.9, Ro + 3, .9), -PI / 2 + half + .22), z: [2, 6] }, { id: 'pB', cls: 'pipe-lp', pts: rot(rect(R, -.9, Ro + 3, .9), -PI / 2 - half - .22), z: [2, 6] });
        return { vb: [-19, -17, 38, 32], depth: 8, backPlate: circ(0, 0, Ro, 72), parts,
          labels: [{ text: 'Vane on the output shaft', at: [0, 7], tx: -9, ty: 13.5 }, { text: n === 1 ? 'Stop' : 'Stops', at: [0, -8], tx: 0, ty: -16 }, { text: 'Port A', at: [4.5, -14], tx: 10, ty: -16 }, { text: 'Port B', at: [-4.5, -14], tx: -10, ty: -16 }, { text: 'Housing', at: [10, 6], tx: 13, ty: 13.5 }] };
      },
      frame(u, dir) {
        const lo = -PI / 2 + half + .12, span = TAU / n - 2 * half - .24, a = lo + span * u, xf = { hub: { r: a }, sh: { r: a }, key: { r: a }, pA: { cls: pipe(dir > 0) }, pB: { cls: pipe(dir < 0) } }, fluids = [];
        for (let k = 0; k < n; k++) { const off = k * TAU / n; xf['v' + k] = { r: a + off };
          fluids.push({ pts: sector(Rr + .05, R - .05, -PI / 2 + half + off, a + off - .06), f: dir > 0 ? 'hp' : 'lp' }, { pts: sector(Rr + .05, R - .05, a + off + .06, -PI / 2 - half + off + TAU / n), f: dir > 0 ? 'lp' : 'hp' }); }
        return { xf, fluids, angle: (a - lo) * 180 / PI, status: `${dir > 0 ? 'Oil into port A swings the vane anticlockwise' : 'Oil into port B swings the vane back'}. Swing so far: ${HM.fmt((a - lo) * 180 / PI, 0)}° of about ${HM.fmt(span * 180 / PI, 0)}°.` };
      }
    };
  }
  const rackPinion = (() => {
    const rp = 4.1, Nt = 14, pitch = TAU * rp / Nt, travel = rp * PI / 2;
    const X0 = .5 * pitch + Math.ceil((14 - .5 * pitch) / pitch) * pitch; // a tooth centre sits at x = 0
    const rackPts = (() => { const pts = [[-X0, -7], [X0, -7]]; const top = []; for (let x = X0; x > -X0 + 1e-6; x -= pitch) top.push([x, -5.0], [x - pitch * .25, -5.0], [x - pitch * .38, -3.25], [x - pitch * .62, -3.25], [x - pitch * .75, -5.0]); return pts.concat(top); })();
    const U = [[-22.5, -8.6], [-7, -8.6], [-7, -7.6], [-21.5, -7.6], [-21.5, -2.4], [-7, -2.4], [-7, -1.4], [-22.5, -1.4]];
    return {
      id: 'rack-pinion', name: 'Rack-and-pinion actuator',
      summary: 'Two pistons are joined by a toothed rack. The rack turns a pinion gear on the output shaft.',
      steps: ['Oil into the left cylinder pushes the piston and rack to the right, turning the pinion.', 'Oil into the right cylinder drives it back.', 'Swing angle is set by the rack travel: θ = stroke / pinion radius, so any angle (even more than 360°) can be built.'],
      uses: 'Valve actuators, indexing tables, steering, and turning or tipping parts where a precise swing angle is needed.',
      watch: 'Backlash between rack and pinion teeth gives a little free play at the ends of the swing.',
      calc: { inputs: [['D', 'Piston diameter D', 'len', 0.063], ['r', 'Pinion pitch radius r', 'len', 0.03], ['p', 'Pressure p', 'p', 1e7], ['s', 'Rack stroke s', 'len', 0.0942]],
        rows: (v, H) => { const A = PI * v.D ** 2 / 4, F = v.p * A; return [
          { label: 'Piston area', eq: 'A = π·D² / 4', sub: `π × ${H.n(v.D, 'len')}² / 4`, res: H.r(A, 'area') },
          { label: 'Force on the rack', eq: 'F = p·A', sub: `${H.n(v.p, 'p')} × ${H.n(A, 'area')}`, res: H.r(F, 'F') },
          { label: 'Torque', eq: 'T = F·r', sub: `${H.n(F, 'F')} × ${H.n(v.r, 'len')}`, res: H.r(F * v.r, 'T') },
          { label: 'Swing angle', eq: 'θ = s / r', sub: `${H.n(v.s, 'len')} / ${H.n(v.r, 'len')} rad`, res: `<b>${H.f(v.s / v.r * 180 / PI, 1)}°</b>` }]; } },
      build() {
        return { vb: [-25, -11, 50, 22], depth: 8,
          parts: [{ id: 'cl', cls: 'housing', pts: U }, { id: 'cr', cls: 'housing', pts: U.map(([x, y]) => [-x, y]) },
            { id: 'rack', cls: 'rack', pts: rackPts, z: [2, 6] }, { id: 'pl', cls: 'piston', pts: rect(-X0 - .6, -7.55, -X0, -2.45), z: [1, 7] }, { id: 'pr', cls: 'piston', pts: rect(X0, -7.55, X0 + .6, -2.45), z: [1, 7] },
            { id: 'pin', cls: 'gearA', pts: teeth(Nt, 3.25, 4.95), holes: [circ(0, 0, 1.4, 24)], z: [1.5, 6.5] }, { id: 'sh', cls: 'shaft', pts: circ(0, 0, 1.4, 24), z: [-2, 11] }, { id: 'key', cls: 'key', pts: rect(-.3, .8, .3, 1.6), z: [-2, 11] },
            { id: 'arm', cls: 'arm', pts: [...rect(0, -.6, 8, .6)], z: [10, 11] },
            { id: 'pA', cls: 'pipe-hp', pts: rect(-22.5, -1.4, -21, 2.5), z: [2, 6] }, { id: 'pB', cls: 'pipe-lp', pts: rect(21, -1.4, 22.5, 2.5), z: [2, 6] }],
          labels: [{ text: 'Pinion (output shaft)', at: [0, 4.9], tx: -6, ty: 9.5 }, { text: 'Rack', at: [0, -7], tx: 0, ty: -10 }, { text: 'Pistons', at: [-14.3, -2.5], tx: -14, ty: 6.5 },
            { text: 'Arm', at: [6, .5], tx: 9, ty: 9.5 }, { text: 'Port A', at: [-21.7, 2.5], tx: -22, ty: 9.5 }, { text: 'Port B', at: [21.7, 2.5], tx: 22, ty: 9.5 }] };
      },
      frame(u, dir) {
        const th = (u - .5) * PI, x = rp * th, fluids = [{ pts: rect(-21.5, -7.6, -X0 - .6 + x, -2.4), f: dir > 0 ? 'hp' : 'lp' }, { pts: rect(X0 + .6 + x, -7.6, 21.5, -2.4), f: dir > 0 ? 'lp' : 'hp' }];
        return { xf: { rack: { x }, pl: { x }, pr: { x }, pin: { r: th }, sh: { r: th }, key: { r: th }, arm: { r: th + PI / 2 }, pA: { cls: pipe(dir > 0) }, pB: { cls: pipe(dir < 0) } }, fluids, angle: u * 180,
          status: `${dir > 0 ? 'Oil into port A pushes the rack right' : 'Oil into port B pushes the rack left'}; the pinion turns ${HM.fmt(u * 180, 0)}° of 180°.` };
      }
    };
  })();
  const helical = (() => {
    const travel = 14;
    return {
      id: 'helical', name: 'Helical (piston-and-helix) actuator',
      summary: 'A piston slides along the barrel. Helical splines on the piston and the shaft turn the straight movement into rotation.',
      steps: ['Oil pushes the annular piston along the barrel.', 'Straight splines stop the piston turning in the barrel; helical splines between piston and shaft force the shaft to rotate as the piston moves.', 'Several helical spline teeth share the load, so the torque is high for its diameter.'],
      uses: 'Mobile equipment: boom and bucket rotation, truck-mounted cranes and lifts, mining and forestry attachments.',
      watch: 'High torque in a slim package, with almost no internal leakage across the piston seals, so it holds position well.',
      calc: { inputs: [['D', 'Barrel bore D', 'len', 0.1], ['d', 'Shaft diameter d', 'len', 0.05], ['s', 'Piston stroke s', 'len', 0.1], ['th', 'Swing angle θ', 'deg', 180], ['p', 'Pressure p', 'p', 2e7]],
        rows: (v, H) => { const A = PI * (v.D ** 2 - v.d ** 2) / 4, V = A * v.s, th = v.th * PI / 180, T = v.p * V / th; return [
          { label: 'Annular piston area', eq: 'A = π·(D² − d²) / 4', sub: `π × (${H.n(v.D, 'len')}² − ${H.n(v.d, 'len')}²) / 4`, res: H.r(A, 'area') },
          { label: 'Oil volume per stroke', eq: 'V = A·s', sub: `${H.n(A, 'area')} × ${H.n(v.s, 'len')}`, res: `${H.sg(V * (H.units === 'us' ? 61023.7 : 1))} ${H.units === 'us' ? 'in³' : 'm³'} = <b>${H.f(V * (H.units === 'us' ? 61023.7 : 1e6), 1)} ${H.units === 'us' ? 'in³' : 'cm³'}</b>` },
          { label: 'Torque (energy balance)', eq: 'T = p·V / θ', sub: `${H.n(v.p, 'p')} × ${H.sg(V * (H.units === 'us' ? 61023.7 : 1))} / ${H.f(th, 3)} rad`, res: H.r(T, 'T') }]; } },
      build() {
        return { vb: [-24, -11, 48, 22], depth: 0,
          parts: [{ id: 'barrel', cls: 'housing', pts: rect(-18, -7, 14, 7), holes: [rect(-16.5, -5.6, 12.5, 5.6)] }, { id: 'cap', cls: 'housing', pts: rect(-20, -7, -18, 7) },
            { id: 'shaft', cls: 'shaft', pts: rect(-16.5, -2.2, 20, 2.2) }, { id: 'piston', cls: 'piston', pts: [...rect(-4, -5.55, 2, -2.25)], z: [0, 1] }, { id: 'piston2', cls: 'piston', pts: rect(-4, 2.25, 2, 5.55) },
            { id: 'pA', cls: 'pipe-hp', pts: rect(-15.5, 7, -13.5, 10) }, { id: 'pB', cls: 'pipe-lp', pts: rect(9.5, 7, 11.5, 10) }],
          overlays: [{ tag: 'circle', attr: { cx: 20.5, cy: 0, r: 3.2, class: 'p-ring' } }],
          labels: [{ text: 'Piston with helical splines', at: [-1, 5.5], tx: -4, ty: 9.6 }, { text: 'Output shaft (helical splines)', at: [8, -2.2], tx: 4, ty: -9.8 }, { text: 'Barrel', at: [-12, -7], tx: -13, ty: -9.8 },
            { text: 'Port A', at: [-14.5, 10], tx: -18, ty: 9.6 }, { text: 'Port B', at: [10.5, 10], tx: 15, ty: 9.6 }, { text: 'Shaft end view', at: [20.5, 3.2], tx: 20, ty: 6.5 }] };
      },
      frame(u, dir) {
        const x = -8 + travel * u, th = u * PI, above = [];
        for (let k = -6; k < 8; k++) { const x0 = -16 + k * 2.2 + (th / PI) * 2.2 * 2; if (x0 < -16 || x0 > 19) continue; above.push({ pts: [[x0, -2.2], [x0 + 1.6, 2.2]], cls: 'rodline', lines: true }); }
        above.push({ pts: rot(rect(0, -.5, 3.0, .5), th, 0, 0).map(([a, b]) => [a + 20.5, b]), cls: 'vane' });
        const fl = [{ pts: rect(-16.5, -5.6, x - 4 + 0, -2.2), f: dir > 0 ? 'hp' : 'lp' }, { pts: rect(-16.5, 2.2, x - 4, 5.6), f: dir > 0 ? 'hp' : 'lp' }, { pts: rect(x + 2, -5.6, 12.5, -2.2), f: dir > 0 ? 'lp' : 'hp' }, { pts: rect(x + 2, 2.2, 12.5, 5.6), f: dir > 0 ? 'lp' : 'hp' }];
        return { xf: { piston: { x }, piston2: { x }, pA: { cls: pipe(dir > 0) }, pB: { cls: pipe(dir < 0) } }, fluids: fl, above, angle: u * 180, helix: { x, th, dir },
          status: `The piston has moved ${HM.fmt(u * 100, 0)} % of its stroke, and the helix has turned the shaft ${HM.fmt(u * 180, 0)}°.` };
      }
    };
  })();
  // helical 3D: barrel, piston and a shaft with a helical ridge
  helical.custom3D = (T, M, root) => { const cy = (r, l, mat, open, tl) => { const m = new T.Mesh(new T.CylinderGeometry(r, r, l, 40, 1, !!open, 0, tl || TAU), mat); m.rotation.z = -PI / 2; return m; };
    const bar = cy(7, 32, M.housing, true, PI * 1.5); bar.position.x = -2; bar.rotation.x = PI * .25; root.add(bar);
    const sh = new T.Group(); root.add(sh); const core = cy(2.2, 36.5, M.shaft); core.position.x = 1.75; sh.add(core);
    const pts = []; for (let i = 0; i <= 400; i++) { const t = i / 400, x = -16 + 35 * t, a = t * 35 / 2.2 * PI / 2.5; pts.push(new T.Vector3(x, 2.25 * Math.cos(a), 2.25 * Math.sin(a))); }
    sh.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 400, .25, 6, false), M.vane));
    const pis = new T.Mesh(new T.CylinderGeometry(5.55, 5.55, 6, 40, 1, false, 0, PI * 1.5), M.piston); pis.rotation.z = -PI / 2; root.add(pis);
    const fA = cy(5.5, 1, M.hp), fB = cy(5.5, 1, M.lp); root.add(fA, fB);
    return { update(fr) { const h = fr.helix; if (!h) return; sh.rotation.x = h.th; pis.position.x = h.x - 1; pis.rotation.x = PI * .25;
      const la = Math.max(.05, h.x - 4 + 16.5), lb = Math.max(.05, 12.5 - (h.x + 2)); fA.position.x = -16.5 + la / 2; fA.scale.y = la; fB.position.x = h.x + 2 + lb / 2; fB.scale.y = lb;
      fA.material = h.dir > 0 ? M.hp : M.lp; fB.material = h.dir > 0 ? M.lp : M.hp; } }; };
  const hb = helical.build; helical.build = () => { const m = hb(); m.custom3D = helical.custom3D; return m; };

  /* ---------- application scenes (SVG, 0..1 loop) ---------- */
  const body = '<rect x="-3.5" y="-3" width="7" height="6" rx=".6" class="p-rotor"/><rect x="-6.5" y="-2" width="3" height="4" class="p-housing"/><rect x="3.5" y="-2" width="3" height="4" class="p-housing"/><circle r="1.2" class="p-shaft"/>';
  const armAt = (deg, len, extra = '') => `<g transform="rotate(${deg})"><rect x="0" y="-.7" width="${len}" height="1.4" rx=".7" class="p-arm"/>${extra}</g>`;
  const ease = u => .5 - .5 * Math.cos(PI * u), tri = u => u < .5 ? ease(u * 2) : ease(2 - u * 2);
  const SCENES = [
    { id: 'clamp', name: 'Clamping', text: 'The actuator swings a clamp arm down onto the part and holds it with steady oil pressure.',
      draw: u => { const a = 90 - 90 * Math.min(1, tri(u) * 1.15); return `<rect x="6" y="-6.5" width="12" height="2.5" class="p-housing"/><rect x="9" y="-4" width="6" height="1.6" class="p-block"/>${body}${armAt(a, 12.5, '<rect x="11.2" y="-2.4" width="0.6" height="1.7" class="p-shaft"/><rect x="10.5" y="-3" width="2" height=".6" class="p-shaft"/>')}`; },
      angle: u => 90 * Math.min(1, tri(u) * 1.15) },
    { id: 'gate', name: 'Opening and closing', text: 'A gate under a hopper is swung open to release material, then closed again.',
      draw: u => { const a = -60 * tri(u), open = tri(u) > .3; let g = '';
        if (open) for (let i = 0; i < 18; i++) { const t = (u * 7 + i / 18) % 1; g += `<circle cx="${12 + Math.sin(i * 7) * 1.2}" cy="${-1 - t * 9}" r=".35" fill="#C9A13E"/>`; }
        return `<path d="M6,14 L18,14 L14,2 L10,2 Z" fill="#E6C47A" stroke="#6B4E22" stroke-width=".2"/>${g}${body}${armAt(a, 15)}`; }, angle: u => 60 * tri(u) },
    { id: 'transfer', name: 'Transferring', text: 'An arm with a pocket picks a part from one conveyor and swings it 180° onto another.',
      draw: u => { const a = 180 - 180 * tri(u), carry = u < .5; const ball = carry ? `<circle cx="10.5" cy="1.3" r="1" class="fl-hp" style="opacity:1"/>` : '';
        return `<line x1="-26" y1="-1" x2="-12" y2="-.2" class="p-rodline"/><line x1="12" y1="-.2" x2="26" y2="-1" class="p-rodline"/>${[0, 1, 2, 3].map(i => `<circle cx="${-24 + i * 2.2}" cy="${.1 - i * .05}" r="1" style="fill:var(--hp)"/>`).join('')}${!carry ? `<circle cx="${14 + (u - .5) * 18}" cy=".2" r="1" style="fill:var(--hp)"/>` : ''}${body}${armAt(a, 12, ball)}`; }, angle: u => 180 * tri(u) },
    { id: 'unload', name: 'Unloading', text: 'A bucket or hopper is tipped to dump its contents, then returned.',
      draw: u => { const a = 130 * tri(u); let g = ''; if (tri(u) > .55) for (let i = 0; i < 16; i++) { const t = (u * 6 + i / 16) % 1; g += `<circle cx="${-6 - t * 4 + Math.sin(i) }" cy="${-3 - t * 9}" r=".45" style="fill:var(--stat)"/>`; }
        return `${g}${body}<g transform="rotate(${a})"><path d="M-7,1.5 L7,1.5 L9,9 L-9,9 Z" style="fill:var(--steel-light);stroke:var(--steel-dark);stroke-width:.25"/>${a < 70 ? [0, 1, 2, 3, 4, 5].map(i => `<circle cx="${-5 + i * 2}" cy="7.5" r=".9" style="fill:var(--stat)"/>`).join('') : ''}</g>`; }, angle: u => 130 * tri(u) },
    { id: 'turn', name: 'Turning (indexing)', text: 'The output turns a table or part through a full circle in steps, for drilling or assembly.',
      draw: u => { const a = 360 * u; return `<circle r="13" style="fill:none;stroke:var(--lp);stroke-width:.35" stroke-dasharray="1 .6"/>${body}${armAt(90 - a, 11, '<circle cx="11" r="1.3" style="fill:var(--accent)"/>')}`; }, angle: u => 360 * u }
  ];
  return { list: [vaneType(1), vaneType(2), rackPinion, helical], SCENES };
})();
