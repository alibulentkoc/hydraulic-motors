/* Real-world application examples. Values in SI. Each compute() returns rows. */
window.APPS = (function () {
  const TAU = 2 * Math.PI;
  const motorRows = (H, V, Q, dp, ev, em) => { const N = Q * ev / V, T = dp * V * em / TAU, P = T * TAU * N; return { N, T, P, rows: [
    { label: 'Motor speed', eq: 'N = Q·η<sub>v</sub> / V<sub>D</sub>', sub: `${H.n(Q, 'Q')} × ${H.f(ev, 2)} / ${H.n(V, 'vol')}`, res: H.r(N, 'n') },
    { label: 'Motor torque', eq: 'T = Δp·V<sub>D</sub>·η<sub>m</sub> / 2π', sub: `${H.n(dp, 'p')} × ${H.n(V, 'vol')} × ${H.f(em, 2)} / 2π`, res: H.r(T, 'T') },
    { label: 'Shaft power', eq: 'P = T·2πN', sub: `${H.n(T, 'T')} × 2π × ${H.f(N, 3)}`, res: H.r(P, 'P') }] }; };
  const sizeRows = (H, T, Nrpm, dp, ev, em) => { const V = TAU * T / (dp * em), Q = V * (Nrpm / 60) / ev, P = T * TAU * Nrpm / 60; return { V, Q, P, rows: [
    { label: 'Shaft power needed', eq: 'P = T·2πN', sub: `${H.n(T, 'T')} × 2π × ${H.f(Nrpm / 60, 3)}`, res: H.r(P, 'P') },
    { label: 'Motor displacement', eq: 'V<sub>D</sub> = 2π·T / (Δp·η<sub>m</sub>)', sub: `2π × ${H.n(T, 'T')} / (${H.n(dp, 'p')} × ${H.f(em, 2)})`, res: H.r(V, 'vol') },
    { label: 'Flow needed', eq: 'Q = V<sub>D</sub>·N / η<sub>v</sub>', sub: `${H.n(V, 'vol')} × ${H.f(Nrpm / 60, 3)} / ${H.f(ev, 2)}`, res: H.r(Q, 'Q') },
    { label: 'Hydraulic power supplied', eq: 'P<sub>hyd</sub> = Q·Δp', sub: `${H.n(Q, 'Q')} × ${H.n(dp, 'p')}`, res: H.r(Q * dp, 'P') }] }; };
  const gpm = 3.785411784e-3 / 60, psi = 6894.757, in3 = 1.6387064e-5, lbft = 1.355818;
  return [
    { id: 'vac-fan', sector: 'ag', kind: 'real', title: 'Planter vacuum fan', motor: 'Small gear motor with case drain',
      intro: 'On a vacuum planter, a hydraulic motor spins a blower that holds seeds on the meter disks. John Deere states that its newer blowers use a 3.5 cm³ case-drain motor (up from 2.2 cm³) and that the system flows up to 5 gpm (18.9 L/min) per motor at full flow.',
      src: [['John Deere DR8 planter page', 'https://www.deere.ca/en/planting-equipment/dr8-twin-row-planter']],
      inputs: [['V', 'Motor displacement', 'vol', 3.5e-6], ['Q', 'Flow to the motor', 'Q', 5 * gpm], ['dp', 'Pressure drop (assumed)', 'p', 1.4e7], ['ev', 'Volumetric efficiency (assumed)', 'eff', .9], ['em', 'Mechanical efficiency (assumed)', 'eff', .85]],
      compute(v, H) { const m = motorRows(H, v.V, v.Q, v.dp, v.ev, v.em); return { rows: m.rows, teach: `A tiny displacement turns a modest flow into a very high speed (about ${H.f(m.N * 60, 0)} rpm here) but little torque. Fans need speed, not torque, so a small gear motor suits them. The case drain line carries leakage back to the tank, so the motor seal is not pressurised.` }; } },
    { id: 'air-fan', sector: 'ag', kind: 'real', title: 'Air cart and fertiliser fan', motor: 'Gear motor, 12 cm³',
      intro: 'Salford lists a 20 in fan on its Ferti-Go fertiliser cart, driven by a 12 cm³ hydraulic motor at up to 5,900 rpm, with a hydraulic requirement of 30 gpm at 2,800 psi for a single fan.',
      src: [['Salford Ferti-Go specifications', 'https://salfordgroup.squarespace.com/ferti-go']],
      inputs: [['V', 'Motor displacement', 'vol', 12e-6], ['N', 'Fan speed', 'rpm', 5900], ['ev', 'Volumetric efficiency (assumed)', 'eff', .92], ['Qs', 'Flow the maker asks for', 'Q', 30 * gpm], ['ps', 'Pressure the maker asks for', 'p', 2800 * psi]],
      compute(v, H) { const Qth = v.V * v.N / 60, Q = Qth / v.ev, T = v.ps * v.V / TAU, P = T * TAU * v.N / 60;
        return { rows: [
          { label: 'Flow the motor itself swallows at full speed', eq: 'Q = V<sub>D</sub>·N / η<sub>v</sub>', sub: `${H.n(v.V, 'vol')} × ${H.f(v.N / 60, 2)} / ${H.f(v.ev, 2)}`, res: H.r(Q, 'Q') },
          { label: 'Hydraulic power the tractor must be able to supply', eq: 'P = Q·Δp', sub: `${H.n(v.Qs, 'Q')} × ${H.n(v.ps, 'p')}`, res: H.r(v.Qs * v.ps, 'P') },
          { label: 'Largest torque at that pressure (ideal)', eq: 'T = Δp·V<sub>D</sub> / 2π', sub: `${H.n(v.ps, 'p')} × ${H.n(v.V, 'vol')} / 2π`, res: H.r(T, 'T') },
          { label: 'Largest shaft power at full speed (ideal)', eq: 'P = T·2πN', sub: `${H.n(T, 'T')} × 2π × ${H.f(v.N / 60, 2)}`, res: H.r(P, 'P') }],
          teach: `The motor itself needs only about ${H.e(Q, 'Q')} to reach ${H.f(v.N, 0)} rpm, yet the maker asks for ${H.e(v.Qs, 'Q')}. The extra is a margin for the speed-control valve and other functions, and to keep the fan at speed as the tractor’s pump flow varies. Fan torque rises with the square of speed, so the pressure actually used depends on the fan load.` }; } },
    { id: 'seed-auger', sector: 'ag', kind: 'real', title: 'Seed tender or gravity-box auger', motor: 'Orbital (geroller) motor, 6 in³',
      intro: 'Unverferth seed and gravity-box augers use a top-mounted 6 in³ hydraulic motor. One model is quoted at 9 gpm and 1,800 psi for peak efficiency; another at 6 to 12 gpm and 1,200 psi, with unloading rates quoted at a 500 rpm auger speed.',
      src: [['Unverferth augers and conveyors brochure', 'https://media.unverferth.com/unverferth/bulk-handling/um-augers-&-conveyors-feb.-2018.pdf'], ['Unverferth augers page', 'https://umequip.com/bulk-handling/augers/']],
      inputs: [['V', 'Motor displacement', 'vol', 6 * in3], ['Q', 'Flow', 'Q', 9 * gpm], ['dp', 'Pressure', 'p', 1800 * psi], ['ev', 'Volumetric efficiency', 'eff', 1], ['em', 'Mechanical efficiency', 'eff', 1], ['Nt', 'Target auger speed', 'rpm', 500]],
      compute(v, H) { const m = motorRows(H, v.V, v.Q, v.dp, v.ev, v.em), Qn = v.V * v.Nt / 60 / v.ev;
        return { rows: m.rows.concat([{ label: 'Flow needed for the target speed', eq: 'Q = V<sub>D</sub>·N / η<sub>v</sub>', sub: `${H.n(v.V, 'vol')} × ${H.f(v.Nt / 60, 3)} / ${H.f(v.ev, 2)}`, res: H.r(Qn, 'Q') },
          { label: 'Hydraulic power', eq: 'P = Q·Δp', sub: `${H.n(v.Q, 'Q')} × ${H.n(v.dp, 'p')}`, res: H.r(v.Q * v.dp, 'P') }]),
          teach: `With efficiencies set to 1 (ideal), the classic US shortcut applies: N = 231·Q / V = 231 × 9 / 6 ≈ 347 rpm. To reach the 500 rpm used for the quoted unloading rates, the motor needs about 13 gpm, which is within the 6 to 12 gpm range only at the top end. A good class question: what happens to unloading rate when the tractor supplies only 6 gpm?` }; } },
    { id: 'grain-cart', sector: 'ag', kind: 'real', title: 'Grain cart unloading auger (hydraulic drive)', motor: 'High-flow hydraulic drive motor',
      intro: 'Unverferth offers a hydraulic drive for its X-TREME grain carts as an alternative to the PTO: up to 325 bushels per minute with 100 gpm of flow, or up to 250 bushels per minute with 50 gpm, depending on the cart model.',
      src: [['Unverferth X-TREME grain cart brochure', 'https://media.unverferth.com/unverferth/grain-handling/um-grain-carts-x-treme-19-series-aug.-2023.pdf']],
      inputs: [['Q1', 'Flow, option 1', 'Q', 100 * gpm], ['R1', 'Unload rate, option 1 (bu/min)', 'cnt', 325], ['Q2', 'Flow, option 2', 'Q', 50 * gpm], ['R2', 'Unload rate, option 2 (bu/min)', 'cnt', 250], ['dp', 'Working pressure (assumed)', 'p', 1.7e7]],
      compute(v, H) { return { rows: [
        { label: 'Hydraulic power, option 1', eq: 'P = Q·Δp', sub: `${H.n(v.Q1, 'Q')} × ${H.n(v.dp, 'p')}`, res: H.r(v.Q1 * v.dp, 'P') },
        { label: 'Hydraulic power, option 2', eq: 'P = Q·Δp', sub: `${H.n(v.Q2, 'Q')} × ${H.n(v.dp, 'p')}`, res: H.r(v.Q2 * v.dp, 'P') },
        { label: 'Grain moved per unit of flow', eq: 'rate / Q', sub: `${H.f(v.R1, 0)} vs ${H.f(v.R2, 0)} bu/min`, res: `<b>${H.f(v.R1 / (v.Q1 * 60000), 2)} and ${H.f(v.R2 / (v.Q2 * 60000), 2)} bu per litre of oil</b>` }],
        teach: 'Doubling the flow doubles the auger speed, but the unloading rate rises only by about 30 %: at higher speed the auger fills less completely and more grain falls back. Speed does not scale delivery one-for-one in bulk handling.' }; } },
    { id: 'reel', sector: 'ag', kind: 'assume', title: 'Combine header reel drive', motor: 'Geroller (orbital) motor, direct drive',
      intro: 'Header reels are commonly driven by a low-speed, high-torque orbital motor so the operator can match reel speed to ground speed. This is a design exercise with assumed but realistic numbers.',
      inputs: [['T', 'Reel torque (assumed)', 'T', 400], ['N', 'Reel speed', 'rpm', 50], ['D', 'Reel diameter', 'len', 1.07], ['dp', 'Pressure drop', 'p', 1.4e7], ['ev', 'Volumetric efficiency', 'eff', .92], ['em', 'Mechanical efficiency', 'eff', .9], ['vg', 'Ground speed (km/h)', 'cnt', 8]],
      compute(v, H) { const s = sizeRows(H, v.T, v.N, v.dp, v.ev, v.em), tip = Math.PI * v.D * v.N / 60, ratio = tip / (v.vg / 3.6);
        return { rows: s.rows.concat([{ label: 'Reel tip speed', eq: 'v = π·D·N', sub: `π × ${H.n(v.D, 'len')} × ${H.f(v.N / 60, 3)}`, res: `<b>${H.f(tip, 2)} m/s</b>` }, { label: 'Reel index (tip speed / ground speed)', eq: 'v<sub>reel</sub> / v<sub>ground</sub>', sub: `${H.f(tip, 2)} / ${H.f(v.vg / 3.6, 2)}`, res: `<b>${H.f(ratio, 2)}</b>` }]),
          teach: 'A reel needs low speed and high torque, which is exactly what a geroller gives without a gearbox. Reel speed is usually set slightly faster than ground speed (index above 1) so the reel gently pulls the crop onto the knife. Since speed follows flow, a flow-control valve adjusts the index on the go.' }; } },
    { id: 'elevator', sector: 'ag', kind: 'assume', title: 'Clean grain elevator, hydraulic drive', motor: 'Gear or geroller motor',
      intro: 'Clean grain elevators are often belt or chain driven from the separator, but hydraulic drives are used on some machines and conversions. This design exercise uses assumed values: 25 t/h of grain lifted 3 m by a paddle chain.',
      inputs: [['m', 'Grain flow (t/h)', 'cnt', 25], ['h', 'Lift height', 'len', 3], ['T', 'Elevator shaft torque, including chain friction (assumed)', 'T', 120], ['N', 'Elevator head shaft speed', 'rpm', 420], ['dp', 'Pressure drop', 'p', 1.5e7], ['ev', 'Volumetric efficiency', 'eff', .92], ['em', 'Mechanical efficiency', 'eff', .9]],
      compute(v, H) { const Plift = v.m * 1000 / 3600 * 9.81 * v.h, s = sizeRows(H, v.T, v.N, v.dp, v.ev, v.em);
        return { rows: [{ label: 'Power just to lift the grain', eq: 'P = ṁ·g·h', sub: `${H.f(v.m * 1000 / 3600, 2)} kg/s × 9.81 × ${H.n(v.h, 'len')}`, res: H.r(Plift, 'P') }].concat(s.rows),
          teach: `Lifting the grain itself takes only about ${H.e(Plift, 'P')}; most of the ${H.e(s.P, 'P')} goes into chain, sprocket and paddle friction. That is typical of conveyors and elevators: losses, not the useful work, decide the motor size.` }; } },
    { id: 'tiller', sector: 'ag', kind: 'assume', title: 'Rotary tiller or vertical tillage rotor', motor: 'Radial or bent-axis piston motor',
      intro: 'Powered tillage rotors are usually PTO driven, but hydraulic drives let the rotor speed be set independently of engine speed. Design exercise with assumed values for a 1.5 m rotor.',
      inputs: [['P', 'Rotor power (assumed)', 'P', 20000], ['N', 'Rotor speed', 'rpm', 250], ['dp', 'Pressure drop', 'p', 2e7], ['ev', 'Volumetric efficiency', 'eff', .95], ['em', 'Mechanical efficiency', 'eff', .92]],
      compute(v, H) { const T = v.P / (TAU * v.N / 60), s = sizeRows(H, T, v.N, v.dp, v.ev, v.em);
        return { rows: [{ label: 'Rotor torque', eq: 'T = P / (2πN)', sub: `${H.n(v.P, 'P')} / (2π × ${H.f(v.N / 60, 3)})`, res: H.r(T, 'T') }].concat(s.rows),
          teach: `High torque at low speed points to a large-displacement piston motor (about ${H.e(s.V, 'vol')}). The flow, about ${H.e(s.Q, 'Q')}, is a large share of a mid-size tractor’s pump, so check the tractor’s rated flow and the oil cooling capacity.` }; } },
    { id: 'thresher', sector: 'ag', kind: 'assume', title: 'Threshing drum (small stationary thresher)', motor: 'Gear motor',
      intro: 'A threshing drum needs a high peripheral (rim) speed. Design exercise with assumed values for a 0.5 m drum on a small stationary thresher.',
      inputs: [['D', 'Drum diameter', 'len', 0.5], ['vp', 'Rim speed (m/s)', 'cnt', 25], ['P', 'Drum power (assumed)', 'P', 11000], ['dp', 'Pressure drop', 'p', 1.6e7], ['ev', 'Volumetric efficiency', 'eff', .92], ['em', 'Mechanical efficiency', 'eff', .88]],
      compute(v, H) { const N = v.vp / (Math.PI * v.D) * 60, T = v.P / (TAU * N / 60), s = sizeRows(H, T, N, v.dp, v.ev, v.em);
        return { rows: [{ label: 'Drum speed', eq: 'N = v / (π·D)', sub: `${H.f(v.vp, 1)} / (π × ${H.n(v.D, 'len')})`, res: `<b>${H.f(N, 0)} rpm</b>` }, { label: 'Drum torque', eq: 'T = P / (2πN)', sub: `${H.n(v.P, 'P')} / (2π × ${H.f(N / 60, 2)})`, res: H.r(T, 'T') }].concat(s.rows),
          teach: 'High speed and moderate torque suit an ordinary gear motor. Rim speed sets threshing action: too fast cracks grain, too slow leaves grain in the head, so variable flow (speed) is useful for different crops.' }; } },
    { id: 'mixer', sector: 'ind', kind: 'real', title: 'Concrete truck mixer drum', motor: 'Axial piston motor (fixed or variable) with planetary gearbox',
      intro: 'Truck mixer drums are turned by a hydraulic piston motor through a planetary gearbox. Eaton’s heavy-duty mixer motor series is listed at 63.7 to 124.8 cm³/rev (for example 89.1 cm³ for the 5433). A truck-mixer standard recommends 70 to 100 mixing turns at 6 to 18 rpm, and agitating at about 1.5 to 2.5 rpm. The gearbox ratio here is assumed.',
      src: [['Eaton mixer motor listing (displacements)', 'https://m.made-in-china.com/product/Eaton-Concrete-Mixer-Motor-5433-748879342.html'], ['US patent 6286987 (TMMB mixing guidance)', 'https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/6286987']],
      inputs: [['V', 'Motor displacement', 'vol', 89.1e-6], ['i', 'Gearbox ratio (assumed)', 'cnt', 120], ['Nm', 'Drum mixing speed', 'rpm', 14], ['Na', 'Drum agitating speed', 'rpm', 2], ['ev', 'Volumetric efficiency', 'eff', .95]],
      compute(v, H) { const nm = v.Nm * v.i, na = v.Na * v.i, Qm = v.V * nm / 60 / v.ev, Qa = v.V * na / 60 / v.ev;
        return { rows: [
          { label: 'Motor speed while mixing', eq: 'N<sub>motor</sub> = i·N<sub>drum</sub>', sub: `${H.f(v.i, 0)} × ${H.f(v.Nm, 1)} rpm`, res: `<b>${H.f(nm, 0)} rpm</b>` },
          { label: 'Flow while mixing', eq: 'Q = V<sub>D</sub>·N / η<sub>v</sub>', sub: `${H.n(v.V, 'vol')} × ${H.f(nm / 60, 2)} / ${H.f(v.ev, 2)}`, res: H.r(Qm, 'Q') },
          { label: 'Motor speed while agitating', eq: 'N<sub>motor</sub> = i·N<sub>drum</sub>', sub: `${H.f(v.i, 0)} × ${H.f(v.Na, 1)} rpm`, res: `<b>${H.f(na, 0)} rpm</b>` },
          { label: 'Flow while agitating', eq: 'Q = V<sub>D</sub>·N / η<sub>v</sub>', sub: `${H.n(v.V, 'vol')} × ${H.f(na / 60, 2)} / ${H.f(v.ev, 2)}`, res: H.r(Qa, 'Q') },
          { label: 'Time for 100 mixing turns', eq: 't = turns / N<sub>drum</sub>', sub: `100 / ${H.f(v.Nm, 1)}`, res: `<b>${H.f(100 / v.Nm, 1)} min</b>` }],
          teach: 'The same motor must run from very slow agitation to fast mixing and discharge, a speed range of 7:1 or more. That is why mixer drives use a variable pump (and sometimes a variable motor) rather than a fixed pump running from the engine.' }; } },
    { id: 'conveyor', sector: 'ind', kind: 'assume', title: 'Belt conveyor head drive', motor: 'Geroller (orbital) motor, direct drive',
      intro: 'Direct-drive orbital motors are common on belt conveyors in quarries, recycling and food plants because they need no gearbox. Design exercise with assumed values.',
      inputs: [['F', 'Effective belt pull', 'F', 3000], ['D', 'Drive drum diameter', 'len', 0.4], ['vb', 'Belt speed (m/s)', 'cnt', 1.2], ['dp', 'Pressure drop', 'p', 1.4e7], ['ev', 'Volumetric efficiency', 'eff', .92], ['em', 'Mechanical efficiency', 'eff', .9]],
      compute(v, H) { const N = v.vb / (Math.PI * v.D) * 60, T = v.F * v.D / 2, s = sizeRows(H, T, N, v.dp, v.ev, v.em);
        return { rows: [{ label: 'Drum speed', eq: 'N = v / (π·D)', sub: `${H.f(v.vb, 2)} / (π × ${H.n(v.D, 'len')})`, res: `<b>${H.f(N, 1)} rpm</b>` }, { label: 'Drum torque', eq: 'T = F·D / 2', sub: `${H.n(v.F, 'F')} × ${H.n(v.D, 'len')} / 2`, res: H.r(T, 'T') }].concat(s.rows),
          teach: 'Check: belt pull × belt speed gives the same power as torque × angular speed. Using a direct-drive geroller removes the gearbox, but the motor’s side-load rating must cover the belt tension on the drum shaft.' }; } },
    { id: 'screw', sector: 'ind', kind: 'assume', title: 'Injection-moulding screw drive', motor: 'Radial piston motor',
      intro: 'The plasticising screw of an injection-moulding machine needs smooth, high torque at low speed, so radial piston motors are a common choice. Design exercise with assumed values.',
      inputs: [['T', 'Screw torque (assumed)', 'T', 2500], ['N', 'Screw speed', 'rpm', 120], ['dp', 'Pressure drop', 'p', 2e7], ['ev', 'Volumetric efficiency', 'eff', .96], ['em', 'Mechanical efficiency', 'eff', .94]],
      compute(v, H) { const s = sizeRows(H, v.T, v.N, v.dp, v.ev, v.em); return { rows: s.rows, teach: 'Radial piston motors give high starting torque and very even rotation at low speed, which keeps the melt quality steady. Their high efficiencies mean less oil heating than a gear motor doing the same job.' }; } }
  ];
})();
