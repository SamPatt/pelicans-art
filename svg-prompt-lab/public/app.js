/* ============================================
   SVG Prompt Lab - Frontend Application
   ============================================ */

const API = '';
const COMMUNITY_API_URL = 'https://pelicans-community.sam-cloudflare-d20.workers.dev/api/community';

// ---- State ----
const state = {
  templates: [],
  models: [],
  selectedTemplate: null,
  selectedModels: new Set(),
  selectedExamples: [],
  references: [],
  currentExperiment: null,
  experiments: [],
  galleryFilter: 'all',
  gallerySort: 'index',
  eventSource: null
};

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  setupTabs();
  setupTemperatureSlider();
  setupFilterButtons();
  setupModalClose();
  setupConfirmDialog();

  loadTemplates();
  loadModels();

  // Keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
    if (e.key === '1') switchTab('builder');
    if (e.key === '2') switchTab('gallery');
    if (e.key === '3') switchTab('history');
  });
});

// ---- Tabs ----
function setupTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));

  if (tab === 'history') loadHistory();
  if (tab === 'gallery') refreshGalleryExperimentList();
}

// ---- Temperature slider ----
function setupTemperatureSlider() {
  const slider = document.getElementById('cfg-temp');
  const val = document.getElementById('cfg-temp-val');
  slider.addEventListener('input', () => { val.textContent = slider.value; });
}

// ---- API Helpers ----
async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'Request failed');
  }
  return res.json();
}

// ---- Templates ----
async function loadTemplates() {
  try {
    state.templates = await api('/api/templates');
    renderTemplateSelect();
  } catch (err) {
    console.error('Failed to load templates:', err);
  }
}

function renderTemplateSelect() {
  const sel = document.getElementById('template-select');
  sel.innerHTML = '<option value="">-- Select template --</option>';
  for (const t of state.templates) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = `${t.name} (${t.assetType})`;
    sel.appendChild(opt);
  }
  sel.onchange = () => selectTemplate(sel.value);
}

async function selectTemplate(id) {
  const editor = document.getElementById('template-editor');
  if (!id) {
    state.selectedTemplate = null;
    editor.classList.add('hidden');
    updateMatrix();
    return;
  }

  try {
    const template = await api(`/api/templates/${id}`);
    state.selectedTemplate = template;
    editor.classList.remove('hidden');

    document.getElementById('sys-prompt').value = template.systemPrompt || '';
    document.getElementById('user-prompt').value = template.userPromptTemplate || '';
    updateCharCount();

    renderVariables(template.variables || {});
    loadReferences(template.assetType);
    updateMatrix();
  } catch (err) {
    console.error('Failed to load template:', err);
  }
}

function updateCharCount() {
  const count = document.getElementById('sys-prompt').value.length;
  document.getElementById('sys-prompt-count').textContent = `${count} chars`;
}

document.getElementById('sys-prompt')?.addEventListener('input', updateCharCount);

// ---- Variables Editor ----
function renderVariables(variables) {
  const container = document.getElementById('variables-editor');
  container.innerHTML = '';

  for (const [key, config] of Object.entries(variables)) {
    const group = document.createElement('div');
    group.className = 'var-group';
    group.dataset.varKey = key;

    const values = config.values || [];

    group.innerHTML = `
      <div class="var-group-header">
        <span class="var-name">{{${key}}}</span>
        <span class="var-desc">${config.description || ''}</span>
      </div>
      <div class="var-tags" data-key="${key}">
        ${values.map(v => `
          <span class="var-tag">
            <span class="var-tag-text">${escapeHtml(v)}</span>
            <button class="var-tag-remove" data-key="${key}" data-val="${escapeHtml(v)}">&times;</button>
          </span>
        `).join('')}
        <input type="text" class="var-tag-input" placeholder="Add value..." data-key="${key}">
      </div>
    `;

    container.appendChild(group);
  }

  // Event delegation for tag removal
  container.addEventListener('click', e => {
    if (e.target.classList.contains('var-tag-remove')) {
      const key = e.target.dataset.key;
      const val = e.target.dataset.val;
      removeVariableValue(key, val);
    }
  });

  // Enter to add tag
  container.addEventListener('keydown', e => {
    if (e.target.classList.contains('var-tag-input') && e.key === 'Enter') {
      e.preventDefault();
      const key = e.target.dataset.key;
      const val = e.target.value.trim();
      if (val) {
        addVariableValue(key, val);
        e.target.value = '';
      }
    }
  });
}

