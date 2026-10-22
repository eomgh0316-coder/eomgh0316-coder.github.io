'use strict';
(() => {
  const root = document.documentElement;
  const languageButtons = [...document.querySelectorAll('[data-lang-choice]')];
  const sections = [...document.querySelectorAll('.data-section')];
  const state = new Map(sections.map(section => {
    const filters = {};
    section.querySelectorAll('[data-filter-key][aria-pressed="true"]').forEach(button => {
      filters[button.dataset.filterKey] = button.dataset.filterValue;
    });
    return [section, { filters, expanded: false }];
  }));
  const language = () => root.dataset.lang || 'en';
  const normalize = value => value.normalize('NFKC').toLocaleLowerCase().trim();
  function applyFilters(section) {
    const { filters, expanded } = state.get(section);
    const query = normalize(section.querySelector('input[type="search"]')?.value || '');
    const rows = [...section.querySelectorAll('.record-row')];
    const matching = rows.filter(row => Object.entries(filters).every(([key, value]) => value === 'all' || row.dataset[key] === value) && normalize(row.dataset.search || '').includes(query));
    const limit = Number(section.dataset.limit) || Infinity;
    const visible = expanded ? matching : matching.slice(0, limit);
    const visibleSet = new Set(visible);
    rows.forEach(row => { row.hidden = !visibleSet.has(row); });
    const summary = section.querySelector('.filter-summary');
    summary.textContent = language() === 'ko' ? `${matching.length}건 중 ${visible.length}건 표시` : `Showing ${visible.length} of ${matching.length} entries`;
    summary.lang = language();
    const empty = section.querySelector('.empty-state');
    if (empty) empty.hidden = matching.length > 0;
    const more = section.querySelector('.load-more');
    if (more) {
      more.hidden = matching.length <= limit;
      more.setAttribute('aria-expanded', String(expanded));
      more.lang = language();
      more.textContent = language() === 'ko' ? (expanded ? '간단히 보기' : `전체 ${matching.length}건 펼치기`) : (expanded ? 'Show fewer' : `Show all ${matching.length} contributions`);
    }
  }
  function setLanguage(lang) {
    if (!['en', 'ko'].includes(lang)) lang = 'en';
    root.dataset.lang = lang;
    root.lang = lang;
    languageButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.langChoice === lang)));
    document.querySelectorAll('[data-placeholder-en]').forEach(input => {
      input.placeholder = lang === 'ko' ? input.dataset.placeholderKo : input.dataset.placeholderEn;
      input.lang = lang;
    });
    document.title = lang === 'ko' ? '엄가현 | 연구·학술 포트폴리오' : 'Ga-Hyeon Eom | Experimental Sensing & Composite Materials';
    document.querySelectorAll('[data-label-ko]').forEach(el => el.setAttribute('aria-label', lang === 'ko' ? el.dataset.labelKo : el.dataset.labelEn));
    sections.forEach(applyFilters);
    try { localStorage.setItem('gheom-language', lang); } catch (_) {}
  }
  languageButtons.forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.langChoice)));
  sections.forEach(section => {
    section.querySelectorAll('[data-filter-key]').forEach(button => {
      button.addEventListener('click', () => {
        const key = button.dataset.filterKey;
        state.get(section).filters[key] = button.dataset.filterValue;
        state.get(section).expanded = false;
        section.querySelectorAll(`[data-filter-key="${key}"]`).forEach(sibling => sibling.setAttribute('aria-pressed', String(sibling === button)));
        applyFilters(section);
      });
    });
    section.querySelector('input[type="search"]')?.addEventListener('input', () => { state.get(section).expanded = false; applyFilters(section); });
    section.querySelector('.load-more')?.addEventListener('click', () => {
      const s = state.get(section);
      s.expanded = !s.expanded;
      applyFilters(section);
      if (!s.expanded) section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    });
  });
  const nav = document.querySelector('#main-nav');
  const menu = document.querySelector('.menu-toggle');
  function closeMenu() {
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
  }
  menu.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    menu.setAttribute('aria-expanded', String(open));
    if (open) nav.querySelector('a')?.focus();
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !nav.classList.contains('is-open')) return;
    const inside = nav.contains(document.activeElement);
    closeMenu();
    if (inside) menu.focus();
  });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  const dialog = document.querySelector('#image-dialog');
  let lastImageButton;
  document.querySelectorAll('[data-image]').forEach(button => button.addEventListener('click', () => {
    lastImageButton = button;
    const displayed = button.querySelector('img');
    const modalImage = dialog.querySelector('.dialog-image');
    modalImage.src = button.dataset.image;
    modalImage.alt = displayed.alt;
    const caption = button.closest('figure').querySelector('figcaption');
    dialog.querySelector('.dialog-caption').innerHTML = caption ? caption.innerHTML : '';
    dialog.showModal();
    document.body.classList.add('modal-open');
  }));
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('modal-open');
    lastImageButton?.focus({ preventScroll: true });
  });
  document.querySelectorAll('video').forEach(video => video.addEventListener('play', () => {
    document.querySelectorAll('video').forEach(other => { if (other !== video) other.pause(); });
  }));
  let toastTimer;
  function toast(message) {
    const element = document.querySelector('.toast');
    element.textContent = message;
    element.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove('visible'), 3500);
  }
  document.querySelector('.copy-email').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText('eomgh0316@hanyang.ac.kr');
      toast(language() === 'ko' ? '이메일 주소를 복사했습니다.' : 'Email address copied.');
    } catch (_) {
      // Clipboard API refused (e.g. a sandboxed frame): select the address itself and try the legacy copy.
      const text = document.querySelector('.contact-email').firstChild;
      const range = document.createRange();
      range.setStart(text, 0);
      range.setEnd(text, text.nodeValue.trim().length);
      const selection = getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) {}
      const ko = language() === 'ko';
      toast(copied ? (ko ? '이메일 주소를 복사했습니다.' : 'Email address copied.') : (ko ? '주소를 선택했습니다. Ctrl+C(⌘C)로 복사하세요.' : 'Address selected. Press Ctrl+C (⌘C) to copy.'));
    }
  });
  document.querySelectorAll('[data-print]').forEach(button => button.addEventListener('click', () => window.print()));
  if ('IntersectionObserver' in window) {
    const observed = ['education', 'research', 'projects', 'publications', 'contact'];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          nav.querySelectorAll('a').forEach(link => link.classList.toggle('active', link.hash === `#${entry.target.id}`));
        }
      });
    }, { rootMargin: '-10% 0px -65% 0px', threshold: 0 });
    observed.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
  }
  let savedLanguage = 'en';
  try { savedLanguage = localStorage.getItem('gheom-language') || 'en'; } catch (_) {}
  setLanguage(savedLanguage);
})();
