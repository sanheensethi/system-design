// Inject new chapters (Book III, LLD 9-11, HLD 7b/9-10) into any sidebar missing them
function injectNewNavigation() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  const isAiPage  = path.includes('/ai/');
  const isLldPage = path.includes('/lld/');
  const isHldPage = path.includes('/hld/');

  // Build a prefix resolver: "../" if we're inside /lld/ /hld/ /ai/, else ""
  const depth = (isLldPage || isHldPage || isAiPage) ? '../' : '';

  // --- Interactive Viz section ---
  const hasViz = Array.from(sidebar.querySelectorAll('.nav-section h3'))
    .some(h => h.textContent.includes('Interactive Viz'));
  if (!hasViz) {
    const section = document.createElement('div');
    section.className = 'nav-section';
    section.innerHTML = `
      <h3>🎬 Interactive Viz</h3>
      <a href="${depth}viz/index.html">All Visualizations</a>
      <a href="${depth}viz/lru-cache.html">LRU Cache (LLD)</a>
      <a href="${depth}viz/parking-lot.html">Parking Lot (LLD)</a>
      <a href="${depth}viz/vending-machine.html">Vending Machine (LLD)</a>
      <a href="${depth}viz/bfs-dfs.html">BFS / DFS (LLD)</a>
      <a href="${depth}viz/rate-limiter.html">Rate Limiter (LLD/HLD)</a>
      <a href="${depth}viz/request-flow.html">Request Flow (HLD)</a>
      <a href="${depth}viz/load-balancer.html">Load Balancer (HLD)</a>
      <a href="${depth}viz/cache-aside.html">Cache-Aside (HLD)</a>
      <a href="${depth}viz/consistent-hashing.html">Consistent Hashing (HLD)</a>
      <a href="${depth}viz/db-replication.html">DB Replication (HLD)</a>
      <a href="${depth}viz/kafka-partitioning.html">Kafka Partitions (HLD)</a>
      <a href="${depth}viz/circuit-breaker.html">Circuit Breaker (HLD)</a>
      <a href="${depth}viz/raft-election.html">Raft Election (HLD)</a>
      <a href="${depth}viz/saga.html">Saga Pattern (HLD)</a>
      <a href="${depth}viz/rag-pipeline.html">RAG Pipeline (AI)</a>
      <a href="${depth}viz/agent-react.html">Agent ReAct (AI)</a>
    `;
    sidebar.appendChild(section);
  }

  // --- Book III (AI) section ---
  const hasBook3 = Array.from(sidebar.querySelectorAll('.nav-section h3'))
    .some(h => h.textContent.includes('Book III'));

  if (!hasBook3) {
    const section = document.createElement('div');
    section.className = 'nav-section';
    section.innerHTML = `
      <h3>Book III — AI System Design</h3>
      <a href="${depth}ai/index.html">AI Index</a>
      <a href="${depth}ai/01-foundations.html">1. AI Foundations</a>
      <a href="${depth}ai/02-building-blocks.html">2. AI Building Blocks</a>
      <a href="${depth}ai/03-rag.html">3. RAG Systems</a>
      <a href="${depth}ai/04-llm-serving.html">4. LLM Serving</a>
      <a href="${depth}ai/05-agents.html">5. Agent Architectures</a>
      <a href="${depth}ai/06-hybrid-legacy.html">6. Hybrid & Legacy</a>
      <a href="${depth}ai/07-war-room.html">7. AI War Room</a>
      <a href="${depth}ai/08-real-architectures.html">8. Real AI Architectures</a>
    `;
    sidebar.appendChild(section);
  }

  // --- Inject LLD Ch 9, 10, 11 into LLD section if missing ---
  const lldSection = Array.from(sidebar.querySelectorAll('.nav-section')).find(s => {
    const h3 = s.querySelector('h3');
    return h3 && h3.textContent.includes('Book I') && !h3.textContent.includes('Book III');
  });
  if (lldSection) {
    const lldLinks = Array.from(lldSection.querySelectorAll('a'));
    const lastLldLink = lldLinks[lldLinks.length - 1];
    const prefix = lastLldLink ? lastLldLink.getAttribute('href').replace(/[^\/]+$/, '') : `${depth}lld/`;

    const ensureLink = (fileName, label) => {
      if (!lldSection.querySelector(`a[href$="${fileName}"]`)) {
        const a = document.createElement('a');
        a.href = prefix + fileName;
        a.textContent = label;
        lldSection.appendChild(a);
      }
    };
    ensureLink('09-real-world.html', '9. Applying LLD in Real Work');
    ensureLink('10-modern-patterns.html', '10. Modern Patterns (2026)');
    ensureLink('11-modern-problems.html', '11. Modern 2026 Problems');
  }

  // --- Inject HLD 7b, 9, 10 into HLD section if missing ---
  const hldSection = Array.from(sidebar.querySelectorAll('.nav-section')).find(s => {
    const h3 = s.querySelector('h3');
    return h3 && h3.textContent.includes('Book II');
  });
  if (hldSection) {
    const hldLinks = Array.from(hldSection.querySelectorAll('a'));
    const lastHldLink = hldLinks[hldLinks.length - 1];
    const prefix = lastHldLink ? lastHldLink.getAttribute('href').replace(/[^\/]+$/, '') : `${depth}hld/`;

    const ensureLink = (fileName, label, after) => {
      if (!hldSection.querySelector(`a[href$="${fileName}"]`)) {
        const a = document.createElement('a');
        a.href = prefix + fileName;
        a.textContent = label;
        if (after) {
          const anchor = hldSection.querySelector(`a[href$="${after}"]`);
          if (anchor) { anchor.after(a); return; }
        }
        hldSection.appendChild(a);
      }
    };
    ensureLink('07b-war-room-extra.html', '7b. War Room Extras', '07-war-room.html');
    ensureLink('09-modern-patterns.html', '9. Modern Architecture Patterns (2026)');
    ensureLink('10-modern-problems.html', '10. Modern 2026 Problems');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  injectNewNavigation();

  // Sidebar active link
  const path = window.location.pathname.replace(/\\/g, '/').toLowerCase();
  document.querySelectorAll('.sidebar a').forEach(link => {
    const href = link.getAttribute('href').toLowerCase();
    if (href && path.endsWith(href.split('/').pop())) {
      link.classList.add('active');
    }
  });

  // Single-pass tokenizer (ordered alternation; first match wins)
  const pattern = new RegExp([
    '(#[^\\n]*|//[^\\n]*|/\\*[\\s\\S]*?\\*/)',
    '(\'(?:\\\\.|[^\'\\\\\\n])*\'|"(?:\\\\.|[^"\\\\\\n])*"|`(?:\\\\.|[^`\\\\])*`)',
    '\\b(class|def|function|if|else|elif|for|while|return|import|from|const|let|var|new|this|self|public|private|protected|static|abstract|interface|extends|implements|try|catch|finally|throw|throws|async|await|void|int|long|double|float|char|string|boolean|true|false|null|None|True|False|and|or|not|in|is|lambda|yield|raise|pass|with|as|break|continue|switch|case|default|struct|enum|type|typeof|instanceof)\\b',
    '\\b(0x[0-9a-fA-F]+|\\d+\\.?\\d*)\\b'
  ].join('|'), 'g');

  const escapeHtml = s => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  document.querySelectorAll('pre code').forEach(block => {
    const text = escapeHtml(block.textContent);
    const highlighted = text.replace(pattern, (m, comment, str, kw, num) => {
      if (comment !== undefined) return '<span class="token-comment">' + comment + '</span>';
      if (str !== undefined)     return '<span class="token-string">' + str + '</span>';
      if (kw !== undefined)      return '<span class="token-keyword">' + kw + '</span>';
      if (num !== undefined)     return '<span class="token-number">' + num + '</span>';
      return m;
    });
    block.innerHTML = highlighted;
  });
});