function addVariableValue(key, value) {
  if (!state.selectedTemplate?.variables?.[key]) return;
  const vals = state.selectedTemplate.variables[key].values || [];
  if (!vals.includes(value)) {
    vals.push(value);
    state.selectedTemplate.variables[key].values = vals;
    renderVariables(state.selectedTemplate.variables);
    updateMatrix();
  }
}

function removeVariableValue(key, value) {
  if (!state.selectedTemplate?.variables?.[key]) return;
  const vals = state.selectedTemplate.variables[key].values || [];
  state.selectedTemplate.variables[key].values = vals.filter(v => v !== value);
  renderVariables(state.selectedTemplate.variables);
  updateMatrix();
}

// ---- References / Examples ----
async function loadReferences(assetType) {
  const grid = document.getElementById('examples-grid');
  grid.innerHTML = '<div class="loading-placeholder">Loading references...</div>';
  state.selectedExamples = [];

  try {
    state.references = await api(`/api/references/${assetType}s`);
    renderExamples();
  } catch {
    state.references = [];
    grid.innerHTML = '<div class="loading-placeholder">No references found.</div>';
  }
}

function renderExamples() {
  const grid = document.getElementById('examples-grid');
  grid.innerHTML = '';

  if (state.references.length === 0) {
    grid.innerHTML = '<div class="loading-placeholder">No references available.</div>';
    return;
  }

  for (const ref of state.references) {
    const card = document.createElement('div');
    card.className = 'example-card';
    card.dataset.name = ref.name;
    card.innerHTML = `${sanitizeSvg(ref.svg)}<div class="example-card-name">${escapeHtml(ref.name)}</div>`;
    card.addEventListener('click', () => toggleExample(ref, card));
    grid.appendChild(card);
  }

  updateExampleCount();
}

function toggleExample(ref, card) {
  const idx = state.selectedExamples.findIndex(e => e.name === ref.name);
  if (idx >= 0) {
    state.selectedExamples.splice(idx, 1);
    card.classList.remove('selected');
  } else {
    state.selectedExamples.push(ref);
    card.classList.add('selected');
  }
  updateExampleCount();
}

function updateExampleCount() {
  document.getElementById('example-count').textContent = `${state.selectedExamples.length} selected`;
}

// ---- Models ----
async function loadModels() {
  try {
    state.models = await api('/api/models');
    renderModels();
  } catch (err) {
    console.error('Failed to load models:', err);
    document.getElementById('models-list').innerHTML = '<div class="loading-placeholder">Failed to load models. Check API keys.</div>';
  }
}

function renderModels() {
  const container = document.getElementById('models-list');
  container.innerHTML = '';

  // Group by backend
  const groups = {};
  for (const m of state.models) {
    const backend = m.backend || 'unknown';
    if (!groups[backend]) groups[backend] = [];
    groups[backend].push(m);
  }

  for (const [backend, models] of Object.entries(groups)) {
    const label = document.createElement('div');
    label.className = 'model-group-label';
    label.textContent = backend;
    container.appendChild(label);

    for (const m of models) {
      const item = document.createElement('label');
      item.className = 'model-item';
      item.dataset.search = m.name.toLowerCase();
      item.innerHTML = `
        <input type="checkbox" value="${m.id}" data-backend="${m.backend}">
        <span class="model-item-name" title="${m.id}">${m.name}</span>
      `;

      item.querySelector('input').addEventListener('change', e => {
        if (e.target.checked) {
          state.selectedModels.add(`${m.backend}||${m.id}`);
        } else {
          state.selectedModels.delete(`${m.backend}||${m.id}`);
        }
        updateMatrix();
      });

      container.appendChild(item);
    }
  }

  // Search filtering
  document.getElementById('model-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    container.querySelectorAll('.model-item').forEach(item => {
      item.classList.toggle('model-item-hidden', q && !item.dataset.search.includes(q));
    });
  });
}

// ---- Matrix Preview ----
function updateMatrix() {
  const t = state.selectedTemplate;
  let combos = 1;

  if (t?.variables) {
    for (const config of Object.values(t.variables)) {
      const count = (config.values || []).length;
      if (count > 0) combos *= count;
    }
  }

  const models = state.selectedModels.size;
  const total = combos * models;

  document.getElementById('matrix-preview').innerHTML = `
    <span class="matrix-formula">${combos} combo${combos !== 1 ? 's' : ''} &times; ${models} model${models !== 1 ? 's' : ''} = <strong>${total} cell${total !== 1 ? 's' : ''}</strong></span>
  `;

  document.getElementById('btn-run').disabled = !t || models === 0 || total === 0;
}

