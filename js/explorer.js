(function () {
  const $ = id => document.getElementById(id), H = HM.H, TYPES = MOTORS.list;
  const v2 = new PE.View2D($('sec')), v3 = new PE.View3D($('v3d'));
  let type, opts = {}, theta = 0, dir = 1, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches, mode = '2d';
  const inputs = {};
  /* ---------- nav ---------- */
  const nav = $('typeNav'), fams = [...new Set(TYPES.map(t => t.family))];
  nav.innerHTML = fams.map(f => `<div class="groupname">${f}</div><ul>${TYPES.filter(t => t.family === f).map(t => `<li><button class="typebtn sym" data-type="${t.id}"><svg viewBox="0 0 100 100" aria-hidden="true">${MOTORS.symbol(t.sym)}</svg><span>${t.name}</span></button></li>`).join('')}</ul>`).join('');
  nav.addEventListener('click', e => { const b = e.target.closest('[data-type]'); if (b) location.hash = b.dataset.type; });
  window.addEventListener('hashchange', () => select(location.hash.slice(1)));
  function select(id) {
    type = TYPES.find(t => t.id === id) || TYPES[0];
    document.querySelectorAll('[data-type]').forEach(b => b.dataset.type === type.id ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
    opts = {}; (type.opts || []).forEach(o => opts[o.id] = o.def);
    $('typeName').textContent = type.name; $('summary').textContent = type.summary; $('uses').textContent = type.uses; $('watch').textContent = type.watch;
    $('steps').innerHTML = type.steps.map(s => `<li>${s}</li>`).join('');
    $('symbol').innerHTML = MOTORS.symbol(type.sym);
    $('symNote').textContent = (type.sym.bi ? 'Bidirectional' : 'Unidirectional') + (type.sym.variable ? ', variable displacement (arrow)' : ', fixed displacement') + (type.sym.drain ? ', with case drain (dashed line to tank).' : '.');
    buildExtra(); rebuild(); buildCalc(); document.title = type.name + ': hydraulic motors';
  }
  function rebuild() { v2.build(type.build(opts)); if (mode === '3d') v3.build(type.build(opts), $('cut').checked); else v3.dirty = true; }
  function buildExtra() { const ex = $('extra'); ex.innerHTML = '';
    (type.opts || []).forEach(o => { const l = document.createElement('label'); l.innerHTML = `${o.label} <input type="range" min="${o.min}" max="${o.max}" step="0.5" value="${o.def}"> <span class="readout">${o.def}${o.unit}</span>`;
      const inp = l.querySelector('input'), ro = l.querySelector('.readout'); inp.addEventListener('input', () => { opts[o.id] = +inp.value; ro.textContent = inp.value + o.unit; if (inputs.a) { inputs.a.si = +inp.value; syncIn(); calc(); } }); ex.appendChild(l); }); }
  /* ---------- calculator ---------- */
  function buildCalc() {
    const box = $('calcIn'); box.innerHTML = ''; for (const k in inputs) delete inputs[k];
    type.calc.inputs.forEach(([id, label, kind, def]) => { inputs[id] = { kind, si: def };
      const l = document.createElement('label'); l.innerHTML = `${label}<span class="in"><input type="number" step="any" id="ci-${id}"><span class="u" id="cu-${id}"></span></span>`; box.appendChild(l);
      l.querySelector('input').addEventListener('change', e => { const x = parseFloat(e.target.value); if (isFinite(x)) inputs[id].si = x / H.EVERY[H.units][kind][1]; calc(); }); });
    if (opts.alpha !== undefined && inputs.a) inputs.a.si = opts.alpha;
    syncIn(); calc();
  }
  function syncIn() { for (const id in inputs) { const { kind, si } = inputs[id], E = H.EVERY[H.units][kind]; $('ci-' + id).value = +(si * E[1]).toFixed(Math.max(E[2], 2)); $('cu-' + id).textContent = E[0]; } }
  function calc() {
    const v = {}; for (const id in inputs) v[id] = inputs[id].si;
    const c = type.calc, rows = [];
    let V = v.V;
    if (c.V) { V = c.V(v); rows.push({ label: 'Displacement', eq: c.Veq, sub: c.Vsub(v, H), res: H.r(V, 'vol') }); }
    else rows.push({ label: 'Displacement (datasheet)', eq: 'V<sub>D</sub>', sub: '', res: H.r(V, 'vol') });
    if (c.extra) rows.push(...c.extra(v, H));
    rows.push(...MOTORS.generalRows(v, V, H));
    $('calcOut').innerHTML = rows.map(r => `<tr><td>${r.label}</td><td class="eq">${r.eq}</td><td class="sub">${r.sub}</td><td class="res">${r.res}</td></tr>`).join('');
    $('calcNote').innerHTML = (c.note ? c.note + ' ' : '') + (H.units === 'us' ? 'Substitutions use consistent US units: lbf, inches, seconds (psi, in³/rev, in³/s, lb·in).' : 'Substitutions use consistent SI units: newtons, metres, seconds (Pa, m³/rev, m³/s, N·m). N comes out in rev/s; ×60 gives rpm.');
  }
  document.querySelectorAll('[data-units]').forEach(b => b.addEventListener('click', () => { H.units = b.dataset.units; document.querySelectorAll('[data-units]').forEach(x => x.setAttribute('aria-pressed', x === b)); syncIn(); calc(); }));
  /* ---------- view and controls ---------- */
  document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => { mode = b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach(x => x.setAttribute('aria-pressed', x === b)); $('sec').style.display = mode === '3d' ? 'none' : ''; $('v3d').hidden = mode !== '3d';
    if (mode === '3d') { if (v3.dirty || !v3.root) { v3.build(type.build(opts), $('cut').checked); v3.dirty = false; } v3.resize(); } }));
  $('cut').addEventListener('change', () => { if (mode === '3d') v3.build(type.build(opts), $('cut').checked); else v3.dirty = true; });
  document.querySelectorAll('[data-v3]').forEach(b => b.addEventListener('click', () => { v3.setView(b.dataset.v3); document.querySelectorAll('[data-v3]').forEach(x => x.setAttribute('aria-pressed', x === b)); }));
  v3.onManual = () => document.querySelectorAll('[data-v3]').forEach(x => x.setAttribute('aria-pressed', 'false'));
  const syncPlay = () => { $('play').textContent = playing ? 'Pause' : 'Play'; $('play').setAttribute('aria-pressed', playing); }; syncPlay();
  $('play').addEventListener('click', () => { playing = !playing; syncPlay(); });
  $('rev').addEventListener('click', () => { dir *= -1; });
  $('labels').addEventListener('change', e => { $('sec').classList.toggle('nolabels', !e.target.checked); $('v3d').classList.toggle('nolabels', !e.target.checked); });
  /* ---------- loop ---------- */
  let last = performance.now(), lastStatus = '';
  function frame(t) {
    const dt = Math.min((t - last) / 1000, .05); last = t;
    if (playing) theta += dir * (type.vis / 60) * 2 * Math.PI * (+$('spd').value) * dt;
    const fr = type.frame(theta, dir, opts); fr.dir = dir;
    if (mode === '2d') v2.update(fr); else v3.update(fr);
    if (fr.status !== lastStatus) { $('status').textContent = fr.status; lastStatus = fr.status; }
    requestAnimationFrame(frame);
  }
  select(location.hash.slice(1)); requestAnimationFrame(frame);
})();
