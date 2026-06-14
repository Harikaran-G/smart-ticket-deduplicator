// ==========================================================================
// STATE MANAGEMENT & CONSTANTS
// ==========================================================================
let allTickets = [];
let activeCategoryFilter = 'All';

// ==========================================================================
// DOM ELEMENT REFERENCES
// ==========================================================================
const ticketsContainer = document.getElementById('tickets-container');
const totalCountEl = document.getElementById('total-count');

// Stats Counters
const countBugEl = document.getElementById('count-bug');
const countFeatureEl = document.getElementById('count-feature');
const countQuestionEl = document.getElementById('count-question');
const barBug = document.querySelector('.bar-bug');
const barFeature = document.querySelector('.bar-feature');
const barQuestion = document.querySelector('.bar-question');

const countUrgentEl = document.getElementById('count-urgent');
const countHighEl = document.getElementById('count-high');
const countMediumEl = document.getElementById('count-medium');
const countLowEl = document.getElementById('count-low');

const statsSummaryText = document.getElementById('stats-summary-text');

// Buttons
const btnSeed = document.getElementById('btn-seed');
const btnClear = document.getElementById('btn-clear');
const btnOpenModal = document.getElementById('btn-open-modal');
const btnCloseModal = document.getElementById('btn-close-modal');
const modalOverlay = document.getElementById('modal-overlay');

// Form & Verification Panel
const newTicketForm = document.getElementById('new-ticket-form');
const btnSubmitTicket = document.getElementById('btn-submit-ticket');
const verificationPanel = document.getElementById('verification-panel');

// Deduplication Settings
const inputLimitN = document.getElementById('input-limit-n');
const valLimitN = document.getElementById('val-limit-n');
const inputThreshold = document.getElementById('input-threshold');
const valThreshold = document.getElementById('val-threshold');
const btnExportTraining = document.getElementById('btn-export-training');

// State Panels inside Verification Column
const resultsPlaceholder = document.querySelector('.results-placeholder');
const resultsLoadingState = document.getElementById('results-loading-state');
const resultsSuccessState = document.getElementById('results-success-state');
const resultsBlockedState = document.getElementById('results-blocked-state');

// Match Lists
const minorMatchesContainer = document.getElementById('minor-matches-container');
const minorMatchesList = document.getElementById('minor-matches-list');
const blockedMatchesList = document.getElementById('blocked-matches-list');

// ==========================================================================
// INITIALIZATION & LISTENERS
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  fetchTickets();
  fetchStats();
  setupEventListeners();
});

function setupEventListeners() {
  // Modal toggle
  btnOpenModal.addEventListener('click', openModal);
  btnCloseModal.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Category Filters
  const filterChips = document.querySelectorAll('.filter-chip');
  filterChips.forEach(chip => {
    chip.addEventListener('click', (e) => {
      filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeCategoryFilter = chip.getAttribute('data-category');
      renderTickets();
    });
  });

  // Seed & Clear
  btnSeed.addEventListener('click', seedDatabase);
  btnClear.addEventListener('click', clearDatabase);

  // Deduplication Settings
  inputLimitN.addEventListener('input', (e) => {
    valLimitN.textContent = e.target.value;
  });
  inputThreshold.addEventListener('input', (e) => {
    valThreshold.textContent = parseFloat(e.target.value).toFixed(2);
  });

  // Export Training Dataset
  btnExportTraining.addEventListener('click', handleExportTraining);

  // Form submit
  newTicketForm.addEventListener('submit', handleFormSubmit);
}

// ==========================================================================
// API & NETWORK CALLS
// ==========================================================================
async function fetchTickets() {
  try {
    const response = await fetch('/api/tickets');
    if (!response.ok) throw new Error('Failed to fetch tickets');
    allTickets = await response.ok ? await response.json() : [];
    renderTickets();
  } catch (err) {
    console.error('Error fetching tickets:', err);
    showToast('Failed to fetch tickets. Check server status.', 'error');
  }
}

