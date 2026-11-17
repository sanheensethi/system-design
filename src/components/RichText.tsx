import { Fragment, type ReactNode } from 'react';

/** Renders a paragraph with **bold** and `inline code`. Deliberately tiny: lesson text is trusted data. */
export function RichText({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push(<Fragment key={i++}>{text.slice(last, m.index)}</Fragment>);
    const tok = m[0];
    if (tok.startsWith('**')) parts.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
    else parts.push(<code key={i++}>{tok.slice(1, -1)}</code>);
    last = m.index + tok.length;
  }
  if (last < text.length) parts.push(<Fragment key={i++}>{text.slice(last)}</Fragment>);
  return <>{parts}</>;
}
