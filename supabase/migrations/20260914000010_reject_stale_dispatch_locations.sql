-- ==============================================================================
-- RAN-R-HAN: stale GPS positions are never eligible for automatic dispatch
--
-- Preserve the existing function body and its empty-result contract. This only
-- adds one eligibility predicate; zero matching riders still returns zero rows.
-- ==============================================================================

begin;

do $migration$
declare
  v_oid regprocedure := to_regprocedure(
    'public.find_available_riders(uuid,double precision,double precision,double precision,uuid[])'
  );
  v_definition text;
  v_pattern text := $old$    and r.status = 'active'
    -- Spatial filter — อยู่ในรัศมี$old$;
  v_replacement text := $new$    and r.status = 'active'
    -- A location older than the GPS safety window is not a live dispatch signal.
    and rcl.updated_at >= statement_timestamp() - interval '90 seconds'
    -- Spatial filter — อยู่ในรัศมี$new$;
  v_occurrences integer;
begin
  if v_oid is null then
    raise exception 'MIGRATION_TARGET_MISSING: find_available_riders';
  end if;

  v_definition := replace(pg_get_functiondef(v_oid), chr(13), '');
  v_occurrences := (
    length(v_definition) - length(replace(v_definition, v_pattern, ''))
  ) / length(v_pattern);

  if v_occurrences <> 1 then
    raise exception
      'MIGRATION_PATTERN_COUNT_MISMATCH: find_available_riders freshness expected 1 occurrence, found %',
      v_occurrences;
  end if;

  execute replace(v_definition, v_pattern, v_replacement);
end;
$migration$;

commit;
