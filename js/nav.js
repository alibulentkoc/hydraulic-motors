/* Site navigation bar, shared by every page */
(function () {
  const pages = [['index.html', 'Motor types'], ['oscillators.html', 'Oscillators'], ['applications.html', 'Applications'], ['formulas.html', 'Formulas and symbols']];
  const here = (location.pathname.split('/').pop() || 'index.html');
  const nav = document.createElement('nav'); nav.className = 'sitenav'; nav.setAttribute('aria-label', 'Site');
  nav.innerHTML = pages.map(([h, t]) => `<a href="${h}"${h === here ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  const wrap = document.querySelector('.wrap'); wrap.insertBefore(nav, wrap.firstChild);
})();