// ---- Save Template ----
document.getElementById('btn-save-template')?.addEventListener('click', async () => {
  const t = state.selectedTemplate;
  if (!t) return;

  t.systemPrompt = document.getElementById('sys-prompt').value;
  t.userPromptTemplate = document.getElementById('user-prompt').value;

  try {
    await api(`/api/templates/${t.id}`, { method: 'PUT', body: t });
    setStatus('Template saved', 'ready');
  } catch (err) {
    setStatus('Save failed: ' + err.message, 'error');
  }
});

// ---- New Template ----
document.getElementById('btn-new-template')?.addEventListener('click', async () => {
  const name = prompt('Template name:');
  if (!name) return;

  const assetType = prompt('Asset type (sprite/background/prop):', 'sprite');
  if (!assetType) return;

  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  try {
    await api('/api/templates', {
      method: 'POST',
      body: {
        id,
        name,
        assetType,
        systemPrompt: '',
        userPromptTemplate: '{{description}}',
        variables: {
          description: { description: 'What to generate', values: [] }
        },
        examples: { count: 0, refs: [] },
        defaults: { temperature: 0.7, maxTokens: 4096 }
      }
    });
    await loadTemplates();
    document.getElementById('template-select').value = id;
    selectTemplate(id);
  } catch (err) {
    alert('Failed to create template: ' + err.message);
  }
});

// ---- Run Experiment ----
document.getElementById('btn-run')?.addEventListener('click', runExperiment);

async function runExperiment() {
  const t = state.selectedTemplate;
  if (!t || state.selectedModels.size === 0) return;

  const models = Array.from(state.selectedModels).map(key => {
    const [backend, model] = key.split('||', 2);
    return { backend, model };
  });

  const config = {
    name: document.getElementById('exp-name').value || `${t.name} - ${new Date().toLocaleString()}`,
    templateIds: [t.id],
    models,
    variableOverrides: {},
    exampleCount: state.selectedExamples.length,
    exampleRefs: state.selectedExamples.map(e => ({ name: e.name, svg: e.svg })),
    temperature: Number.isFinite(parseFloat(document.getElementById('cfg-temp').value))
      ? parseFloat(document.getElementById('cfg-temp').value) : 0.7,
    maxTokens: Number.isFinite(parseInt(document.getElementById('cfg-tokens').value, 10))
      ? parseInt(document.getElementById('cfg-tokens').value, 10) : 4096,
    concurrency: Number.isFinite(parseInt(document.getElementById('cfg-concurrency').value, 10))
      ? parseInt(document.getElementById('cfg-concurrency').value, 10) : 3
  };

  // Update template prompts in case they were edited
  const updatedTemplate = { ...t };
  updatedTemplate.systemPrompt = document.getElementById('sys-prompt').value;
  updatedTemplate.userPromptTemplate = document.getElementById('user-prompt').value;

  // Save the updated template first
  try {
    await api(`/api/templates/${t.id}`, { method: 'PUT', body: updatedTemplate });
  } catch { /* continue anyway */ }

  const runBtn = document.getElementById('btn-run');
  runBtn.disabled = true;
  runBtn.querySelector('.btn-run-text').textContent = 'Running...';

  const progress = document.getElementById('run-progress');
  progress.classList.remove('hidden');
  setStatus('Running experiment...', 'running');

  try {
    const result = await api('/api/experiments', { method: 'POST', body: config });
    state.currentExperiment = result.id;

    // Connect to SSE for progress
    connectProgress(result.id);
  } catch (err) {
    runBtn.disabled = false;
    runBtn.querySelector('.btn-run-text').textContent = 'Run Experiment';
    progress.classList.add('hidden');
    setStatus('Failed: ' + err.message, 'error');
  }
}

