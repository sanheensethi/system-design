import { Highlight, themes } from 'prism-react-renderer';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import type { CodeSample } from '../engine/types';

const PRISM_LANG: Record<CodeSample['language'], string> = {
  python: 'python',
  typescript: 'tsx',
  javascript: 'jsx',
  go: 'go',
  sql: 'sql',
  bash: 'clike',
  json: 'json',
  yaml: 'yaml',
};

export function CodePanel({ code, dark }: { code: CodeSample; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const highlight = new Set(code.highlight ?? []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard can be blocked; nothing else to do */
    }
  };
  return (
    <div className="code-panel">
      <div className="code-head">
        <span className="code-lang">{code.language}</span>
        <span className="code-title">{code.title}</span>
        <button className="icon-btn small" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <Highlight theme={dark ? themes.oneDark : themes.oneLight} code={code.source.trimEnd()} language={PRISM_LANG[code.language]}>
        {({ tokens, getLineProps, getTokenProps }) => (
          <pre className="code-body">
            {tokens.map((line, i) => {
              const props = getLineProps({ line });
              const hot = highlight.has(i + 1);
              return (
                <div key={i} {...props} className={`${props.className} code-line${hot ? ' hot' : ''}`}>
                  <span className="ln">{i + 1}</span>
                  <span>
                    {line.map((token, k) => (
                      <span key={k} {...getTokenProps({ token })} />
                    ))}
                  </span>
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
