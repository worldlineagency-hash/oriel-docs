// Lunavel docs: light/dark switch, mobile contents drawer, "On this page"
// highlighting and search over search.json.
(() => {
  const root = document.documentElement;

  /* Light and dark mode */
  const toggle = document.querySelector('.theme-toggle');
  const isDark = () =>
    root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const labelToggle = () => toggle.setAttribute('aria-label', isDark() ? 'Switch to light mode' : 'Switch to dark mode');
  labelToggle();
  toggle.addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try {
      localStorage.setItem('lunavel-docs-theme', root.dataset.theme);
    } catch (error) {}
    labelToggle();
  });

  /* Contents drawer on smaller screens */
  const menuButton = document.querySelector('.menu-button');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  const setMenu = (open) => {
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close the contents' : 'Open the contents');
    sidebar.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    if (open) sidebar.querySelector('[aria-current], a').focus();
  };
  menuButton.addEventListener('click', () => setMenu(menuButton.getAttribute('aria-expanded') !== 'true'));
  backdrop.addEventListener('click', () => setMenu(false));
  sidebar.querySelector('.sidebar__close').addEventListener('click', () => {
    setMenu(false);
    menuButton.focus();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
      setMenu(false);
      menuButton.focus();
    }
  });
  matchMedia('(min-width: 960px)').addEventListener('change', () => setMenu(false));

  /* "On this page": mark the section being read */
  const tocLinks = [...document.querySelectorAll('.toc a')];
  if (tocLinks.length) {
    const headings = tocLinks.map((link) => document.getElementById(link.hash.slice(1)));
    const update = () => {
      const offset = 120;
      let current = 0;
      headings.forEach((heading, index) => {
        if (heading.getBoundingClientRect().top - offset <= 0) current = index;
      });
      if (innerHeight + scrollY >= document.body.scrollHeight - 4) current = headings.length - 1;
      tocLinks.forEach((link, index) => link.toggleAttribute('aria-current', index === current));
    };
    update();
    addEventListener('scroll', update, { passive: true });
  }

  /* Search */
  const dialog = document.getElementById('docs-search');
  const input = dialog.querySelector('.search__input');
  const results = dialog.querySelector('.search__results');
  const base = document.querySelector('.brand').getAttribute('href');
  let entries = null;

  const escape = (text) => text.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
  const highlight = (text, words) => {
    let out = escape(text);
    words.forEach((word) => {
      out = out.replace(new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'), '<mark>$1</mark>');
    });
    return out;
  };
  const snippet = (text, words) => {
    const lower = text.toLowerCase();
    const at = Math.max(0, Math.min(...words.map((word) => lower.indexOf(word)).filter((i) => i >= 0)) - 40);
    return (at > 0 ? '…' : '') + text.slice(at, at + 150) + (text.length > at + 150 ? '…' : '');
  };

  const render = () => {
    const words = input.value.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length || !entries) {
      results.innerHTML = '';
      return;
    }
    const matches = entries
      .map((entry) => {
        const title = `${entry.page} ${entry.section}`.toLowerCase();
        const text = entry.text.toLowerCase();
        if (!words.every((word) => title.includes(word) || text.includes(word))) return null;
        const score = words.reduce((sum, word) => sum + (entry.section.toLowerCase().includes(word) ? 3 : 0) + (entry.page.toLowerCase().includes(word) ? 2 : 0), 0);
        return { entry, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);
    if (!matches.length) {
      results.innerHTML = `<p class="search__empty">No results for “${escape(input.value.trim())}”</p>`;
      return;
    }
    results.innerHTML = `<ul>${matches
      .map(({ entry }) => `<li><a class="search__result" href="${entry.url}">
          <span class="search__page">${escape(entry.page)}</span>
          <span class="search__section">${highlight(entry.section || entry.page, words)}</span>
          <span class="search__text">${highlight(snippet(entry.text, words), words)}</span>
        </a></li>`)
      .join('')}</ul>`;
  };

  const openSearch = async () => {
    if (!dialog.open) dialog.showModal();
    input.focus();
    input.select();
    if (!entries) {
      try {
        entries = await (await fetch(`${base}search.json`)).json();
      } catch (error) {
        entries = [];
      }
      render();
    }
  };

  document.querySelector('.search-button').addEventListener('click', openSearch);
  dialog.querySelector('.search__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  input.addEventListener('input', render);
  results.addEventListener('click', (event) => {
    if (event.target.closest('a')) dialog.close();
  });

  // Arrow keys move between the field and the results; Enter opens the first result.
  dialog.addEventListener('keydown', (event) => {
    const links = [...results.querySelectorAll('a')];
    const index = links.indexOf(document.activeElement);
    if (event.key === 'ArrowDown' && links.length) {
      event.preventDefault();
      links[Math.min(index + 1, links.length - 1)].focus();
    } else if (event.key === 'ArrowUp' && index >= 0) {
      event.preventDefault();
      (index === 0 ? input : links[index - 1]).focus();
    } else if (event.key === 'Enter' && document.activeElement === input && links.length) {
      event.preventDefault();
      links[0].click();
    }
  });

  document.addEventListener('keydown', (event) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
      event.preventDefault();
      openSearch();
    }
  });

  // Show Ctrl K instead of ⌘K outside Apple devices.
  if (!/Mac|iPhone|iPad/.test(navigator.platform)) {
    document.querySelector('.search-button__key').textContent = 'Ctrl K';
  }
})();
