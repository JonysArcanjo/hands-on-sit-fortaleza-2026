UPDATE workshops
SET starts_at = '2026-10-31', updated_at = CURRENT_TIMESTAMP
WHERE starts_at LIKE '2026-09-19%'
  AND title IN (
    'SAP Build Apps: do zero ao protótipo',
    'Integrações inteligentes com SAP BTP',
    'Clean Core na prática'
  );
