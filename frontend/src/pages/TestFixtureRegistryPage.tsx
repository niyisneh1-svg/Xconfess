import { useEffect, useState } from 'react';

interface TestFixture {
  name: string;
  origin: string;
  synthetic: boolean;
  permittedUse: string[];
  cleanupPolicy: string;
  files: string[];
}

export default function TestFixtureRegistryPage() {
  const [fixtures, setFixtures] = useState<TestFixture[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');

  useEffect(() => {
    let active = true;
    fetch('/api/admin/testing-fixtures')
      .then(async (response) => {
        if (!response.ok) throw new Error('fixture registry unavailable');
        const body = await response.json();
        if (active) setFixtures(body);
      })
      .then(() => {
        if (active) setStatus('ready');
      })
      .catch(() => {
        if (active) setStatus('failed');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') return <main aria-busy="true">Loading synthetic fixtures...</main>;
  if (status === 'failed') return <main role="alert">Fixture registry unavailable. Retry later or verify admin access.</main>;

  return (
    <main>
      <h1>Test fixture registry</h1>
      <p>Only synthetic fixtures with an origin, permitted use, and cleanup policy may be registered.</p>
      {fixtures.length === 0 ? <p>No fixtures registered.</p> : (
        <section aria-label="Registered test fixtures">
          {fixtures.map((fixture) => (
            <article key={fixture.name}>
              <h2>{fixture.name}</h2>
              <p>Origin: {fixture.origin}</p>
              <p>Synthetic: {fixture.synthetic ? 'yes' : 'no'}</p>
              <p>Permitted use: {fixture.permittedUse.join(', ')}</p>
              <p>Cleanup: {fixture.cleanupPolicy}</p>
              <p>Files: {fixture.files.join(', ')}</p>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
