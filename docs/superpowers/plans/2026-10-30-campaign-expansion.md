# Implementation plan — 双章试炼
Spec: docs/superpowers/specs/2026-10-30-campaign-expansion.md

Architecture: pure combat model + separate pure persistent campaign + persistent DOM UI + canvas presentation. Existing audio, lifecycle and old workshop retained. Root integrates shared files and owns Git/release.
Global constraints: preserve saves/audience, no commercial reference assets in release, static evidence must not be described as runtime validation, no force push, no repeated approval.

1. Root: evidence-driven combat tests RED; migrate model v2; pips + charge + attack release; boss and chapter content. Tests GREEN.
2. Parallel equipment agent: campaign.mjs and campaign-ui.mjs/campaign.css only; strict profiles, deterministic drops, six slots, comparison/actions, idempotent receipts, unlock. Own new tests.
3. Parallel animation agent: original action atlas + rain-temple background; scene integration with chapter background and four poses; own scene tests. No model/controller/UI edits.
4. Root: campaign/controller boundaries, legacy restore, UI intent and charge preview, inventory/chapter hooks, chapter replay. Integrate agent contracts.
5. Independent review: requirements and edge cases; fix material findings. Full test suite and deterministic both-chapter simulations. UI QA on desktop, mobile, save reload and progression.
6. Commit, fast-forward main and push GitHub; export committed files to existing Site, preserve audience, deploy terminal success and verify live. Deliver concise actual result and remaining limits.

Task status is tracked in the final development note; no claim of completion without current verification.
