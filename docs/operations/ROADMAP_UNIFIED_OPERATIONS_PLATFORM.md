# Unified Operations Platform Roadmap

Date: 2026-05-09
Status: Future roadmap phase
Placement: After FODE stabilization, before large-scale Books integration rollout

## Phase Name

Unified Operations Platform Refactor

## Objective

- Refactor FODE, KIA, and MLC into a shared operational platform with product-specific overlays.
- Preserve a governed core while keeping institution-specific policy and workflow differences explicit.
- Avoid duplicating workflows or code across products where a shared governed primitive can exist.

## Architecture Principle

- Common operational primitives + institution-specific workflow/policy overlays.

## Shared Canonical Layers

- Applicant identity model
- Guardian/contact model
- Document management workflow
- Portal framework
- Communication lifecycle
- Audit/event logging
- Verification workflow
- AI-assisted document review
- Books-native finance layer
- Operational state lifecycle engine

## Product Overlays

- FODE distance education workflow
- KIA school workflow
- MLC DHERST/TVET workflow

## Future Architectural Goal

- A single governed admissions and operations platform serving multiple educational products with configurable policy modules.
- Shared primitives handle common logic.
- Overlays handle institution-specific rules, forms, states, and policy differences.

## Operational Requirements

- Rollback-safe
- Observable
- Manually overridable
- Policy-driven
- Audit-first
- Product-agnostic core

## Explicit Rule

- Avoid duplicating workflows or code across FODE, KIA, and MLC where a shared governed primitive can exist instead.

## Migration Direction

- institution-specific spaghetti workflows
- shared canonical operational architecture

## Guardrails

- CRM remains quarantined as a compatibility layer only.
- Books implementation remains future CIS only.
- No runtime behavior changes are implied by this roadmap document.
- No deployment, schema mutation, or trigger mutation is authorized here.

## Cross References

- S5A canonical lifecycle and authority model: `docs/operations/S5A_CANONICAL_INTAKE_LIFECYCLE.md`
- S5A authority map: `docs/operations/S5A_OPERATIONAL_AUTHORITY_MAP.md`
- S5A finance direction: `docs/operations/S5A_FINANCE_DIRECTION.md`