function connectProgress(expId) {
  if (state.eventSource) {
    state.eventSource.close();
  }

  const es = new EventSource(`${API}/api/experiments/${expId}/progress`);
  state.eventSource = es;

  es.onmessage = e => {
    const data = JSON.parse(e.data);

    if (data.type === 'cell-complete') {
      const pct = Math.round((data.completed / data.total) * 100);
      document.getElementById('progress-fill').style.width = `${pct}%`;
      document.getElementById('progress-text').textContent = `${data.completed} / ${data.total}`;
      document.getElementById('progress-percent').textContent = `${pct}%`;
    }

    if (data.type === 'complete' || data.type === 'error' || data.type === 'no-emitter') {
      es.close();
      state.eventSource = null;

      const runBtn = document.getElementById('btn-run');
      runBtn.disabled = false;
      runBtn.querySelector('.btn-run-text').textContent = 'Run Experiment';
      document.getElementById('run-progress').classList.add('hidden');

      if (data.type === 'error') {
        setStatus('Experiment failed: ' + data.error, 'error');
      } else {
        setStatus('Experiment complete', 'ready');
        // Auto-switch to gallery
        switchTab('gallery');
        loadExperimentInGallery(expId);
      }
    }
  };

  es.onerror = () => {
    es.close();
    state.eventSource = null;
    // Try to load the experiment anyway (it may have completed)
    setTimeout(() => {
      const runBtn = document.getElementById('btn-run');
      runBtn.disabled = false;
      runBtn.querySelector('.btn-run-text').textContent = 'Run Experiment';
      document.getElementById('run-progress').classList.add('hidden');
      setStatus('Connection lost, experiment may still be running', 'error');
    }, 1000);
  };
}

// ---- Gallery ----
function setupFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.galleryFilter = btn.dataset.filter;
      renderGallery();
    });
  });

  document.getElementById('gallery-sort')?.addEventListener('change', e => {
    state.gallerySort = e.target.value;
    renderGallery();
  });

  document.getElementById('gallery-experiment')?.addEventListener('change', e => {
    if (e.target.value) {
      loadExperimentInGallery(e.target.value);
    } else {
      state.currentExperiment = null;
      renderGallery();
    }
  });
}

async function refreshGalleryExperimentList() {
  try {
    state.experiments = await api('/api/experiments');
    const sel = document.getElementById('gallery-experiment');
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- Select experiment --</option>';
    // "All" option to show results from every experiment
    const totalResults = state.experiments.reduce((sum, e) => sum + (e.summary?.completed || 0), 0);
    if (state.experiments.length > 1) {
      const allOpt = document.createElement('option');
      allOpt.value = '__all__';
      allOpt.textContent = `All experiments (${totalResults} results)`;
      sel.appendChild(allOpt);
    }
    for (const exp of state.experiments) {
      const opt = document.createElement('option');
      opt.value = exp.id;
      opt.textContent = `${exp.name} (${exp.summary?.completed || 0} results)`;
      sel.appendChild(opt);
    }
    if (currentVal) sel.value = currentVal;
  } catch (err) {
    console.error('Failed to load experiments:', err);
  }
}

async function loadExperimentInGallery(expId) {
  try {
    if (expId === '__all__') {
      await loadAllExperiments();
    } else {
      state.currentExperiment = await api(`/api/experiments/${expId}`);
    }
    document.getElementById('gallery-experiment').value = expId;
    renderGallery();
  } catch (err) {
    console.error('Failed to load experiment:', err);
  }
}

async function loadAllExperiments() {
  const allResults = [];
  for (const expSummary of state.experiments) {
    try {
      const exp = await api(`/api/experiments/${expSummary.id}`);
      if (exp.results) {
        for (const r of exp.results) {
          if (r) {
            // Tag each result with its experiment for context
            r._experimentId = exp.id;
            r._experimentName = exp.name;
            allResults.push(r);
          }
        }
      }
    } catch { /* skip failed loads */ }
  }
  // Re-index so gallery card interactions work
  allResults.forEach((r, i) => { r.index = i; });
  state.currentExperiment = {
    id: '__all__',
    name: 'All experiments',
    results: allResults,
    summary: {
      total: allResults.length,
      completed: allResults.length,
      failed: 0,
      validSvg: allResults.filter(r => r.validation?.valid).length
    }
  };
}

function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  const exp = state.currentExperiment;

  if (!exp || !exp.results) {
    grid.innerHTML = '<div class="empty-state">Select an experiment from the dropdown or run one from the Builder tab.</div>';
    return;
  }

  let results = [...exp.results].filter(Boolean);

  // Filter
  if (state.galleryFilter === 'valid') {
    results = results.filter(r => r.validation?.valid);
  } else if (state.galleryFilter === 'invalid') {
    results = results.filter(r => !r.validation?.valid);
  } else if (state.galleryFilter === 'winners') {
    results = results.filter(r => r.rating?.winner);
  }

  // Sort
  if (state.gallerySort === 'rating') {
    results.sort((a, b) => (b.rating?.score || 0) - (a.rating?.score || 0));
  } else if (state.gallerySort === 'model') {
    results.sort((a, b) => (a.model || '').localeCompare(b.model || ''));
  } else if (state.gallerySort === 'latency') {
    results.sort((a, b) => (a.latencyMs || 0) - (b.latencyMs || 0));
  } else {
    results.sort((a, b) => (a.index || 0) - (b.index || 0));
  }

  grid.innerHTML = '';

  if (results.length === 0) {
    grid.innerHTML = '<div class="empty-state">No results match the current filter.</div>';
    return;
  }

  for (const result of results) {
    // When viewing "All", use the result's source experiment ID for API calls
    const cardExpId = result._experimentId || exp.id;
    grid.appendChild(createResultCard(result, cardExpId, exp.id === '__all__'));
  }
}

