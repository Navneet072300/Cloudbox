'use client';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{ fontFamily: 'monospace', padding: '2rem', background: '#fff', color: '#000' }}>
        <h1 style={{ color: 'red' }}>Application Error</h1>
        <p><strong>Message:</strong> {error.message}</p>
        {error.digest && <p><strong>Digest:</strong> {error.digest}</p>}
        <pre style={{ background: '#f4f4f4', padding: '1rem', overflow: 'auto', fontSize: '12px' }}>
          {error.stack}
        </pre>
        <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Try again</button>
      </body>
    </html>
  );
}
