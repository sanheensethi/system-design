// Code Animator — steps through code with line highlight + state display
// Usage:
//   const a = new CodeAnimator({
//     codeEl: '#code', stateEl: '#state', descEl: '#desc',
//     code: ['line1', 'line2', ...],
//     steps: [{line: 0, vars: {x:1}, desc: 'start'}, ...]
//   });
//   a.mount();

class CodeAnimator {
  constructor(opts) {
    this.opts = opts;
    this.code = opts.code || [];
    this.steps = opts.steps || [];
    this.index = 0;
    this.timer = null;
    this.speed = 1000;
    this.onStep = opts.onStep || null;
  }

  mount() {
    this._renderCode();
    this._renderControls();
    this.reset();
  }

  _renderCode() {
    const el = document.querySelector(this.opts.codeEl);
    if (!el) return;
    el.innerHTML = this.code.map((l, i) =>
      `<div class="viz-code-line" data-line="${i}"><span class="line-no">${i+1}</span><span class="line-src">${this._escape(l)}</span></div>`
    ).join('');
  }

  _escape(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  _renderControls() {
    if (!this.opts.controlsEl) return;
    const el = document.querySelector(this.opts.controlsEl);
    if (!el) return;
    el.innerHTML = `
      <button class="viz-btn" data-act="reset">⟲ Reset</button>
      <button class="viz-btn" data-act="prev">◀ Step Back</button>
      <button class="viz-btn primary" data-act="playpause">▶ Play</button>
      <button class="viz-btn" data-act="next">Step ▶</button>
      <span class="viz-step-indicator">Step <span data-sidx>0</span>/<span data-stot>${this.steps.length}</span></span>
      <div class="viz-speed">
        <label>Speed</label>
        <input type="range" min="300" max="2500" value="${2800 - this.speed}" data-speed>
        <span data-spdtxt>${(this.speed/1000).toFixed(1)}s</span>
      </div>
    `;

    el.querySelector('[data-act="reset"]').onclick = () => this.reset();
    el.querySelector('[data-act="prev"]').onclick  = () => this.stepBack();
    el.querySelector('[data-act="next"]').onclick  = () => this.stepNext();
    el.querySelector('[data-act="playpause"]').onclick = (e) => this.togglePlay(e.target);

    const sp = el.querySelector('[data-speed]');
    sp.oninput = () => {
      this.speed = 2800 - parseInt(sp.value);
      el.querySelector('[data-spdtxt]').textContent = (this.speed/1000).toFixed(1)+'s';
      if (this.timer) { clearInterval(this.timer); this._startTimer(); }
    };
  }

  _startTimer() {
    this.timer = setInterval(() => {
      if (this.index >= this.steps.length - 1) {
        this._stopTimer();
        const btn = document.querySelector(`${this.opts.controlsEl} [data-act="playpause"]`);
        if (btn) btn.textContent = '▶ Play';
        return;
      }
      this.stepNext();
    }, this.speed);
  }

  _stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  togglePlay(btn) {
    if (this.timer) { this._stopTimer(); btn.textContent = '▶ Play'; }
    else { this._startTimer(); btn.textContent = '⏸ Pause'; }
  }

  reset() {
    this._stopTimer();
    this.index = -1;
    document.querySelectorAll(`${this.opts.codeEl} .viz-code-line`).forEach(l => {
      l.classList.remove('active','executed');
    });
    if (this.opts.onReset) this.opts.onReset();
    this._updateStepDisplay();
    const btn = document.querySelector(`${this.opts.controlsEl} [data-act="playpause"]`);
    if (btn) btn.textContent = '▶ Play';
  }

  stepNext() {
    if (this.index >= this.steps.length - 1) return;
    this.index++;
    this._apply();
  }

  stepBack() {
    if (this.index <= 0) return;
    // Replay from 0 (simplest — state is a function of steps)
    const target = this.index - 1;
    if (this.opts.onReset) this.opts.onReset();
    this.index = -1;
    for (let i = 0; i <= target; i++) {
      this.index = i;
      this._apply(true);
    }
  }

  _apply(isReplay = false) {
    const step = this.steps[this.index];
    if (!step) return;

    // Highlight code line
    document.querySelectorAll(`${this.opts.codeEl} .viz-code-line`).forEach((l, i) => {
      l.classList.remove('active');
      if (i < step.line) l.classList.add('executed');
      else l.classList.remove('executed');
      if (i === step.line) l.classList.add('active');
    });

    // Scroll current line into view
    const active = document.querySelector(`${this.opts.codeEl} .viz-code-line.active`);
    if (active && !isReplay) {
      active.scrollIntoView({ behavior:'smooth', block:'center' });
    }

    // Update vars
    if (this.opts.stateEl && step.vars) {
      const st = document.querySelector(this.opts.stateEl);
      if (st) {
        const prev = this.lastVars || {};
        st.innerHTML = Object.entries(step.vars).map(([k,v]) => {
          const changed = JSON.stringify(prev[k]) !== JSON.stringify(v);
          const display = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return `<div class="k">${k}</div><div class="v${changed?' changed':''}">${this._escape(display)}</div>`;
        }).join('');
        this.lastVars = step.vars;
      }
    }

    // Description
    if (this.opts.descEl && step.desc) {
      const d = document.querySelector(this.opts.descEl);
      if (d) d.textContent = step.desc;
    }

    // Custom hook for visualizations
    if (this.onStep) this.onStep(step, this.index, isReplay);

    this._updateStepDisplay();
  }

  _updateStepDisplay() {
    const sidx = document.querySelector(`${this.opts.controlsEl} [data-sidx]`);
    if (sidx) sidx.textContent = this.index + 1;
  }
}

// ============================================================
// ArchitectureAnimator — flowing dots between nodes for HLD demos
// ============================================================

class ArchAnimator {
  constructor(container) {
    this.container = typeof container === 'string' ? document.querySelector(container) : container;
    this.container.style.position = 'relative';
    this.nodes = {};  // id → {el, xPct, yPct}
    this.edges = {};  // "a|b" → SVG path

    // Create SVG layer for edges
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'arch-svg');
    this.container.appendChild(this.svg);