function createResultCard(result, expId, showExpName = false) {
  const card = document.createElement('div');
  card.className = 'result-card';

  const svgHtml = result.response?.svg
    ? sanitizeSvg(result.response.svg) || '<span class="no-svg">Invalid SVG</span>'
    : '<span class="no-svg">No SVG</span>';

  const validationBadge = getValidationBadge(result.validation);
  const modelShort = (result.model || '').split('/').pop();
  const vars = result.variableValues
    ? Object.values(result.variableValues).join(', ')
    : '';
  const expLabel = showExpName && result._experimentName
    ? `<div class="result-card-exp" title="${escapeHtml(result._experimentName)}">${escapeHtml(result._experimentName)}</div>`
    : '';

  const rating = result.rating || {};

  card.innerHTML = `
    <div class="result-card-svg">${svgHtml}</div>
    <div class="result-card-info">
      ${expLabel}
      <div class="result-card-model" title="${escapeHtml(result.model || '')}">${escapeHtml(modelShort)}</div>
      ${vars ? `<div class="result-card-vars" title="${escapeHtml(vars)}">${escapeHtml(vars)}</div>` : ''}
    </div>
    <div class="result-card-footer">
      <div class="result-card-footer-left">
        ${validationBadge}
        <span class="latency-text">${result.latencyMs ? `${(result.latencyMs / 1000).toFixed(1)}s` : '-'}</span>
      </div>
      <div class="result-card-footer-right" style="display:flex;align-items:center;gap:4px;">
        <div class="star-rating" data-exp="${expId}" data-idx="${result.index}">
          ${[1,2,3,4,5].map(i => `<button class="star-btn${(rating.score || 0) >= i ? ' filled' : ''}" data-score="${i}">&#9733;</button>`).join('')}
        </div>
        <button class="winner-btn${rating.winner ? ' active' : ''}" data-exp="${expId}" data-idx="${result.index}" title="Mark as winner">&#127942;</button>
      </div>
    </div>
  `;

  // Star rating click
  card.querySelectorAll('.star-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const score = parseInt(btn.dataset.score, 10);
      const currentRating = result.rating || {};
      const newRating = { ...currentRating, score };

      try {
        await api(`/api/experiments/${expId}/results/${result.index}/rating`, {
          method: 'PUT',
          body: newRating
        });
        result.rating = newRating;
        // Update stars visually
        card.querySelectorAll('.star-btn').forEach((s, i) => {
          s.classList.toggle('filled', i < score);
        });
      } catch (err) {
        console.error('Failed to rate:', err);
      }
    });
  });

  // Winner toggle
  const winnerBtn = card.querySelector('.winner-btn');
  winnerBtn.addEventListener('click', async e => {
    e.stopPropagation();
    const currentRating = result.rating || {};
    const newRating = { ...currentRating, winner: !currentRating.winner };

    try {
      await api(`/api/experiments/${expId}/results/${result.index}/rating`, {
        method: 'PUT',
        body: newRating
      });
      result.rating = newRating;
      winnerBtn.classList.toggle('active', newRating.winner);
    } catch (err) {
      console.error('Failed to toggle winner:', err);
    }
  });

  // Click to expand
  card.addEventListener('click', e => {
    if (e.target.closest('.star-btn') || e.target.closest('.winner-btn')) return;
    openCardModal(result, expId);
  });

  return card;
}

function getValidationBadge(validation) {
  if (!validation) return '<span class="badge badge-error">ERR</span>';
  if (validation.valid && validation.warnings?.length === 0) {
    return '<span class="badge badge-valid">&#10003;</span>';
  }
  if (validation.valid) {
    return `<span class="badge badge-warn">&#9888; ${validation.warnings.length}</span>`;
  }
  return `<span class="badge badge-error">&#10007; ${validation.errors.length}</span>`;
}

// ---- Card Modal ----
function setupModalClose() {
  document.querySelector('.card-modal-close')?.addEventListener('click', closeModal);
  document.querySelector('.card-modal-backdrop')?.addEventListener('click', closeModal);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });
}

