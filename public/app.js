/* ============================================================
   SMART TICKET DEDUPLICATOR — Client-Side Application Logic
   ============================================================ */

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────
  const state = {
    currentView: 'dashboard',
    tickets: [],
    activeFilter: 'All',
  };

  // ── DOM References ─────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const dom = {
    // Sidebar
    sidebar: $('#sidebar'),
    sidebarToggle: $('#sidebar-toggle'),
    navDashboard: $('#nav-dashboard'),
    navNewTicket: $('#nav-new-ticket'),
    sidebarTicketCount: $('#sidebar-ticket-count'),
    sidebarCategoryBars: $('#sidebar-category-bars'),
    seedBtn: $('#seed-data-btn'),

    // Views
    dashboardView: $('#dashboard-view'),
    newTicketView: $('#new-ticket-view'),

    // Dashboard
    ticketCountBadge: $('#ticket-count-badge'),
    ticketsGrid: $('#tickets-grid'),
    emptyState: $('#empty-state'),
    filterBar: $('.filter-bar'),

    // Form
    ticketForm: $('#new-ticket-form'),
    titleInput: $('#ticket-title'),
    descriptionInput: $('#ticket-description'),
    categorySelect: $('#ticket-category'),
    prioritySelect: $('#ticket-priority'),
    submitBtn: $('#submit-ticket-btn'),

    // Results
    resultsPanel: $('#results-panel'),
    resultsLoading: $('#results-loading'),
    loadingStatusText: $('#loading-status-text'),
    resultsContent: $('#results-content'),
    recommendationBanner: $('#recommendation-banner'),
    recommendationIcon: $('#recommendation-icon'),
    recommendationTitle: $('#recommendation-title'),
    recommendationDesc: $('#recommendation-desc'),
    duplicatesSection: $('#duplicates-section'),
    duplicatesGrid: $('#duplicates-grid'),

    // Toast
    toastContainer: $('#toast-container'),
  };

  // ── Navigation ─────────────────────────────────────────────
  function switchView(view) {
    state.currentView = view;

    if (view === 'dashboard') {
      dom.dashboardView.classList.remove('view--hidden');
      dom.newTicketView.classList.add('view--hidden');
      dom.navDashboard.classList.add('sidebar__nav-item--active');
      dom.navDashboard.setAttribute('aria-current', 'page');
      dom.navNewTicket.classList.remove('sidebar__nav-item--active');
      dom.navNewTicket.removeAttribute('aria-current');
      loadTickets();
    } else {
      dom.newTicketView.classList.remove('view--hidden');
      dom.dashboardView.classList.add('view--hidden');
      dom.navNewTicket.classList.add('sidebar__nav-item--active');
      dom.navNewTicket.setAttribute('aria-current', 'page');
      dom.navDashboard.classList.remove('sidebar__nav-item--active');
      dom.navDashboard.removeAttribute('aria-current');
    }

    // Close mobile sidebar after nav
    dom.sidebar.classList.remove('sidebar--open');
    dom.sidebarToggle.setAttribute('aria-expanded', 'false');
  }

  // ── Dashboard ──────────────────────────────────────────────
  async function loadTickets() {
    try {
      const res = await fetch('/api/tickets');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      state.tickets = data.tickets || [];
      updateCounts(state.tickets.length);
      renderTickets(state.tickets);
      loadStats();
    } catch (err) {
      console.error('Failed to load tickets:', err);
      showToast('Failed to load tickets. Is the server running?', 'error');
    }
  }

  function updateCounts(count) {
    dom.ticketCountBadge.textContent = count;
    dom.sidebarTicketCount.textContent = count;
  }

  function renderTickets(tickets) {
    const filtered =
      state.activeFilter === 'All'
        ? tickets
        : tickets.filter((t) => t.category === state.activeFilter);

    dom.ticketsGrid.innerHTML = '';

    if (filtered.length === 0) {
      dom.emptyState.hidden = false;
      return;
    }

    dom.emptyState.hidden = true;

    filtered.forEach((ticket, idx) => {
      const card = createElement('article', 'ticket-card glass-card');
      card.style.animationDelay = `${idx * 50}ms`;

      const priorityClass = ticket.priority
        ? ticket.priority.toLowerCase()
        : 'medium';
      const categoryClass = getCategoryClass(ticket.category);

      card.innerHTML = `
        <div class="ticket-card__header">
          <h3 class="ticket-card__title">${escapeHtml(ticket.title)}</h3>
          <span class="ticket-card__priority">
            <span class="priority-dot priority-dot--${priorityClass}" aria-hidden="true"></span>
            ${escapeHtml(ticket.priority || 'Medium')}
          </span>
        </div>
        <p class="ticket-card__description">${escapeHtml(truncate(ticket.description, 120))}</p>
        <div class="ticket-card__footer">
          <span class="category-badge category-badge--${categoryClass}">${escapeHtml(ticket.category)}</span>
          <time class="ticket-card__date" datetime="${ticket.created_at || ''}">${formatDate(ticket.created_at)}</time>
        </div>
      `;

      dom.ticketsGrid.appendChild(card);
    });
  }

  function filterTickets(category) {
    state.activeFilter = category;

    // Update pill active states
    dom.filterBar.querySelectorAll('.filter-pill').forEach((pill) => {
      if (pill.dataset.filter === category) {
        pill.classList.add('filter-pill--active');
      } else {
        pill.classList.remove('filter-pill--active');
      }
    });

    renderTickets(state.tickets);
  }

  async function loadStats() {
    try {
      const res = await fetch('/api/stats');
      if (!res.ok) return;
      const stats = await res.json();

      // Render category bars
      dom.sidebarCategoryBars.innerHTML = '';
      const total = stats.total || 1;
      const categories = stats.byCategory || [];

      categories.forEach((cat) => {
        const pct = Math.round((cat.count / total) * 100);
        const classSlug = getCategoryClass(cat.category);
        const bar = createElement('div', 'stat-bar');
        bar.innerHTML = `
          <span class="stat-bar__label">${escapeHtml(cat.category)}</span>
          <div class="stat-bar__track">
            <div class="stat-bar__fill stat-bar__fill--${classSlug}" style="width: ${pct}%"></div>
          </div>
          <span class="stat-bar__count">${cat.count}</span>
        `;
        dom.sidebarCategoryBars.appendChild(bar);
      });
    } catch {
      // Stats are non-critical, silently ignore
    }
  }

  // ── New Ticket ─────────────────────────────────────────────
  async function handleSubmitTicket(e) {
    e.preventDefault();

    // Validate
    const title = dom.titleInput.value.trim();
    const description = dom.descriptionInput.value.trim();
    const category = dom.categorySelect.value;
    const priority = dom.prioritySelect.value;

    let valid = true;

    if (!title) {
      $('#ticket-title-error').hidden = false;
      valid = false;
    } else {
      $('#ticket-title-error').hidden = true;
    }

    if (!description) {
      $('#ticket-description-error').hidden = false;
      valid = false;
    } else {
      $('#ticket-description-error').hidden = true;
    }

    if (!category || !priority) {
      showToast('Please select both category and priority.', 'error');
      valid = false;
    }

    if (!valid) return;

    // Show loading
    showLoading();
    dom.submitBtn.disabled = true;

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, category, priority }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      hideLoading();
      renderResults(data);

      // Clear form
      dom.ticketForm.reset();
      showToast('Ticket created successfully!', 'success');
    } catch (err) {
      console.error('Failed to submit ticket:', err);
      hideLoading();
      showToast('Failed to create ticket. Please try again.', 'error');
    } finally {
      dom.submitBtn.disabled = false;
    }
  }

  function showLoading() {
    dom.resultsPanel.hidden = false;
    dom.resultsLoading.hidden = false;
    dom.resultsContent.hidden = true;
    dom.loadingStatusText.textContent = 'Analyzing ticket for duplicates…';
  }

  function hideLoading() {
    dom.resultsLoading.hidden = true;
  }

  function renderResults(data) {
    dom.resultsContent.hidden = false;

    // ── Recommendation Banner
    const rec = data.recommendation || 'NEW_UNIQUE';
    dom.recommendationBanner.className = 'recommendation-banner';
    dom.duplicatesSection.hidden = true;

    if (rec === 'DUPLICATE_FOUND') {
      dom.recommendationBanner.classList.add('recommendation-banner--duplicate');
      dom.recommendationIcon.textContent = '🔴';
      dom.recommendationTitle.textContent = 'Duplicate Found';
      dom.recommendationDesc.textContent =
        'This ticket appears to be a duplicate of an existing ticket.';
    } else if (rec === 'POSSIBLE_DUPLICATE') {
      dom.recommendationBanner.classList.add('recommendation-banner--possible');
      dom.recommendationIcon.textContent = '🟡';
      dom.recommendationTitle.textContent = 'Possible Duplicate';
      dom.recommendationDesc.textContent =
        'This ticket is similar to existing tickets. Please review the candidates below.';
    } else {
      dom.recommendationBanner.classList.add('recommendation-banner--unique');
      dom.recommendationIcon.textContent = '🟢';
      dom.recommendationTitle.textContent = 'New Unique Ticket';
      dom.recommendationDesc.textContent =
        'No duplicates found. This ticket has been created successfully.';
    }

    // ── Duplicate Candidates
    const duplicates = data.duplicates || [];
    if (duplicates.length > 0) {
      dom.duplicatesSection.hidden = false;
      dom.duplicatesGrid.innerHTML = '';

      duplicates.forEach((dup, idx) => {
        const card = createElement('div', 'duplicate-card');
        card.style.animationDelay = `${(idx + 1) * 150}ms`;

        // Similarity ring
        const ringContainer = createElement('div', 'similarity-ring');
        const ringSvg = createSimilarityRing(dup.similarity || 0);
        const ringLabel = createElement('span', 'similarity-ring__label', 'Similarity');
        ringContainer.appendChild(ringSvg);
        ringContainer.appendChild(ringLabel);

        // Info section
        const infoSection = createElement('div', 'duplicate-card__info');
        const catClass = getCategoryClass(dup.category);
        const priClass = (dup.priority || 'medium').toLowerCase();
        infoSection.innerHTML = `
          <h4 class="duplicate-card__title">${escapeHtml(dup.title || 'Untitled')}</h4>
          <p class="duplicate-card__description">${escapeHtml(dup.description || '')}</p>
          <div class="duplicate-card__meta">
            <span class="category-badge category-badge--${catClass}">${escapeHtml(dup.category || 'Unknown')}</span>
            <span class="ticket-card__priority">
              <span class="priority-dot priority-dot--${priClass}" aria-hidden="true"></span>
              ${escapeHtml(dup.priority || 'Medium')}
            </span>
          </div>
          ${
            dup.verdict && dup.verdict.reasoning
              ? `<p class="duplicate-card__reasoning">"${escapeHtml(dup.verdict.reasoning)}"</p>`
              : ''
          }
        `;

        // Verdict section
        const verdictSection = createElement('div', 'duplicate-card__verdict');
        const verdict = dup.verdict || {};
        const verdictBadge = getVerdictBadge(verdict.verdict);
        verdictSection.appendChild(verdictBadge);

        if (typeof verdict.confidence === 'number') {
          const confidence = createElement(
            'span',
            'verdict-confidence',
            `${verdict.confidence}% confident`
          );
          verdictSection.appendChild(confidence);
        }

        card.appendChild(ringContainer);
        card.appendChild(infoSection);
        card.appendChild(verdictSection);

        dom.duplicatesGrid.appendChild(card);

        // Trigger ring animation after paint with stagger
        requestAnimationFrame(() => {
          setTimeout(() => {
            const fg = card.querySelector('.similarity-ring__fg');
            if (fg) {
              const score = dup.similarity || 0;
              const circumference = 2 * Math.PI * 38;
              const filled = score * circumference;
              fg.style.strokeDasharray = `${filled} ${circumference}`;
            }
          }, idx * 200);
        });
      });
    }
  }

  function createSimilarityRing(score) {
    const ns = 'http://www.w3.org/2000/svg';
    const circumference = 2 * Math.PI * 38; // radius = 38
    const pct = Math.round(score * 100);

    // Determine ring color class
    let colorClass = 'similarity-ring__fg--amber';
    if (score >= 0.85) colorClass = 'similarity-ring__fg--green';
    else if (score >= 0.7) colorClass = 'similarity-ring__fg--blue';

    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('class', 'similarity-ring__svg');
    svg.setAttribute('viewBox', '0 0 88 88');

    // Background circle
    const bgCircle = document.createElementNS(ns, 'circle');
    bgCircle.setAttribute('class', 'similarity-ring__bg');
    bgCircle.setAttribute('cx', '44');
    bgCircle.setAttribute('cy', '44');
    bgCircle.setAttribute('r', '38');

    // Foreground circle — starts empty, animated via JS
    const fgCircle = document.createElementNS(ns, 'circle');
    fgCircle.setAttribute('class', `similarity-ring__fg ${colorClass}`);
    fgCircle.setAttribute('cx', '44');
    fgCircle.setAttribute('cy', '44');
    fgCircle.setAttribute('r', '38');
    fgCircle.style.strokeDasharray = `0 ${circumference}`;

    // Score text
    const text = document.createElementNS(ns, 'text');
    text.setAttribute('class', 'similarity-ring__text');
    text.setAttribute('x', '44');
    text.setAttribute('y', '44');
    text.textContent = `${pct}%`;

    svg.appendChild(bgCircle);
    svg.appendChild(fgCircle);
    svg.appendChild(text);

    return svg;
  }

  function getVerdictBadge(verdict) {
    const badge = createElement('span', 'verdict-badge');

    switch (verdict) {
      case 'YES':
        badge.classList.add('verdict-badge--yes');
        badge.textContent = 'Duplicate';
        break;
      case 'LIKELY':
        badge.classList.add('verdict-badge--likely');
        badge.textContent = 'Likely Duplicate';
        break;
      case 'NO':
        badge.classList.add('verdict-badge--no');
        badge.textContent = 'Not Duplicate';
        break;
      default:
        badge.classList.add('verdict-badge--unknown');
        badge.textContent = 'Unknown';
        break;
    }

    return badge;
  }

  // ── Seed Data ──────────────────────────────────────────────
  async function seedData() {
    dom.seedBtn.disabled = true;
    dom.seedBtn.textContent = 'Seeding…';

    try {
      const res = await fetch('/api/seed', { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      showToast('Demo data seeded successfully!', 'success');

      if (state.currentView === 'dashboard') {
        await loadTickets();
      }
    } catch (err) {
      console.error('Seed failed:', err);
      showToast('Failed to seed data. Please try again.', 'error');
    } finally {
      dom.seedBtn.disabled = false;
      dom.seedBtn.innerHTML = `
        <svg class="btn__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3v18"/>
          <path d="M8 7c0 0 1.5-4 4-4s4 4 4 4"/>
          <path d="M6 13c0 0 2-3 6-3s6 3 6 3"/>
          <path d="M4 19c0 0 3-3 8-3s8 3 8 3"/>
        </svg>
        Seed Demo Data
      `;
    }
  }

  // ── Toast Notifications ────────────────────────────────────
  function showToast(message, type = 'info') {
    const icons = {
      success: '✓',
      error: '✕',
      info: 'ℹ',
    };

    const toast = createElement('div', `toast toast--${type}`);
    toast.innerHTML = `
      <span class="toast__icon" aria-hidden="true">${icons[type] || icons.info}</span>
      <span>${escapeHtml(message)}</span>
    `;

    dom.toastContainer.appendChild(toast);

    // Auto-dismiss after 4s
    const timer = setTimeout(() => removeToast(toast), 4000);

    // Click to dismiss
    toast.addEventListener('click', () => {
      clearTimeout(timer);
      removeToast(toast);
    });
  }

  function removeToast(toast) {
    toast.classList.add('toast--removing');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }

  // ── Utility Functions ──────────────────────────────────────
  function createElement(tag, className, innerHTML) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (innerHTML !== undefined) el.innerHTML = innerHTML;
    return el;
  }

  function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  }

  function truncate(str, len) {
    if (!str) return '';
    if (str.length <= len) return str;
    return str.slice(0, len).trimEnd() + '…';
  }

  function getCategoryClass(category) {
    const map = {
      Bug: 'bug',
      'Feature Request': 'feature',
      Question: 'question',
    };
    return map[category] || 'question';
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Event Listeners ────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    // Sidebar nav
    dom.navDashboard.addEventListener('click', () => switchView('dashboard'));
    dom.navNewTicket.addEventListener('click', () => switchView('new-ticket'));

    // Mobile sidebar toggle
    dom.sidebarToggle.addEventListener('click', () => {
      const isOpen = dom.sidebar.classList.toggle('sidebar--open');
      dom.sidebarToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close sidebar on click outside (mobile)
    document.addEventListener('click', (e) => {
      if (
        dom.sidebar.classList.contains('sidebar--open') &&
        !dom.sidebar.contains(e.target) &&
        !dom.sidebarToggle.contains(e.target)
      ) {
        dom.sidebar.classList.remove('sidebar--open');
        dom.sidebarToggle.setAttribute('aria-expanded', 'false');
      }
    });

    // Filter pills
    dom.filterBar.addEventListener('click', (e) => {
      const pill = e.target.closest('.filter-pill');
      if (pill && pill.dataset.filter) {
        filterTickets(pill.dataset.filter);
      }
    });

    // Form submit
    dom.ticketForm.addEventListener('submit', handleSubmitTicket);

    // Seed button
    dom.seedBtn.addEventListener('click', seedData);

    // Initial load
    loadTickets();
  });
})();