async function fetchStats() {
  try {
    const response = await fetch('/api/stats');
    if (!response.ok) throw new Error('Failed to fetch stats');
    const stats = await response.json();
    updateStatsUI(stats);
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function seedDatabase() {
  setLoadingState(btnSeed, true, 'Seeding...');
  try {
    const response = await fetch('/api/seed', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to seed database');
    const data = await response.json();
    showToast(data.message || 'Database seeded successfully!');
    await fetchTickets();
    await fetchStats();
  } catch (err) {
    console.error(err);
    showToast('Failed to seed database.', 'error');
  } finally {
    setLoadingState(btnSeed, false, 'Seed Database');
  }
}

async function clearDatabase() {
  if (!confirm('Are you sure you want to clear all tickets in the database? This cannot be undone.')) {
    return;
  }
  setLoadingState(btnClear, true, 'Clearing...');
  try {
    const response = await fetch('/api/clear', { method: 'POST' });
    if (!response.ok) throw new Error('Failed to clear database');
    const data = await response.json();
    showToast(data.message || 'Database cleared.');
    await fetchTickets();
    await fetchStats();
  } catch (err) {
    console.error(err);
    showToast('Failed to clear database.', 'error');
  } finally {
    setLoadingState(btnClear, false, 'Clear DB');
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  
  const title = document.getElementById('ticket-title').value.trim();
  const description = document.getElementById('ticket-desc').value.trim();
  const category = document.getElementById('ticket-category').value;
  const priority = document.getElementById('ticket-priority').value;
  const status = 'Open'; // Default status (Initial Status field removed from UI)

  if (!title || !description) return;

  // Read current Deduplication Engine settings
  const limitN = parseInt(inputLimitN.value, 10) || 50;
  const threshold = parseFloat(inputThreshold.value) || 0.65;

  // Show loading in results column
  showVerificationState('loading');
  btnSubmitTicket.disabled = true;

  try {
    const response = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        category,
        priority,
        status,
        settings: { limitN, threshold }
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Server error processing ticket');
    }

    const result = await response.json();
    
    if (result.created) {
      // Success
      showVerificationState('success');
      renderMatches(result.duplicates, minorMatchesList);
      if (result.duplicates && result.duplicates.length > 0) {
        minorMatchesContainer.classList.remove('hidden');
      } else {
        minorMatchesContainer.classList.add('hidden');
      }
      
      // Reset form fields
      newTicketForm.reset();
      
      // Reload dashboard background tasks
      fetchTickets();
      fetchStats();
      showToast('Ticket created successfully!');
    } else {
      // Blocked as duplicate
      showVerificationState('blocked');
      renderMatches(result.duplicates, blockedMatchesList);
      showToast('Duplicate ticket blocked!', 'warning');
    }
  } catch (err) {
    console.error(err);
    showVerificationState('placeholder');
    showToast(err.message || 'Error processing ticket.', 'error');
  } finally {
    btnSubmitTicket.disabled = false;
  }
}

async function handleExportTraining() {
  setLoadingState(btnExportTraining, true, 'Exporting SFT...');
  try {
    const response = await fetch('/api/export-training');
    if (!response.ok) {
      let errMsg = 'Failed to export training dataset.';
      try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
      } catch (e) {
        // Response was not JSON (e.g. general server error)
      }
      throw new Error(errMsg);
    }

    // Trigger programmatic file download for SFT dataset
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gemini_sft_training_data.jsonl';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    showToast('SFT training dataset exported successfully!');
  } catch (err) {
    console.error('Error exporting SFT dataset:', err);
    showToast(err.message || 'Error exporting SFT dataset.', 'error');
  } finally {
    setLoadingState(btnExportTraining, false, 'Export SFT Dataset');
  }
}

// ==========================================================================
// RENDER & UI UTILITIES
// ==========================================================================

function renderTickets() {
  ticketsContainer.innerHTML = '';
  
  const filtered = allTickets.filter(ticket => {
    if (activeCategoryFilter === 'All') return true;
    return ticket.category === activeCategoryFilter;
  });

  statsSummaryText.textContent = `Showing ${filtered.length} of ${allTickets.length} tickets`;

  if (filtered.length === 0) {
    ticketsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📂</div>
        <h3>No ${activeCategoryFilter !== 'All' ? activeCategoryFilter + ' ' : ''}Tickets</h3>
        <p>No records fit this category query. Create a new ticket or clear filter to display more.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(ticket => {
    const card = document.createElement('div');
    card.className = 'ticket-card glass';
    card.innerHTML = `
      <div class="ticket-card-header">
        <h3>${escapeHTML(ticket.title)}</h3>
        <span class="ticket-badge category-${ticket.category.toLowerCase().replace(/\s+/g, '')}">${ticket.category}</span>
      </div>
      <p class="ticket-desc">${escapeHTML(ticket.description)}</p>
      <div class="ticket-footer">
        <div class="ticket-meta-left">
          <span class="status-chip status-${ticket.status.toLowerCase().replace(/\s+/g, '')}">${ticket.status}</span>
          <span class="priority-chip priority-${ticket.priority.toLowerCase().replace(/\s+/g, '')}">${ticket.priority}</span>
        </div>
        <span class="ticket-date">${formatDate(ticket.created_at)}</span>
      </div>
    `;
    ticketsContainer.appendChild(card);
  });
}

function updateStatsUI(stats) {
  totalCountEl.textContent = stats.total;

  // Category counts
  const bugCount = stats.categoryBreakdown.Bug || 0;
  const featureCount = stats.categoryBreakdown['Feature Request'] || 0;
  const questionCount = stats.categoryBreakdown.Question || 0;

  countBugEl.textContent = bugCount;
  countFeatureEl.textContent = featureCount;
  countQuestionEl.textContent = questionCount;

  // Set Progress bar percentages
  const maxCategory = Math.max(bugCount, featureCount, questionCount, 1);
  barBug.style.width = `${(bugCount / maxCategory) * 100}%`;
  barFeature.style.width = `${(featureCount / maxCategory) * 100}%`;
  barQuestion.style.width = `${(questionCount / maxCategory) * 100}%`;

  // Priorities
  countUrgentEl.textContent = stats.priorityBreakdown.Urgent || 0;
  countHighEl.textContent = stats.priorityBreakdown.High || 0;
  countMediumEl.textContent = stats.priorityBreakdown.Medium || 0;
  countLowEl.textContent = stats.priorityBreakdown.Low || 0;
}

function showVerificationState(state) {
  // Hide all panels
  resultsPlaceholder.classList.add('hidden');
  resultsLoadingState.classList.add('hidden');
  resultsSuccessState.classList.add('hidden');
  resultsBlockedState.classList.add('hidden');

  if (state === 'placeholder') {
    resultsPlaceholder.classList.remove('hidden');
  } else if (state === 'loading') {
    resultsLoadingState.classList.remove('hidden');
  } else if (state === 'success') {
    resultsSuccessState.classList.remove('hidden');
  } else if (state === 'blocked') {
    resultsBlockedState.classList.remove('hidden');
  }
}

function renderMatches(duplicates, targetContainer) {
  targetContainer.innerHTML = '';
  if (!duplicates || duplicates.length === 0) return;

  duplicates.forEach((dup, index) => {
    const percentage = Math.round(dup.similarity * 100);
    const strokeDash = `${percentage}, 100`;
    const verdictClass = dup.verdict.toLowerCase();

    const rankLabels = ['1st Candidate', '2nd Candidate', '3rd Candidate'];
    const rankLabel = rankLabels[index] || `${index + 1}th Candidate`;
    const rankClass = `badge-rank-${index + 1}`;

    const matchCard = document.createElement('div');
    matchCard.className = 'match-card glass';
    matchCard.innerHTML = `
      <div class="similarity-ring-wrapper">
        <svg class="similarity-ring-svg" viewBox="0 0 36 36">
          <path class="ring-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path class="ring-circle-fill ${verdictClass}" id="ring-fill-${targetContainer.id}-${index}" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <div class="ring-score-text">${percentage}%</div>
      </div>
      <div class="match-details">
        <div class="match-title-row">
          <h4 class="match-title" title="[#${dup.ticket.id}] ${escapeHTML(dup.ticket.title)}">[#${dup.ticket.id}] ${escapeHTML(dup.ticket.title)}</h4>
          <span class="match-rank-badge ${rankClass}">${rankLabel}</span>
        </div>
        <p class="match-reason">${escapeHTML(dup.reasoning)}</p>
        <div class="match-meta">
          <span>Verdict: <strong class="match-verdict-badge ${verdictClass}">${dup.verdict}</strong></span>
          <span>Confidence: ${dup.confidence}%</span>
        </div>
      </div>
    `;

    targetContainer.appendChild(matchCard);

    // Micro-animation for SVG ring drawing
    setTimeout(() => {
      const fillPath = document.getElementById(`ring-fill-${targetContainer.id}-${index}`);
      if (fillPath) {
        fillPath.setAttribute('stroke-dasharray', strokeDash);
      }
    }, 100 + (index * 150)); // stagger circle drawing animation
  });
}

// Modal open/close helpers
function openModal() {
  modalOverlay.classList.add('active');
  showVerificationState('placeholder');
  newTicketForm.reset();
}

function closeModal() {
  modalOverlay.classList.remove('active');
}

// Button loading state decorator
function setLoadingState(buttonEl, isLoading, text) {
  if (isLoading) {
    buttonEl.disabled = true;
    buttonEl.dataset.originalHtml = buttonEl.innerHTML;
    buttonEl.innerHTML = `
      <svg class="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite; width: 14px; height: 14px;">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"></circle>
        <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor"></path>
      </svg>
      ${text}
    `;
  } else {
    buttonEl.disabled = false;
    if (buttonEl.dataset.originalHtml) {
      buttonEl.innerHTML = buttonEl.dataset.originalHtml;
    }
  }
}

// Custom simple toast helper for sleek glass notifications
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast glass ${type}`;
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.right = '24px';
  toast.style.padding = '14px 20px';
  toast.style.borderRadius = 'var(--border-radius-md)';
  toast.style.boxShadow = 'var(--shadow-glow)';
  toast.style.zIndex = '1100';
  toast.style.fontSize = '13.5px';
  toast.style.fontWeight = '500';
  toast.style.border = '1px solid';
  toast.style.animation = 'fadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards';
  
  if (type === 'success') {
    toast.style.borderColor = 'hsla(142, 70%, 50%, 0.3)';
    toast.style.color = 'var(--color-question)';
    toast.style.background = 'hsla(142, 70%, 15%, 0.9)';
    message = '✓ ' + message;
  } else if (type === 'warning') {
    toast.style.borderColor = 'hsla(38, 95%, 55%, 0.3)';
    toast.style.color = 'var(--color-progress)';
    toast.style.background = 'hsla(38, 95%, 15%, 0.9)';
    message = '⚠ ' + message;
  } else {
    toast.style.borderColor = 'hsla(346, 80%, 55%, 0.3)';
    toast.style.color = 'var(--color-bug)';
    toast.style.background = 'hsla(346, 80%, 15%, 0.9)';
    message = '✕ ' + message;
  }
  
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Add CSS spin animation and fadeOut dynamically if not present
if (!document.getElementById('dynamic-animations')) {
  const style = document.createElement('style');
  style.id = 'dynamic-animations';
  style.textContent = `
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: translateY(0); }
      to { opacity: 0; transform: translateY(10px); }
    }
  `;
  document.head.appendChild(style);
}

// HTML Escaping utility
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// Date Formatting
function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch (e) {
    return dateStr || '';
  }
}
