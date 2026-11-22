import { BadRequestException } from '@nestjs/common';
import { JourneyReliabilityService } from './journey-reliability.service';

describe('JourneyReliabilityService', () => {
  let service: JourneyReliabilityService;

  beforeEach(() => {
    service = new JourneyReliabilityService();
  });

  it('records publish success and exposes latency and availability signals', () => {
    service.recordOperation('publish', 'success', 100);
    service.recordOperation('publish', 'success', 300);
    service.recordOperation('publish', 'failure', 900);

    const signal = service.recordOperation('publish', 'success', 500);

    expect(signal.sampleCount).toBe(4);
    expect(signal.successCount).toBe(3);
    expect(signal.failureCount).toBe(1);
    expect(signal.availabilityPercent).toBe(75);
    expect(signal.latency.p95Ms).toBe(900);
  });

  it('defines and exhausts the 99.9 percent failure budget', () => {
    for (let index = 0; index < 1000; index += 1) {
      service.recordOperation('report', index === 999 ? 'failure' : 'success', 50);
    }

    const signal = service.recordOperation('report', 'failure', 50);
    expect(signal.failureBudget.allowedFailures).toBe(1);
    expect(signal.failureBudget.exhausted).toBe(true);
  });

  it('rejects invalid bounded fields without accepting identifiers', () => {
    expect(() => service.recordOperation('publish', 'success', -1))
      .toThrow(BadRequestException);
    expect(() => service.recordOperation('unknown', 'success', 10))
      .toThrow(BadRequestException);
    expect(() => service.recordOperation('review', 'timeout', 10))
      .toThrow(BadRequestException);
  });

  it('does not include user-level identifiers in the public signal contract', async () => {
    service.recordOperation('review', 'success', 20);
    const result = await service.getSignals();
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain('userId');
    expect(serialized).not.toContain('accountId');
    expect(serialized).not.toContain('wallet');
    expect(result.journeys.map((journey) => journey.journey))
      .toEqual(['publish', 'report', 'review']);
  });

  it('marks latency budget breaches as degraded', () => {
    service.recordOperation('publish', 'success', 1600);
    const signal = service.recordOperation('publish', 'success', 1700);

    expect(signal.latencyBudget.breached).toBe(true);
    expect(signal.state).toBe('degraded');
  });
});