function closeModal() {
  document.getElementById('card-modal').classList.add('hidden');
}

function openCardModal(result, expId) {
  const modal = document.getElementById('card-modal');
  const body = document.getElementById('card-modal-body');

  const svgHtml = (result.response?.svg && sanitizeSvg(result.response.svg)) || '<span class="no-svg">No SVG generated</span>';
  const validation = result.validation || { valid: false, errors: ['Unknown'], warnings: [] };

  const validationItems = [
    ...validation.errors.map(e => `<li class="err">&#10007; ${escapeHtml(e)}</li>`),
    ...validation.warnings.map(w => `<li class="warn">&#9888; ${escapeHtml(w)}</li>`),
    ...(validation.valid ? ['<li class="ok">&#10003; Valid</li>'] : [])
  ];

  const vars = result.variableValues
    ? Object.entries(result.variableValues).map(([k,v]) => `${k}: ${v}`).join('\n')
    : 'None';

  body.innerHTML = `
    <div class="modal-grid">
      <div>
        <div class="modal-svg-container">${svgHtml}</div>
        <div style="margin-top:0.8rem;">
          <div class="modal-field-label">Model</div>
          <div style="font-family:var(--mono);font-size:0.8rem;color:var(--text-1);">${escapeHtml(result.model || 'Unknown')}</div>
          <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px;">${escapeHtml(result.backend || '')} &middot; ${result.latencyMs ? `${(result.latencyMs/1000).toFixed(1)}s` : '-'}</div>
        </div>
        <div style="margin-top:0.8rem;">
          <div class="modal-field-label">Variables</div>
          <div class="modal-code">${escapeHtml(vars)}</div>
        </div>
        <div style="margin-top:0.8rem;">
          <div class="modal-field-label">Validation</div>
          <ul class="validation-list">${validationItems.join('')}</ul>
        </div>
      </div>
      <div class="modal-details">
        <div>
          <div class="modal-field-label">System Prompt</div>
          <div class="modal-code">${escapeHtml(result.promptSnapshot?.system || 'N/A')}</div>
        </div>
        <div>
          <div class="modal-field-label">User Prompt</div>
          <div class="modal-code">${escapeHtml(result.promptSnapshot?.user || 'N/A')}</div>
        </div>
        <div>
          <div class="modal-field-label">Raw Response</div>
          <div class="modal-code" style="max-height:300px;">${escapeHtml(result.response?.raw || 'No response')}</div>
        </div>
        <div>
          <div class="modal-field-label">SVG Source</div>
          <div class="modal-code" style="max-height:300px;">${escapeHtml(result.response?.svg || 'No SVG')}</div>
        </div>
        <div>
          <div class="modal-field-label">Notes</div>
          <textarea class="modal-notes" id="modal-notes" placeholder="Add notes...">${escapeHtml(result.rating?.notes || '')}</textarea>
          <button class="btn btn-sm btn-outline" style="margin-top:0.4rem;" id="modal-save-notes">Save Notes</button>
        </div>
        ${result.response?.svg ? `
        <div class="modal-share-section">
          <div class="modal-field-label">SHARE TO COMMUNITY</div>
          <div class="share-row">
            <input type="text" class="input-text" id="modal-share-username" placeholder="Username" value="${escapeHtml(getCommunityUsername())}" style="flex:1;">
            <input type="text" class="input-text" id="modal-share-name" placeholder="Asset name" value="${escapeHtml(Object.values(result.variableValues || {}).join(' ') || 'Generated SVG')}" style="flex:1;">
          </div>
          <div class="share-row" style="margin-top:0.4rem;">
            <button class="btn btn-sm btn-accent" id="modal-share-btn">Share to pelicans.art</button>
            <button class="btn btn-sm btn-ghost hidden" id="modal-copy-link-btn">Copy Link</button>
            <span class="share-feedback" id="modal-share-feedback"></span>
          </div>
        </div>
        ` : ''}
      </div>
    </div>
  `;

  // Save notes handler
  document.getElementById('modal-save-notes')?.addEventListener('click', async () => {
    const notes = document.getElementById('modal-notes').value;
    const currentRating = result.rating || {};
    const newRating = { ...currentRating, notes };

    try {
      await api(`/api/experiments/${expId}/results/${result.index}/rating`, {
        method: 'PUT',
        body: newRating
      });
      result.rating = newRating;
      setStatus('Notes saved', 'ready');
    } catch (err) {
      setStatus('Failed to save notes', 'error');
    }
  });

  // Community share handler
  document.getElementById('modal-share-btn')?.addEventListener('click', () => {
    shareResultToCommunity(result);
  });

  document.getElementById('modal-copy-link-btn')?.addEventListener('click', () => {
    copyCommunityLink();
  });

  modal.classList.remove('hidden');
}

