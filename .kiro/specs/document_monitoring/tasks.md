# Spec: Document Monitoring Tasks (GÖREV-12)

- [ ] Task 1: Add quality heuristic score calculator helper in `backend/api/agents.py` (or a utility module).
- [ ] Task 2: Implement `/api/agents/{agent_id}/documents/{document_id}/details` endpoint in `backend/api/agents.py` with Organization/User validation.
- [ ] Task 3: Implement system health check probes (Postgres, Pytesseract, Embedding) in `backend/api/agents.py`.
- [ ] Task 4: Add `getDocumentDetails` in `platform/src/services/ragleafApi.ts`.
- [ ] Task 5: Design and implement the "Detay & Log" modal in `platform/src/pages/tenant/TenantDocuments.tsx` including quality gauge, suggestions, and vertical log timeline.
- [ ] Task 6: Write unit tests in `backend/tests/test_document_details.py` to cover endpoint status, heuristics, and health telemetry.
- [ ] Task 7: Run backend test suite via Docker Compose to verify implementation.
