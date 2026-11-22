import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  JourneyOperationEntity,
  JourneyName,
  JourneyOutcome,
} from './entities/journey-operation.entity';

export interface JourneySignal {
  journey: JourneyName;
  window: 'latest-1000';
  sampleCount: number;
  successCount: number;
  failureCount: number;
  availability: number;
  availabilityPercent: number;
  targetAvailabilityPercent: number;
  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    maxMs: number;
  };
  latencyBudget: {
    p95Ms: number;
    breached: boolean;
  };
  failureBudget: {
    targetFailurePercent: number;
    allowedFailures: number;
    consumedFailures: number;
    remainingPercent: number;
    exhausted: boolean;
  };
  state: 'healthy' | 'degraded' | 'no_data';
}

const JOURNEY_NAMES: JourneyName[] = ['publish', 'report', 'review'];
const TARGET_AVAILABILITY = 0.999;
const LATENCY_BUDGET_MS: Record<JourneyName, number> = {
  publish: 1500,
  report: 800,
  review: 1200,
};
const MAX_SAMPLES = 1000;

@Injectable()
export class JourneyReliabilityService {
  private readonly samples = new Map<JourneyName, JourneyOperationEntity[]>();

  constructor(
    @Optional()
    @InjectRepository(JourneyOperationEntity)
    private readonly repository?: Repository<JourneyOperationEntity>,
  ) {}

  recordOperation(
    journey: unknown,
    outcome: unknown,
    latencyMs: unknown,
  ): JourneySignal {
    if (!JOURNEY_NAMES.includes(journey as JourneyName)) {
      throw new BadRequestException({
        code: 'INVALID_JOURNEY',
        message: 'journey must be publish, report, or review',
      });
    }
    if (outcome !== 'success' && outcome !== 'failure') {
      throw new BadRequestException({
        code: 'INVALID_OUTCOME',
        message: 'outcome must be success or failure',
      });
    }
    if (
      typeof latencyMs !== 'number' ||
      !Number.isFinite(latencyMs) ||
      latencyMs < 0 ||
      latencyMs > 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException({
        code: 'INVALID_LATENCY',
        message: 'latencyMs must be a finite number between 0 and 86400000',
      });
    }

    const sample = {
      id: 0,
      journey: journey as JourneyName,
      outcome: outcome as JourneyOutcome,
      latencyMs: Math.round(latencyMs),
      createdAt: new Date(),
    } as JourneyOperationEntity;
    const existing = this.samples.get(sample.journey) ?? [];
    existing.push(sample);
    if (existing.length > MAX_SAMPLES) {
      existing.splice(0, existing.length - MAX_SAMPLES);
    }
    this.samples.set(sample.journey, existing);

    if (this.repository) {
      void this.repository.save(sample).catch(() => {
        // The bounded in-process window remains authoritative for degraded
        // persistence; the next read exposes no persistence error details.
      });
    }

    return this.buildSignal(sample.journey);
  }

  async getSignals(): Promise<{ version: 1; generatedAt: string; journeys: JourneySignal[] }> {
    if (this.repository) {
      try {
        const rows = await this.repository.find({
          order: { createdAt: 'DESC' },
          take: MAX_SAMPLES * JOURNEY_NAMES.length,
        });
        for (const journey of JOURNEY_NAMES) {
          const persisted = rows
            .filter((row) => row.journey === journey)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .slice(-MAX_SAMPLES);
          if (persisted.length > 0) {
            this.samples.set(journey, persisted);
          }
        }
      } catch {
        // Return the in-process window rather than leaking storage details.
      }
    }

    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      journeys: JOURNEY_NAMES.map((journey) => this.buildSignal(journey)),
    };
  }

  reset(): void {
    this.samples.clear();
  }

  private buildSignal(journey: JourneyName): JourneySignal {
    const samples = this.samples.get(journey) ?? [];
    const successCount = samples.filter((sample) => sample.outcome === 'success').length;
    const failureCount = samples.length - successCount;
    const availability = samples.length === 0 ? 1 : successCount / samples.length;
    const allowedFailures = samples.length === 0
      ? 0
      : Math.floor(samples.length * (1 - TARGET_AVAILABILITY));
    const remainingFailures = allowedFailures - failureCount;
    const remainingPercent = allowedFailures === 0
      ? (samples.length === 0 ? 100 : 0)
      : Math.max(0, (remainingFailures / allowedFailures) * 100);
    const exhausted = samples.length > 0 && failureCount > allowedFailures;
    const latencies = samples.map((sample) => sample.latencyMs).sort((a, b) => a - b);

    return {
      journey,
      window: 'latest-1000',
      sampleCount: samples.length,
      successCount,
      failureCount,
      availability,
      availabilityPercent: Number((availability * 100).toFixed(4)),
      targetAvailabilityPercent: TARGET_AVAILABILITY * 100,
      latency: {
        p50Ms: percentile(latencies, 50),
        p95Ms: percentile(latencies, 95),
        p99Ms: percentile(latencies, 99),
        maxMs: latencies.length === 0 ? 0 : latencies[latencies.length - 1],
      },
      latencyBudget: {
        p95Ms: LATENCY_BUDGET_MS[journey],
        breached: latencies.length > 0 &&
          percentile(latencies, 95) > LATENCY_BUDGET_MS[journey],
      },
      failureBudget: {
        targetFailurePercent: (1 - TARGET_AVAILABILITY) * 100,
        allowedFailures,
        consumedFailures: Math.min(failureCount, allowedFailures),
        remainingPercent: Number(remainingPercent.toFixed(4)),
        exhausted,
      },
      state: samples.length === 0
        ? 'no_data'
        : exhausted || percentile(latencies, 95) > LATENCY_BUDGET_MS[journey]
          ? 'degraded'
          : 'healthy',
    };
  }
}

export function percentile(sorted: number[], percent: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((percent / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