    // Redraw edges on resize
    this._resizeObs = new ResizeObserver(() => this._redrawEdges());
    this._resizeObs.observe(this.container);
  }

  addNode(id, label, xPct, yPct, extraClass = '') {
    const el = document.createElement('div');
    el.className = 'arch-node ' + extraClass;
    el.dataset.id = id;
    el.innerHTML = label;
    el.style.left = `calc(${xPct}% - 60px)`;
    el.style.top  = `calc(${yPct}% - 20px)`;
    this.container.appendChild(el);
    this.nodes[id] = { el, xPct, yPct };
    return el;
  }

  // Explicitly connect two nodes with a visible line
  addEdge(fromId, toId, opts = {}) {
    const key = fromId + '|' + toId;
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'arch-edge');
    if (opts.dashed) path.style.strokeDasharray = '4 4';
    this.svg.appendChild(path);
    this.edges[key] = path;
    this._redrawEdges();
    return path;
  }

  // Convenience: connect many at once
  addEdges(pairs) { pairs.forEach(([a,b]) => this.addEdge(a, b)); }

  _coord(id) {
    const n = this.nodes[id];
    if (!n) return null;
    const r = n.el.getBoundingClientRect();
    const cr = this.container.getBoundingClientRect();
    return { x: r.left - cr.left + r.width/2, y: r.top - cr.top + r.height/2 };
  }

  _redrawEdges() {
    Object.keys(this.edges).forEach(key => {
      const [a,b] = key.split('|');
      const from = this._coord(a), to = this._coord(b);
      if (!from || !to) return;
      // curved path (quadratic): control point midway, offset perpendicular slightly
      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2;
      // Slight curve: offset perpendicular to the line
      const dx = to.x - from.x, dy = to.y - from.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      // Small perpendicular offset for aesthetic curve (0 = straight)
      const curve = Math.min(len * 0.08, 25);
      const perpX = -dy / len * curve;
      const perpY =  dx / len * curve;
      const cx = midX + perpX, cy = midY + perpY;
      this.edges[key].setAttribute('d', `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`);
    });
  }

  _findEdge(fromId, toId) {
    // match in either direction
    return this.edges[fromId + '|' + toId] || this.edges[toId + '|' + fromId];
  }

  // Send a packet from node A to node B with glowing trail. Returns promise.
  sendPacket(fromId, toId, opts = {}) {
    return new Promise((resolve) => {
      const from = this._coord(fromId);
      const to   = this._coord(toId);
      if (!from || !to) return resolve();

      const duration = opts.duration || 800;
      const cls = opts.cls || '';
      const edge = this._findEdge(fromId, toId);

      // Auto-add an edge if missing
      if (!edge) this.addEdge(fromId, toId);
      const edgeEl = this._findEdge(fromId, toId);

      // Activate edge — glowing dashed flow
      edgeEl.classList.add('active');
      if (cls) edgeEl.classList.add(cls);

      // Activate "from" node
      this.nodes[fromId].el.classList.add('active');

      // Main packet
      const p = document.createElement('div');
      p.className = 'arch-packet ' + cls;
      p.style.left = (from.x - 8) + 'px';
      p.style.top  = (from.y - 8) + 'px';
      p.style.transitionDuration = duration + 'ms';
      this.container.appendChild(p);

      // Spawn trail dots along the way
      const trailCount = 4;
      for (let i = 1; i <= trailCount; i++) {
        setTimeout(() => {
          const t = document.createElement('div');
          t.className = 'arch-trail ' + cls;
          // position along linear interp (approximate — ignores curve for simplicity)
          const ratio = i / (trailCount + 1);
          const x = from.x + (to.x - from.x) * ratio;
          const y = from.y + (to.y - from.y) * ratio;
          t.style.left = (x - 5) + 'px';
          t.style.top  = (y - 5) + 'px';
          this.container.appendChild(t);
          setTimeout(() => t.remove(), 800);
        }, (duration / (trailCount + 1)) * i);
      }

      // Kick main packet along
      requestAnimationFrame(() => {
        p.style.left = (to.x - 8) + 'px';
        p.style.top  = (to.y - 8) + 'px';
      });

      setTimeout(() => {
        this.nodes[fromId].el.classList.remove('active');
        this.nodes[toId].el.classList.add('active');
        edgeEl.classList.remove('active', 'response', 'cached');
        p.remove();
        setTimeout(() => this.nodes[toId].el.classList.remove('active'), 200);
        resolve();
      }, duration);
    });
  }

  setNodeStatus(id, status) {
    const n = this.nodes[id];
    if (!n) return;
    n.el.classList.remove('active','hit','miss');
    if (status) n.el.classList.add(status);
  }

  clear() {
    [...this.container.children].forEach(c => {
      if (c !== this.svg) c.remove();
    });
    this.svg.innerHTML = '';
    this.nodes = {};
    this.edges = {};
  }
}

window.CodeAnimator = CodeAnimator;
window.ArchAnimator = ArchAnimator;

// Auto-detect embed mode (when iframed inside a chapter with ?embed=1)
(function() {
  if (location.search.includes('embed=1')) {
    document.documentElement.classList.add('embed-mode');
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('embed-mode');
    });
  }
})();
