-- Drop old constraint and recreate with expanded values
ALTER TABLE public.associates
DROP CONSTRAINT IF EXISTS associates_relationship_type_check;

ALTER TABLE public.associates
ADD CONSTRAINT associates_relationship_type_check
CHECK (
  relationship_type IN (
    'conjuge',
    'pai',
    'mae',
    'motorista_particular',
    'outro',
    'irmao',
    'irma',
    'namorado',
    'namorada',
    'filho',
    'filha'
  )
);