// ---- History ----
async function loadHistory() {
  try {
    state.experiments = await api('/api/experiments');
    renderHistory();
  } catch (err) {
    console.error('Failed to load history:', err);
  }
}

document.getElementById('btn-refresh-history')?.addEventListener('click', loadHistory);

function renderHistory() {
  const tbody = document.getElementById('history-tbody');

  if (state.experiments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No experiments yet.</td></tr>';
    return;
  }

  tbody.innerHTML = '';

  for (const exp of state.experiments) {
    const tr = document.createElement('tr');
    const s = exp.summary || {};
    const avgRating = '-'; // Would need full data to compute

    tr.innerHTML = `
      <td style="font-weight:500;color:var(--text-0);">${escapeHtml(exp.name)}</td>
      <td><span class="status-badge ${exp.status}">${exp.status}</span></td>
      <td>${s.completed || 0}</td>
      <td>${s.validSvg || 0}</td>
      <td>${avgRating}</td>
      <td style="font-family:var(--mono);font-size:0.75rem;color:var(--text-3);">${exp.createdAt ? new Date(exp.createdAt).toLocaleDateString() : '-'}</td>
      <td><button class="delete-btn" data-id="${exp.id}" title="Delete">&#128465;</button></td>
    `;

    // Click row to view
    tr.addEventListener('click', e => {
      if (e.target.closest('.delete-btn')) return;
      switchTab('gallery');
      loadExperimentInGallery(exp.id);
    });

    // Delete button
    tr.querySelector('.delete-btn').addEventListener('click', e => {
      e.stopPropagation();
      showConfirm(`Delete experiment "${exp.name}"?`, async () => {
        try {
          await api(`/api/experiments/${exp.id}`, { method: 'DELETE' });
          loadHistory();
        } catch (err) {
          alert('Failed to delete: ' + err.message);
        }
      });
    });

    tbody.appendChild(tr);
  }
}

// ---- Confirm Dialog ----
let confirmCallback = null;

function setupConfirmDialog() {
  document.getElementById('confirm-cancel')?.addEventListener('click', () => {
    document.getElementById('confirm-dialog').classList.add('hidden');
  });
  document.querySelector('.confirm-backdrop')?.addEventListener('click', () => {
    document.getElementById('confirm-dialog').classList.add('hidden');
  });
  document.getElementById('confirm-ok')?.addEventListener('click', () => {
    document.getElementById('confirm-dialog').classList.add('hidden');
    if (confirmCallback) confirmCallback();
  });
}

function showConfirm(text, callback) {
  document.getElementById('confirm-text').textContent = text;
  confirmCallback = callback;
  document.getElementById('confirm-dialog').classList.remove('hidden');
}

// ---- Status ----
function setStatus(text, type = 'ready') {
  const dot = document.getElementById('status-dot');
  const label = document.getElementById('status-text');
  label.textContent = text;
  dot.className = 'status-dot' + (type === 'running' ? ' running' : type === 'error' ? ' error' : '');
}

// ---- Community Share ----
let communityLastUploadUrl = null;

function getCommunityUsername() {
  return localStorage.getItem('pelicans-community-username') || '';
}

function setCommunityUsername(name) {
  localStorage.setItem('pelicans-community-username', name);
}

/**
 * Determine the community asset type from the experiment's template
 */
function getAssetTypeForResult(result) {
  // Check the template that produced this result
  const exp = state.currentExperiment;
  if (exp?.config?.templateIds) {
    const template = state.templates.find(t => t.id === result.templateId);
    if (template) return template.assetType;
  }
  // Fallback: guess from SVG viewBox
  const svg = result.response?.svg || '';
  const vbMatch = svg.match(/viewBox=["']([^"']+)["']/);
  if (vbMatch) {
    if (vbMatch[1] === '0 0 100 150') return 'sprite';
    if (vbMatch[1] === '0 0 100 100') return 'prop';
    if (vbMatch[1].startsWith('0 0 400') || vbMatch[1].startsWith('0 0 225')) return 'background';
  }
  return 'sprite';
}

