import { useEffect, useState } from 'react';

interface JourneySignal {
  journey: 'publish' | 'report' | 'review';
  sampleCount: number;
  availabilityPercent: number;
  targetAvailabilityPercent: number;
  latency: { p95Ms: number };
  latencyBudget: { p95Ms: number; breached: boolean };
  failureBudget: { remainingPercent: number; exhausted: boolean };
  state: 'healthy' | 'degraded' | 'no_data';
}

export default function JourneySignalsPage() {
  const [signals, setSignals] = useState<JourneySignal[]>([]);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch('/api/ops/journey-signals')
      .then(async (response) => {
        if (!response.ok) throw new Error('journey signals unavailable');
        const body = await response.json();
        if (active) setSignals(body.journeys ?? []);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <main aria-busy="true">Loading journey signals...</main>;
  if (failed) return <main role="alert">Journey signals unavailable. Retry later.</main>;

  return (
    <main>
      <h1>Journey reliability</h1>
      <p>Privacy-safe operational aggregates; no user identifiers are displayed.</p>
      <section aria-label="Journey signals">
        {signals.map((signal) => (
          <article key={signal.journey}>
            <h2>{signal.journey}</h2>
            <p>Status: {signal.state}</p>
            <p>Availability: {signal.availabilityPercent}% (target {signal.targetAvailabilityPercent}%)</p>
            <p>Latency p95: {signal.latency.p95Ms} ms (budget {signal.latencyBudget.p95Ms} ms)</p>
            <p>Failure budget remaining: {signal.failureBudget.remainingPercent}%</p>
            {signal.latencyBudget.breached || signal.failureBudget.exhausted ? (
              <p role="alert">SLO at risk; retry or investigate the journey.</p>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
