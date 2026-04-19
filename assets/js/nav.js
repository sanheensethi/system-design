// Inject Book III (AI) links + LLD Ch 9 into any sidebar that doesn't have them
// This lets existing pages navigate to the new book without editing every file.
function injectNewNavigation() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;

  const alreadyHasBook3 = sidebar.querySelector('a[href$="ai/index.html"], a[href="index.html"][data-book="3"]');
  const isAiPage = window.location.pathname.replace(/\\/g, '/').toLowerCase().includes('/ai/');

  // Determine path prefix based on current page depth
  const path = window.location.pathname.replace(/\\/g, '/');
  const depth = (path.match(/\/(lld|hld|ai)\//) ? '../' : '');

  // Add Book III link if missing
  if (!alreadyHasBook3 && !isAiPage) {
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

  // Add LLD Ch 9 link if missing in LLD sidebar
  const lldSection = Array.from(sidebar.querySelectorAll('.nav-section')).find(s => {
    const h3 = s.querySelector('h3');
    return h3 && h3.textContent.includes('Book I');
  });
  if (lldSection && !lldSection.querySelector('a[href$="09-real-world.html"]')) {
    const lastLldLink = Array.from(lldSection.querySelectorAll('a')).pop();
    if (lastLldLink && lastLldLink.href.includes('08-real-code')) {
      const lldPrefix = lastLldLink.getAttribute('href').replace(/08-real-code\.html$/, '');
      const ch9 = document.createElement('a');
      ch9.href = lldPrefix + '09-real-world.html';
      ch9.textContent = '9. Applying LLD in Real Work';
      lastLldLink.after(ch9);
    }
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

  // Single-pass tokenizer. The FIRST alternative that matches at a position
  // consumes that span of text, so we never double-tokenize (no "class=class"
  // artifacts when a keyword/string appears inside an already-emitted span).
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