async function shareResultToCommunity(result) {
  const username = document.getElementById('modal-share-username')?.value.trim();
  const assetName = document.getElementById('modal-share-name')?.value.trim();
  const feedback = document.getElementById('modal-share-feedback');
  const shareBtn = document.getElementById('modal-share-btn');
  const copyBtn = document.getElementById('modal-copy-link-btn');

  if (!username) {
    feedback.textContent = 'Username required';
    feedback.className = 'share-feedback error';
    return;
  }
  if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
    feedback.textContent = 'Username: 1-30 chars (a-z, 0-9, -, _)';
    feedback.className = 'share-feedback error';
    return;
  }
  if (!result.response?.svg) {
    feedback.textContent = 'No SVG to share';
    feedback.className = 'share-feedback error';
    return;
  }

  setCommunityUsername(username);
  shareBtn.disabled = true;
  feedback.textContent = 'Uploading...';
  feedback.className = 'share-feedback';

  const assetType = getAssetTypeForResult(result);
  let communityType, payload;

  if (assetType === 'sprite') {
    communityType = 'characters';
    payload = {
      username,
      name: assetName || 'Generated character',
      front_svg: result.response.svg,
      meta: {
        name: assetName || 'Generated character',
        type: 'creature',
        description: `Generated by ${result.model || 'AI'}`,
        tags: ['svg-prompt-lab']
      }
    };
  } else if (assetType === 'prop') {
    communityType = 'props';
    payload = {
      username,
      name: assetName || 'Generated prop',
      svg: result.response.svg,
      meta: {
        name: assetName || 'Generated prop',
        description: `Generated by ${result.model || 'AI'}`,
        tags: ['svg-prompt-lab']
      }
    };
  } else if (assetType === 'background') {
    communityType = 'backgrounds';
    payload = {
      username,
      name: assetName || 'Generated background',
      landscape_svg: result.response.svg
    };
  } else {
    feedback.textContent = `Unknown asset type: ${assetType}`;
    feedback.className = 'share-feedback error';
    shareBtn.disabled = false;
    return;
  }

  // Size check
  const jsonStr = JSON.stringify(payload);
  const payloadSize = new Blob([jsonStr]).size;
  if (payloadSize > 3 * 1024 * 1024) {
    feedback.textContent = `Too large (${(payloadSize / 1024 / 1024).toFixed(1)} MB). Max 3 MB.`;
    feedback.className = 'share-feedback error';
    shareBtn.disabled = false;
    return;
  }

  try {
    const resp = await fetch(`${COMMUNITY_API_URL}/${communityType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: jsonStr
    });

    const data = await resp.json();

    if (!resp.ok) {
      throw new Error(data.error || `Upload failed (${resp.status})`);
    }

    const viewerUrl = `${window.location.origin}/community.html?type=${communityType}&id=${data.slug}`;
    communityLastUploadUrl = viewerUrl;
    feedback.textContent = 'Shared!';
    feedback.className = 'share-feedback success';
    shareBtn.classList.add('hidden');
    copyBtn.classList.remove('hidden');
  } catch (err) {
    feedback.textContent = err.message;
    feedback.className = 'share-feedback error';
  } finally {
    shareBtn.disabled = false;
  }
}

function copyCommunityLink() {
  if (!communityLastUploadUrl) return;
  const btn = document.getElementById('modal-copy-link-btn');
  navigator.clipboard.writeText(communityLastUploadUrl).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000);
  }).catch(() => {
    const tmp = document.createElement('input');
    tmp.value = communityLastUploadUrl;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    document.body.removeChild(tmp);
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy Link'; }, 2000);
  });
}

// ---- SVG Sanitization ----
function sanitizeSvg(svgString) {
  if (!svgString) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) return '';

  const svg = doc.documentElement;
  if (svg.tagName !== 'svg') return '';

  stripDangerous(svg);
  return new XMLSerializer().serializeToString(svg);
}

function stripDangerous(el) {
  const dangerousTags = new Set([
    'script', 'foreignobject', 'iframe', 'object', 'embed',
    'use', 'image', 'feimage', 'set', 'animate', 'animatetransform',
    'animatemotion'
  ]);

  // Remove dangerous child elements
  const toRemove = [];
  for (const child of el.children) {
    if (dangerousTags.has(child.tagName.toLowerCase())) {
      toRemove.push(child);
    } else {
      stripDangerous(child);
    }
  }
  toRemove.forEach(c => c.remove());

  // Remove on* event handler attributes and external refs
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || name === 'href' || name === 'xlink:href') {
      el.removeAttribute(attr.name);
    }
  }
}

// ---- Helpers ----
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
