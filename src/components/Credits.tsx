// The course author's credit, shown in the top bar on wide screens and in the drawer and home footer.

const AUTHOR = 'Sanheen Sethi';
const LINKEDIN = 'https://www.linkedin.com/in/sanheensethi/';
const GITHUB = 'https://github.com/sanheensethi';

// Brand marks drawn inline: the icon library has no brand logos.
function LinkedInMark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />
    </svg>
  );
}

function GitHubMark({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .3" />
    </svg>
  );
}

/** "Built by Sanheen Sethi" with LinkedIn and GitHub buttons. */
export function Credits({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`credits ${compact ? 'compact' : ''}`}>
      <a className="credit-name" href={LINKEDIN} target="_blank" rel="noopener noreferrer">
        <span className="credit-label">Built by</span>
        <span>{AUTHOR}</span>
      </a>
      <a className="icon-btn credit-icon" href={LINKEDIN} target="_blank" rel="noopener noreferrer" aria-label={`${AUTHOR} on LinkedIn`} title="LinkedIn">
        <LinkedInMark />
      </a>
      <a className="icon-btn credit-icon" href={GITHUB} target="_blank" rel="noopener noreferrer" aria-label={`${AUTHOR} on GitHub`} title="GitHub">
        <GitHubMark />
      </a>
    </div>
  );
}
