
-- ============================================
-- PERFORMANCE INDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_al_created_desc ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_al_subject ON access_logs(subject_id);
CREATE INDEX IF NOT EXISTS idx_al_direction ON access_logs(direction);
CREATE INDEX IF NOT EXISTS idx_al_subject_type ON access_logs(subject_type);
CREATE INDEX IF NOT EXISTS idx_al_subject_latest ON access_logs(subject_id, subject_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_as_created_desc ON access_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_as_status ON access_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ec_document ON employee_credentials(document);
CREATE INDEX IF NOT EXISTS idx_assoc_document ON associates(document);
CREATE INDEX IF NOT EXISTS idx_v_document ON visitors(document);
CREATE INDEX IF NOT EXISTS idx_v_status ON visitors(status);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_created_desc ON audit_logs(created_at DESC);

-- ============================================
-- BASE VIEW: access_events_enriched
-- ============================================
CREATE OR REPLACE VIEW public.access_events_enriched AS
SELECT
  al.id,
  al.created_at,
  al.subject_type::text AS person_type,
  al.subject_id,
  al.direction::text AS direction,
  al.gate_id,
  al.operator_id,
  COALESCE(ec.full_name, v.full_name, a.full_name) AS person_name,
  COALESCE(ec.document, v.document, a.document) AS document,
  COALESCE(
    CASE WHEN ec.type = 'vehicle' THEN ec.vehicle_plate END,
    v.vehicle_plate
  ) AS vehicle_plate,
  COALESCE(
    CASE WHEN ec.type = 'vehicle' THEN ec.vehicle_make_model END,
    CASE WHEN v.vehicle_brand IS NOT NULL THEN v.vehicle_brand || ' ' || COALESCE(v.vehicle_model,'') END
  ) AS vehicle_model,
  COALESCE(ec.status::text, v.status::text, a.status) AS entity_status,
  ec_resp.full_name AS responsible_name,
  d.name AS department_name,
  v.company_reason,
  v.visit_to_name,
  c.name AS company_name,
  a.relationship_type,
  ec.job_title,
  ec.credential_id
FROM access_logs al
LEFT JOIN employee_credentials ec ON al.subject_type='employee' AND al.subject_id=ec.id
LEFT JOIN visitors v ON al.subject_type='visitor' AND al.subject_id=v.id
LEFT JOIN associates a ON al.subject_type='associate' AND al.subject_id=a.id
LEFT JOIN employee_credentials ec_resp ON a.employee_credential_id=ec_resp.id
LEFT JOIN departments d ON ec.department_id=d.id
LEFT JOIN companies c ON v.company_id=c.id;

-- ============================================
-- RPC 1: Person Timeline
-- ============================================
CREATE OR REPLACE FUNCTION public.report_person_timeline(
  p_document text DEFAULT NULL, p_name text DEFAULT NULL,
  p_person_type text DEFAULT NULL, p_start text DEFAULT NULL,
  p_end text DEFAULT NULL, p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, created_at timestamptz, person_name text, document text,
  person_type text, direction text, gate_id text, vehicle_plate text,
  vehicle_model text, entity_status text, responsible_name text,
  department_name text, company_name text, relationship_type text,
  visit_to_name text, company_reason text
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.id,e.created_at,e.person_name,e.document,e.person_type,
    e.direction,e.gate_id,e.vehicle_plate,e.vehicle_model,
    e.entity_status,e.responsible_name,e.department_name,
    e.company_name,e.relationship_type,e.visit_to_name,e.company_reason
  FROM access_events_enriched e
  WHERE (p_document IS NULL OR e.document ILIKE '%'||p_document||'%')
    AND (p_name IS NULL OR e.person_name ILIKE '%'||p_name||'%')
    AND (p_person_type IS NULL OR e.person_type=p_person_type)
    AND (p_start IS NULL OR e.created_at>=p_start::timestamptz)
    AND (p_end IS NULL OR e.created_at<=p_end::timestamptz)
  ORDER BY e.created_at DESC LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 2: Vehicle Activity
-- ============================================
CREATE OR REPLACE FUNCTION public.report_vehicle_activity(
  p_plate text DEFAULT NULL, p_owner text DEFAULT NULL,
  p_start text DEFAULT NULL, p_end text DEFAULT NULL,
  p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, created_at timestamptz, person_name text, person_type text,
  document text, direction text, gate_id text, vehicle_plate text,
  vehicle_model text, entity_status text, responsible_name text
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.id,e.created_at,e.person_name,e.person_type,e.document,
    e.direction,e.gate_id,e.vehicle_plate,e.vehicle_model,
    e.entity_status,e.responsible_name
  FROM access_events_enriched e
  WHERE e.vehicle_plate IS NOT NULL
    AND (p_plate IS NULL OR e.vehicle_plate ILIKE '%'||p_plate||'%')
    AND (p_owner IS NULL OR e.person_name ILIKE '%'||p_owner||'%')
    AND (p_start IS NULL OR e.created_at>=p_start::timestamptz)
    AND (p_end IS NULL OR e.created_at<=p_end::timestamptz)
  ORDER BY e.created_at DESC LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 3: Sessions
-- ============================================
CREATE OR REPLACE FUNCTION public.report_sessions(
  p_status text DEFAULT NULL, p_session_type text DEFAULT NULL,
  p_start text DEFAULT NULL, p_end text DEFAULT NULL,
  p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, created_at timestamptz, session_type text, status text,
  first_scan text, completed_at timestamptz, expires_at timestamptz,
  denial_reason text, authorization_type text, person_name text,
  person_type text, vehicle_plate text, vehicle_model text, visitor_name text
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id,s.created_at,s.session_type,s.status,s.first_scan,
    s.completed_at,s.expires_at,s.denial_reason,s.authorization_type,
    COALESCE(ec.full_name,a.full_name) AS person_name,
    CASE WHEN s.person_credential_id IS NOT NULL THEN 'employee'
         WHEN s.associate_id IS NOT NULL THEN 'associate' ELSE NULL END,
    vc.vehicle_plate,vc.vehicle_make_model,v.full_name
  FROM access_sessions s
  LEFT JOIN employee_credentials ec ON s.person_credential_id=ec.id
  LEFT JOIN employee_credentials vc ON s.vehicle_credential_id=vc.id
  LEFT JOIN associates a ON s.associate_id=a.id
  LEFT JOIN visitors v ON s.visitor_id=v.id
  WHERE (p_status IS NULL OR s.status=p_status)
    AND (p_session_type IS NULL OR s.session_type=p_session_type)
    AND (p_start IS NULL OR s.created_at>=p_start::timestamptz)
    AND (p_end IS NULL OR s.created_at<=p_end::timestamptz)
  ORDER BY s.created_at DESC LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 4: Denials
-- ============================================
CREATE OR REPLACE FUNCTION public.report_denials(
  p_start text DEFAULT NULL, p_end text DEFAULT NULL,
  p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, created_at timestamptz, person_name text, person_type text,
  document text, vehicle_plate text, denial_reason text,
  session_type text, operator_name text
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT s.id,s.created_at,
    COALESCE(ec.full_name,a.full_name,v.full_name),
    CASE WHEN s.person_credential_id IS NOT NULL THEN 'employee'
         WHEN s.associate_id IS NOT NULL THEN 'associate'
         WHEN s.visitor_id IS NOT NULL THEN 'visitor' ELSE 'unknown' END,
    COALESCE(ec.document,a.document,v.document),
    vc.vehicle_plate,s.denial_reason,s.session_type,
    p.full_name
  FROM access_sessions s
  LEFT JOIN employee_credentials ec ON s.person_credential_id=ec.id
  LEFT JOIN employee_credentials vc ON s.vehicle_credential_id=vc.id
  LEFT JOIN associates a ON s.associate_id=a.id
  LEFT JOIN visitors v ON s.visitor_id=v.id
  LEFT JOIN profiles p ON s.operator_id=p.user_id
  WHERE s.status='denied'
    AND (p_start IS NULL OR s.created_at>=p_start::timestamptz)
    AND (p_end IS NULL OR s.created_at<=p_end::timestamptz)
  ORDER BY s.created_at DESC LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 5: Presence Now
-- ============================================
CREATE OR REPLACE FUNCTION public.report_presence_now(
  p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  subject_id uuid, person_name text, document text, person_type text,
  entry_time timestamptz, gate_id text, vehicle_plate text,
  responsible_name text, department_name text, duration_minutes int
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH last_events AS (
    SELECT DISTINCT ON (e.subject_id,e.person_type)
      e.subject_id,e.person_name,e.document,e.person_type,
      e.created_at,e.gate_id,e.direction,e.vehicle_plate,
      e.responsible_name,e.department_name
    FROM access_events_enriched e
    ORDER BY e.subject_id,e.person_type,e.created_at DESC
  )
  SELECT le.subject_id,le.person_name,le.document,le.person_type,
    le.created_at,le.gate_id,le.vehicle_plate,le.responsible_name,
    le.department_name,
    EXTRACT(EPOCH FROM (now()-le.created_at))::int/60
  FROM last_events le WHERE le.direction='in'
  ORDER BY le.created_at ASC LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 6: Permanence
-- ============================================
CREATE OR REPLACE FUNCTION public.report_permanence(
  p_document text DEFAULT NULL, p_person_type text DEFAULT NULL,
  p_start text DEFAULT NULL, p_end text DEFAULT NULL,
  p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  subject_id uuid, person_name text, document text, person_type text,
  entry_time timestamptz, exit_time timestamptz, duration_minutes int,
  gate_id text, vehicle_plate text
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH all_events AS (
    SELECT e.subject_id,e.person_name,e.document,e.person_type,
      e.created_at,e.direction,e.gate_id,e.vehicle_plate
    FROM access_events_enriched e
    WHERE (p_start IS NULL OR e.created_at>=p_start::timestamptz)
      AND (p_end IS NULL OR e.created_at<=p_end::timestamptz)
      AND (p_document IS NULL OR e.document ILIKE '%'||p_document||'%')
      AND (p_person_type IS NULL OR e.person_type=p_person_type)
  ), with_next AS (
    SELECT *, LEAD(created_at) OVER w AS next_time,
      LEAD(direction) OVER w AS next_dir
    FROM all_events
    WINDOW w AS (PARTITION BY subject_id,person_type ORDER BY created_at)
  )
  SELECT subject_id,person_name,document,person_type,
    created_at,
    CASE WHEN next_dir='out' THEN next_time END,
    CASE WHEN next_dir='out' THEN EXTRACT(EPOCH FROM(next_time-created_at))::int/60 END,
    gate_id,vehicle_plate
  FROM with_next WHERE direction='in'
  ORDER BY created_at DESC LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 7: Visitors Detailed
-- ============================================
CREATE OR REPLACE FUNCTION public.report_visitors_detailed(
  p_status text DEFAULT NULL, p_start text DEFAULT NULL,
  p_end text DEFAULT NULL, p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, full_name text, document text, company_name text,
  company_reason text, visit_to_name text, visit_to_type text,
  status text, access_type text, vehicle_plate text,
  valid_from timestamptz, valid_until timestamptz, created_at timestamptz,
  entry_count bigint, exit_count bigint, last_access timestamptz
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT v.id,v.full_name,v.document,c.name,v.company_reason,
    v.visit_to_name,v.visit_to_type::text,v.status::text,v.access_type::text,
    v.vehicle_plate,v.valid_from,v.valid_until,v.created_at,
    (SELECT COUNT(*) FROM access_logs al WHERE al.subject_type='visitor' AND al.subject_id=v.id AND al.direction='in'),
    (SELECT COUNT(*) FROM access_logs al WHERE al.subject_type='visitor' AND al.subject_id=v.id AND al.direction='out'),
    (SELECT MAX(al.created_at) FROM access_logs al WHERE al.subject_type='visitor' AND al.subject_id=v.id)
  FROM visitors v LEFT JOIN companies c ON v.company_id=c.id
  WHERE (p_status IS NULL OR v.status::text=p_status)
    AND (p_start IS NULL OR v.created_at>=p_start::timestamptz)
    AND (p_end IS NULL OR v.created_at<=p_end::timestamptz)
  ORDER BY v.created_at DESC LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 8: Employees Detailed
-- ============================================
CREATE OR REPLACE FUNCTION public.report_employees_detailed(
  p_department text DEFAULT NULL, p_status text DEFAULT NULL,
  p_start text DEFAULT NULL, p_end text DEFAULT NULL,
  p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, full_name text, document text, credential_id text,
  department_name text, job_title text, status text, created_at timestamptz,
  access_count bigint, last_access timestamptz,
  vehicle_count bigint, associate_count bigint
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT ec.id,ec.full_name,ec.document,ec.credential_id,
    d.name,ec.job_title,ec.status::text,ec.created_at,
    (SELECT COUNT(*) FROM access_logs al WHERE al.subject_type='employee' AND al.subject_id=ec.id
      AND (p_start IS NULL OR al.created_at>=p_start::timestamptz)
      AND (p_end IS NULL OR al.created_at<=p_end::timestamptz)),
    (SELECT MAX(al.created_at) FROM access_logs al WHERE al.subject_type='employee' AND al.subject_id=ec.id),
    (SELECT COUNT(*) FROM employee_credentials v2 WHERE v2.document=ec.document AND v2.type='vehicle'),
    (SELECT COUNT(*) FROM associates a WHERE a.employee_credential_id=ec.id AND a.status='active')
  FROM employee_credentials ec LEFT JOIN departments d ON ec.department_id=d.id
  WHERE ec.type='personal'
    AND (p_status IS NULL OR ec.status::text=p_status)
    AND (p_department IS NULL OR d.name ILIKE '%'||p_department||'%')
  ORDER BY ec.full_name LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 9: Associates Detailed
-- ============================================
CREATE OR REPLACE FUNCTION public.report_associates_detailed(
  p_status text DEFAULT NULL, p_start text DEFAULT NULL,
  p_end text DEFAULT NULL, p_limit int DEFAULT 200, p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid, full_name text, document text, pass_id text,
  relationship_type text, responsible_name text, responsible_document text,
  status text, validity_type text, valid_from timestamptz,
  valid_until timestamptz, created_at timestamptz,
  access_count bigint, last_access timestamptz, vehicle_auth_count bigint
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT a.id,a.full_name,a.document,a.pass_id,a.relationship_type,
    ec.full_name,ec.document,a.status,a.validity_type,
    a.valid_from,a.valid_until,a.created_at,
    (SELECT COUNT(*) FROM access_logs al WHERE al.subject_type='associate' AND al.subject_id=a.id
      AND (p_start IS NULL OR al.created_at>=p_start::timestamptz)
      AND (p_end IS NULL OR al.created_at<=p_end::timestamptz)),
    (SELECT MAX(al.created_at) FROM access_logs al WHERE al.subject_type='associate' AND al.subject_id=a.id),
    (SELECT COUNT(*) FROM vehicle_authorized_drivers vad WHERE vad.associate_id=a.id AND vad.is_active=true)
  FROM associates a LEFT JOIN employee_credentials ec ON a.employee_credential_id=ec.id
  WHERE (p_status IS NULL OR a.status=p_status)
  ORDER BY a.full_name LIMIT p_limit OFFSET p_offset;
$$;

-- ============================================
-- RPC 10: Executive Summary
-- ============================================
CREATE OR REPLACE FUNCTION public.report_executive_summary(
  p_start text DEFAULT NULL, p_end text DEFAULT NULL
) RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  result json;
  v_start timestamptz := COALESCE(p_start::timestamptz, CURRENT_DATE - interval '30 days');
  v_end timestamptz := COALESCE(p_end::timestamptz, now());
BEGIN
  SELECT json_build_object(
    'total_entries', (SELECT COUNT(*) FROM access_logs WHERE direction='in' AND created_at BETWEEN v_start AND v_end),
    'total_exits', (SELECT COUNT(*) FROM access_logs WHERE direction='out' AND created_at BETWEEN v_start AND v_end),
    'unique_visitors', (SELECT COUNT(DISTINCT subject_id) FROM access_logs WHERE subject_type='visitor' AND created_at BETWEEN v_start AND v_end),
    'unique_employees', (SELECT COUNT(DISTINCT subject_id) FROM access_logs WHERE subject_type='employee' AND created_at BETWEEN v_start AND v_end),
    'unique_associates', (SELECT COUNT(DISTINCT subject_id) FROM access_logs WHERE subject_type='associate' AND created_at BETWEEN v_start AND v_end),
    'unique_vehicles', (SELECT COUNT(DISTINCT e.vehicle_plate) FROM access_events_enriched e WHERE e.vehicle_plate IS NOT NULL AND e.created_at BETWEEN v_start AND v_end),
    'total_denials', (SELECT COUNT(*) FROM access_sessions WHERE status='denied' AND created_at BETWEEN v_start AND v_end),
    'total_expired_unused', (SELECT COUNT(*) FROM visitors WHERE status='expired_unused' AND created_at BETWEEN v_start AND v_end),
    'currently_inside', (SELECT COUNT(*) FROM (SELECT DISTINCT ON(subject_id,subject_type) direction FROM access_logs ORDER BY subject_id,subject_type,created_at DESC) sub WHERE direction='in'),
    'peak_hour', (SELECT EXTRACT(HOUR FROM created_at)::int FROM access_logs WHERE created_at BETWEEN v_start AND v_end GROUP BY EXTRACT(HOUR FROM created_at) ORDER BY COUNT(*) DESC LIMIT 1),
    'top_gates', (SELECT COALESCE(json_agg(row_to_json(g)),'[]'::json) FROM (SELECT gate_id,COUNT(*) as total FROM access_logs WHERE created_at BETWEEN v_start AND v_end GROUP BY gate_id ORDER BY total DESC LIMIT 5) g),
    'top_departments', (SELECT COALESCE(json_agg(row_to_json(dp)),'[]'::json) FROM (SELECT COALESCE(d.name,'Sem setor') as department,COUNT(*) as total FROM access_logs al LEFT JOIN employee_credentials ec ON al.subject_type='employee' AND al.subject_id=ec.id LEFT JOIN departments d ON ec.department_id=d.id WHERE al.created_at BETWEEN v_start AND v_end AND al.subject_type='employee' GROUP BY d.name ORDER BY total DESC LIMIT 5) dp),
    'by_entity_type', json_build_object(
      'visitors',(SELECT COUNT(*) FROM access_logs WHERE subject_type='visitor' AND created_at BETWEEN v_start AND v_end),
      'employees',(SELECT COUNT(*) FROM access_logs WHERE subject_type='employee' AND created_at BETWEEN v_start AND v_end),
      'associates',(SELECT COUNT(*) FROM access_logs WHERE subject_type='associate' AND created_at BETWEEN v_start AND v_end)
    ),
    'daily_breakdown', (SELECT COALESCE(json_agg(row_to_json(db) ORDER BY db.day),'[]'::json) FROM (SELECT created_at::date as day,COUNT(*) FILTER(WHERE direction='in') as entries,COUNT(*) FILTER(WHERE direction='out') as exits,COUNT(DISTINCT subject_id) as unique_people FROM access_logs WHERE created_at BETWEEN v_start AND v_end GROUP BY created_at::date) db)
  ) INTO result;
  RETURN result;
END;
$$;
