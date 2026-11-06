/* Planar engine: a machine is a set of 2D parts (polygons in model units, y up)
   that move rigidly, plus fluid and dynamic shapes rebuilt each frame.
   The same data draws the SVG section and an extruded 3D cutaway. */
window.PE = (function () {
  const NS = 'http://www.w3.org/2000/svg';
  const el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const d = (pts) => 'M' + pts.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join('L') + 'Z';
  const pathD = (part) => d(part.pts) + (part.holes || []).map(d).join('');

  class View2D {
    constructor(svg) { this.svg = svg; }
    build(m) {
      this.m = m; const svg = this.svg; svg.innerHTML = '';
      const [x0, y0, w, h] = m.vb; svg.setAttribute('viewBox', `${x0} ${-(y0 + h)} ${w} ${h}`);
      this.k = w / 900; // px per unit for strokes/text
      const defs = el('defs', {}, svg);
      const pat = el('pattern', { id: 'hatch', width: .8, height: .8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      el('rect', { width: .8, height: .8, class: 'hatch-bg' }, pat); el('line', { x1: 0, y1: 0, x2: 0, y2: .8, class: 'hatch-line', style: 'stroke-width:.09' }, pat);
      const world = el('g', { transform: 'scale(1,-1)' }, svg);
      this.Lf = el('g', {}, world); this.Lb = el('g', {}, world); this.Lp = el('g', {}, world); this.La = el('g', {}, world);
      this.Lt = el('g', {}, svg);
      this.parts = {};
      m.parts.forEach(p => { const e = el('path', { d: pathD(p), class: 'p-' + p.cls, 'fill-rule': 'evenodd' }, this.Lp); this.parts[p.id] = e; });
      (m.overlays || []).forEach(o => el(o.tag, o.attr, this.La));
      this.labels = (m.labels || []).map(lb => {
        const ln = el('line', { class: 'leader2' }, this.Lt), t = el('text', { class: 'lbl2', 'text-anchor': lb.anchor || 'middle' }, this.Lt);
        t.textContent = lb.text; t.style.fontSize = (13 * this.k).toFixed(2) + 'px'; t.style.strokeWidth = (4 * this.k).toFixed(2) + 'px'; ln.style.strokeWidth = this.k;
        return { lb, ln, t };
      });
      this.pool = { f: [], b: [], a: [] };
    }
    shapes(layer, key, list) {
      const pool = this.pool[key];
      while (pool.length < list.length) pool.push(el('path', { 'fill-rule': 'evenodd' }, layer));
      pool.forEach((e, i) => { const s = list[i]; if (!s) { e.setAttribute('d', ''); return; }
        e.setAttribute('d', s.lines ? 'M' + s.pts.map(p => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join('L') : d(s.pts));
        e.setAttribute('class', (s.f ? 'fl-' + s.f : 'p-' + s.cls) + (s.extra ? ' ' + s.extra : '')); });
    }
    update(fr) {
      for (const id in fr.xf || {}) { const x = fr.xf[id], e = this.parts[id]; if (!e) continue;
        e.setAttribute('transform', `translate(${(x.x || 0).toFixed(3)} ${(x.y || 0).toFixed(3)}) rotate(${((x.r || 0) * 180 / Math.PI).toFixed(2)})`);
        if (x.cls) e.setAttribute('class', 'p-' + x.cls + (x.extra ? ' ' + x.extra : ''));
        e.style.display = x.hide ? 'none' : ''; }
      this.shapes(this.Lf, 'f', fr.fluids || []); this.shapes(this.Lb, 'b', fr.below || []); this.shapes(this.La, 'a', fr.above || []);
      const pos = fr.labelPos || {};
      this.labels.forEach(({ lb, ln, t }, i) => { const at = pos[i] || lb.at, tx = lb.tx, ty = lb.ty;
        t.setAttribute('x', tx); t.setAttribute('y', -ty); ln.setAttribute('x1', at[0]); ln.setAttribute('y1', -at[1]);
        ln.setAttribute('x2', tx); ln.setAttribute('y2', -ty + (ty < at[1] ? -0.9 : 0.3) * 13 * this.k / 1.2); });
    }
  }

  /* ---------- 3D ---------- */
  class View3D {
    constructor(box) { this.box = box; this.ready = false; }
    init() {
      if (this.ready) return; this.ready = true;
      const r = this.renderer = new THREE.WebGLRenderer({ antialias: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.box.appendChild(r.domElement);
      r.domElement.tabIndex = 0; r.domElement.setAttribute('aria-label', '3D cutaway view. Drag to rotate, scroll or pinch to zoom, arrow keys to rotate.');
      this.scene = new THREE.Scene(); this.camera = new THREE.PerspectiveCamera(32, 2, 0.1, 2000);
      this.scene.add(new THREE.HemisphereLight(0xffffff, 0x606870, 0.8));
      const k = new THREE.DirectionalLight(0xffffff, .75); k.position.set(30, 50, 80); this.scene.add(k);
      const f = new THREE.DirectionalLight(0xffffff, .3); f.position.set(-40, -20, -50); this.scene.add(f);
      const std = o => new THREE.MeshStandardMaterial(Object.assign({ metalness: .3, roughness: .5, side: THREE.DoubleSide }, o));
      this.M = { housing: std({}), gearA: std({}), gearB: std({}), rotor: std({}), ring: std({}), crescent: std({}), roller: std({}), vane: std({}), shaft: std({}), key: std({}), piston: std({ metalness: .7, roughness: .25 }),
        block: std({ transparent: true, opacity: .55, depthWrite: false }), swash: std({}), plate: std({}), arm: std({}), rack: std({}), cover: std({}),
        'pipe-hp': std({}), 'pipe-lp': std({}), 'pipe-case': std({}),
        hp: std({ transparent: true, opacity: .6, depthWrite: false, roughness: .8 }), lp: std({ transparent: true, opacity: .45, depthWrite: false, roughness: .8 }), case: std({ transparent: true, opacity: .3, depthWrite: false }) };
      this.colors(); matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.colors());
      this.cam = { az: .5, el: .45, dist: 60, taz: .5, tel: .45, tdist: 60 };
      this.orbit(); new ResizeObserver(() => this.resize()).observe(this.box); this.resize();
    }
    colors() { const M = this.M, c = (k, v) => M[k] && M[k].color.set(css(v));
      this.scene.background = new THREE.Color(css('--scene'));
      c('housing', '--steel'); c('gearA', '--steel'); c('gearB', '--steel-light'); c('rotor', '--steel'); c('ring', '--steel-light'); c('crescent', '--steel-dark'); c('roller', '--steel-dark');
      c('vane', '--accent'); c('shaft', '--steel-dark'); c('key', '--accent'); c('piston', '--rod'); c('block', '--steel-light'); c('swash', '--accent'); c('plate', '--steel-dark'); c('arm', '--lp'); c('rack', '--steel'); c('cover', '--steel-light');
      c('pipe-hp', '--hp'); c('pipe-lp', '--lp'); c('pipe-case', '--air'); c('hp', '--hp'); c('lp', '--lp'); c('case', '--air'); }
    resize() { if (!this.ready) return; const w = this.box.clientWidth, h = this.box.clientHeight; if (!w || !h) return; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    shape(pts, holes) { const s = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1]))); (holes || []).forEach(h => s.holes.push(new THREE.Path(h.map(p => new THREE.Vector2(p[0], p[1]))))); return s; }
    extrude(pts, holes, z0, z1) { const g = new THREE.ExtrudeGeometry(this.shape(pts, holes), { depth: z1 - z0, bevelEnabled: false, curveSegments: 1 }); g.translate(0, 0, z0); return g; }
    build(m, cutaway) {
      this.init(); this.m = m;
      if (this.root) { this.scene.remove(this.root); this.root.traverse(o => o.geometry && o.geometry.dispose()); }
      (this.labs || []).forEach(l => l.el.remove());
      const root = this.root = new THREE.Group(); this.scene.add(root);
      const D = m.depth !== undefined ? m.depth : 8; this.D = D;
      this.meshes = {};
      this.custom = null;
      if (m.custom3D) { this.custom = m.custom3D(THREE, this.M, root); }
      else {
        m.parts.forEach(p => { if (p.cover && cutaway) return; const z = p.z || [0, D];
          const mesh = new THREE.Mesh(this.extrude(p.pts, p.holes, z[0], z[1]), this.M[p.cls] || this.M.housing); root.add(mesh); this.meshes[p.id] = mesh; });
        // back plate so the inside reads clearly
        if (m.backPlate) { const bp = new THREE.Mesh(this.extrude(m.backPlate, null, -1.2, 0), this.M.cover); root.add(bp); }
        if (m.frontPlate && !cutaway) { const fp = new THREE.Mesh(this.extrude(m.frontPlate.pts, m.frontPlate.holes, D, D + 1.2), this.M.cover); root.add(fp); }
      }
      const [x0, y0, w, h] = m.vb; root.position.set(-(x0 + w / 2), -(y0 + h / 2), -D / 2);
      this.pool = []; this.cam.tdist = Math.max(w, h) * 1.25; if (!this.fitted) { this.cam.dist = this.cam.tdist; this.fitted = true; }
      this.labs = (m.labels || []).map(lb => { const e = document.createElement('div'); e.className = 'lab3'; e.textContent = lb.text; this.box.appendChild(e); return { lb, el: e }; });
      this.resize();
    }
    update(fr) {
      if (!this.ready || !this.root) return;
      const M = this.M, D = this.D;
      if (this.custom) this.custom.update(fr);
      else {
        for (const id in fr.xf || {}) { const x = fr.xf[id], m = this.meshes[id]; if (!m) continue; m.position.x = x.x || 0; m.position.y = x.y || 0; m.rotation.z = x.r || 0; m.visible = !x.hide; if (x.cls && M[x.cls]) m.material = M[x.cls]; }
        const list = [].concat((fr.fluids || []).map(s => ({ s, mat: M[s.f], z: [0.15, D - 0.15] })), (fr.below || []).concat(fr.above || []).filter(s => !s.lines && !s.no3d).map(s => ({ s, mat: M[s.cls] || M.housing, z: s.z || [0.05, D - 0.05] })));
        list.forEach((it, i) => { let e = this.pool[i]; if (!e) { e = this.pool[i] = new THREE.Mesh(new THREE.BufferGeometry(), it.mat); this.root.add(e); }
          e.geometry.dispose(); e.geometry = this.extrude(it.s.pts, null, it.z[0], it.z[1]); e.material = it.mat; e.visible = true; });
        for (let i = list.length; i < this.pool.length; i++) this.pool[i].visible = false;
      }
      const c = this.cam; c.az += (c.taz - c.az) * .12; c.el += (c.tel - c.el) * .12; c.dist += (c.tdist - c.dist) * .12;
      const cam = this.camera; cam.position.set(c.dist * Math.cos(c.el) * Math.sin(c.az), c.dist * Math.sin(c.el), c.dist * Math.cos(c.el) * Math.cos(c.az));
      cam.up.set(0, 1, 0); if (Math.abs(c.el) > 1.5) cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0);
      this.renderer.render(this.scene, cam);
      const W = this.box.clientWidth, Hh = this.box.clientHeight, hide = this.box.classList.contains('nolabels'), pos = fr.labelPos || {};
      const zf = this.m.custom3D ? 0 : D + 0.3;
      this.labs.forEach(({ lb, el: e }, i) => { const at = pos[i] || lb.at3 || lb.at; const v = this.root.localToWorld(new THREE.Vector3(at[0], at[1], at[2] !== undefined ? at[2] : zf)).project(cam);
        if (hide || v.z > 1 || v.z < -1) { e.style.display = 'none'; return; } e.style.display = ''; e.style.transform = `translate(${(v.x + 1) / 2 * W}px,${(1 - v.y) / 2 * Hh}px) translate(-50%,-50%)`; });
    }
    orbit() {
      const el2 = this.renderer.domElement, c = this.cam, ptrs = new Map(); let pinch = null;
      el2.addEventListener('pointerdown', e => { el2.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); });
      el2.addEventListener('pointermove', e => { if (!ptrs.has(e.pointerId)) return; const p = ptrs.get(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const dd = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) c.tdist = Math.min(400, Math.max(10, c.tdist * pinch / dd)); pinch = dd; return; }
        c.taz -= (e.clientX - p.x) * .008; c.tel = Math.max(-1.5, Math.min(1.55, c.tel + (e.clientY - p.y) * .008)); this.onManual && this.onManual(); });
      const up = e => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; };
      el2.addEventListener('pointerup', up); el2.addEventListener('pointercancel', up);
      el2.addEventListener('wheel', e => { e.preventDefault(); c.tdist = Math.min(400, Math.max(10, c.tdist * (1 + Math.sign(e.deltaY) * .1))); }, { passive: false });
      el2.addEventListener('keydown', e => { const k = e.key; let u = true;
        if (k === 'ArrowLeft') c.taz += .1; else if (k === 'ArrowRight') c.taz -= .1; else if (k === 'ArrowUp') c.tel = Math.min(1.55, c.tel + .1); else if (k === 'ArrowDown') c.tel = Math.max(-1.5, c.tel - .1);
        else if (k === '+' || k === '=') c.tdist *= .9; else if (k === '-') c.tdist *= 1.1; else u = false; if (u) { e.preventDefault(); this.onManual && this.onManual(); } });
    }
    setView(v) { const V = { persp: [.5, .45], front: [0, 0], side: [Math.PI / 2, .1], top: [.0001, Math.PI / 2 - .01] }[v]; this.cam.taz = V[0]; this.cam.tel = V[1]; }
  }
  return { View2D, View3D };
})();
