# Publish, report, and review reliability signals

The operations boundary exposes privacy-safe SLO signals for three journeys:

| Journey | Operation | p95 latency budget | Availability target |
|---|---|---:|---:|
| Publish | Create confession | 1500 ms | 99.9% |
| Report | Submit report | 800 ms | 99.9% |
| Review | Resolve or dismiss report | 1200 ms | 99.9% |

## API

- `GET /api/ops/journey-signals` returns the latest 1000 in-process and persisted
  samples for each journey. It is a public, aggregate-only health-style contract.
- `POST /api/ops/journey-signals/operations` requires JWT authentication and an
  admin session. It accepts only `journey`, `outcome`, and `latencyMs`; unknown
  fields are rejected. HTTP 202 confirms recording, not an external side effect.

Valid journeys are `publish`, `report`, and `review`. Valid outcomes are
`success` and `failure`. `latencyMs` must be between 0 and 86,400,000.

## Labels and privacy

The contract has no user, account, wallet, confession, report, IP, or request
identifier fields. Metric labels are fixed journey names and outcomes. Do not
add free-form routes or identifiers to this endpoint or future label sets.

## Retry and failure behavior

An operation outcome of `failure` is recorded as a failed attempt and response
`retryable: true`. The client or automation may retry the original journey
operation, or wait until the failure budget/window regains capacity. Invalid
fields return 400 and are not recorded. Authentication and admin authorization
failures return 401 and 403. Persistence failures do not remove the bounded
in-process signal window or expose storage details.

## Rollout and compatibility

The GET shape is additive and versioned with `version: 1`. Existing health
endpoints are unchanged. The migration creates
`journey_operation_samples`; it contains only journey, outcome, latency, and
timestamp data. Existing databases are not backfilled, so initial journey
samples report `no_data` and 100% availability until observations arrive.
