-- Add missing on-prem report RPCs for vehicle sessions and visitor operations

CREATE OR REPLACE FUNCTION public.report_vehicle_sessions(
  p_plate text DEFAULT NULL,
  p_owner text DEFAULT NULL,
  p_start text DEFAULT NULL,
  p_end text DEFAULT NULL,
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
) RETURNS TABLE(
  vehicle_plate text,
  vehicle_model text,
  person_name text,
  person_type text,
  document text,
  gate_id text,
  entry_time timestamptz,
  exit_time timestamptz,
  duration_minutes int,
  session_status text
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH evts AS (
    SELECT e.subject_id, e.person_name, e.person_type, e.document,
      e.created_at, e.direction, e.gate_id, e.vehicle_plate, e.vehicle_model
    FROM access_events_enriched e
    WHERE e.vehicle_plate IS NOT NULL
      AND (p_plate IS NULL OR e.vehicle_plate ILIKE '%' || p_plate || '%')
      AND (p_owner IS NULL OR e.person_name ILIKE '%' || p_owner || '%')
      AND (p_start IS NULL OR e.created_at >= p_start::timestamptz)
      AND (p_end IS NULL OR e.created_at <= p_end::timestamptz)
  ),
  paired AS (
    SELECT *,
      LEAD(created_at) OVER w AS next_time,
      LEAD(direction) OVER w AS next_dir,
      LAG(direction) OVER w AS prev_dir
    FROM evts
    WINDOW w AS (PARTITION BY subject_id, person_type, vehicle_plate ORDER BY created_at)
  )
  SELECT p.vehicle_plate, p.vehicle_model, p.person_name, p.person_type,
    p.document, p.gate_id,
    p.created_at AS entry_time,
    CASE WHEN p.next_dir = 'out' THEN p.next_time END AS exit_time,
    CASE WHEN p.next_dir = 'out'
      THEN EXTRACT(EPOCH FROM (p.next_time - p.created_at))::int / 60
    END AS duration_minutes,
    CASE
      WHEN p.next_dir = 'out' THEN 'Finalizado'
      WHEN p.next_dir IS NULL THEN 'Dentro'
      ELSE 'Inconsistente'
    END AS session_status
  FROM paired p
  WHERE p.direction = 'in'

  UNION ALL

  SELECT p.vehicle_plate, p.vehicle_model, p.person_name, p.person_type,
    p.document, p.gate_id,
    NULL::timestamptz AS entry_time,
    p.created_at AS exit_time,
    NULL::integer AS duration_minutes,
    'Incompleto' AS session_status
  FROM paired p
  WHERE p.direction = 'out'
    AND (p.prev_dir IS NULL OR p.prev_dir = 'out')

  ORDER BY entry_time DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$$;

CREATE OR REPLACE FUNCTION public.report_visitors_operational(
  p_status text DEFAULT NULL,
  p_start text DEFAULT NULL,
  p_end text DEFAULT NULL,
  p_limit int DEFAULT 200,
  p_offset int DEFAULT 0
) RETURNS TABLE(
  id uuid,
  full_name text,
  document text,
  company_name text,
  company_reason text,
  visit_to_name text,
  visit_to_type text,
  access_type text,
  gate_id text,
  entry_time timestamptz,
  exit_time timestamptz,
  duration_minutes int,
  operational_status text,
  valid_from timestamptz,
  valid_until timestamptz
) LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH visitor_logs AS (
    SELECT al.subject_id AS vid, al.created_at, al.direction, al.gate_id,
      LEAD(al.created_at) OVER w AS next_time,
      LEAD(al.direction) OVER w AS next_dir
    FROM access_logs al
    WHERE al.subject_type = 'visitor'
    WINDOW w AS (PARTITION BY al.subject_id ORDER BY al.created_at)
  ),
  sessions AS (
    SELECT vl.vid, vl.gate_id, vl.created_at AS entry_time,
      CASE WHEN vl.next_dir = 'out' THEN vl.next_time END AS exit_time,
      CASE WHEN vl.next_dir = 'out'
        THEN EXTRACT(EPOCH FROM (vl.next_time - vl.created_at))::int / 60
      END AS dur,
      CASE
        WHEN vl.next_dir = 'out' THEN 'Finalizado'
        WHEN vl.next_dir IS NULL THEN 'Dentro'
        ELSE 'Inconsistente'
      END AS op_status
    FROM visitor_logs vl
    WHERE vl.direction = 'in'
  ),
  denied AS (
    SELECT s.visitor_id AS vid, s.created_at, 'Negado'::text AS op_status
    FROM access_sessions s
    WHERE s.status = 'denied' AND s.visitor_id IS NOT NULL
  ),
  no_access AS (
    SELECT v2.id AS vid,
      CASE
        WHEN v2.status = 'expired_unused' THEN 'Expirado sem uso'
        WHEN v2.status = 'pending' THEN 'Pendente'
        ELSE v2.status::text
      END AS op_status
    FROM visitors v2
    WHERE NOT EXISTS (
      SELECT 1 FROM access_logs al2
      WHERE al2.subject_type = 'visitor' AND al2.subject_id = v2.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM access_sessions s2
      WHERE s2.visitor_id = v2.id AND s2.status = 'denied'
    )
  ),
  combined AS (
    SELECT v.id, v.full_name, v.document, c.name AS company_name, v.company_reason,
      v.visit_to_name, v.visit_to_type::text, v.access_type::text,
      ss.gate_id, ss.entry_time, ss.exit_time, ss.dur AS duration_minutes,
      ss.op_status AS operational_status, v.valid_from, v.valid_until,
      COALESCE(ss.entry_time, v.created_at) AS sort_key
    FROM sessions ss
    JOIN visitors v ON v.id = ss.vid
    LEFT JOIN companies c ON v.company_id = c.id

    UNION ALL

    SELECT v.id, v.full_name, v.document, c.name, v.company_reason,
      v.visit_to_name, v.visit_to_type::text, v.access_type::text,
      NULL, d.created_at, NULL, NULL, d.op_status, v.valid_from, v.valid_until,
      d.created_at AS sort_key
    FROM denied d
    JOIN visitors v ON v.id = d.vid
    LEFT JOIN companies c ON v.company_id = c.id

    UNION ALL

    SELECT v.id, v.full_name, v.document, c.name, v.company_reason,
      v.visit_to_name, v.visit_to_type::text, v.access_type::text,
      NULL, NULL, NULL, NULL, na.op_status, v.valid_from, v.valid_until,
      v.created_at AS sort_key
    FROM no_access na
    JOIN visitors v ON v.id = na.vid
    LEFT JOIN companies c ON v.company_id = c.id
  )
  SELECT c.id, c.full_name, c.document, c.company_name, c.company_reason,
    c.visit_to_name, c.visit_to_type, c.access_type, c.gate_id,
    c.entry_time, c.exit_time, c.duration_minutes, c.operational_status,
    c.valid_from, c.valid_until
  FROM combined c
  WHERE (p_status IS NULL OR c.operational_status = p_status)
    AND (p_start IS NULL OR c.sort_key >= p_start::timestamptz)
    AND (p_end IS NULL OR c.sort_key <= p_end::timestamptz)
  ORDER BY c.sort_key DESC NULLS LAST
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.report_vehicle_sessions(text, text, text, text, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.report_visitors_operational(text, text, text, integer, integer) TO authenticated, service_role;