-- Basil Media OS · 0026 official partner logos (from each organisation's own website), only where none is set.
update public.partners p set logo_url = v.logo
from (values
  ('Muhimbili National Hospital', '/img/partners/muhimbili-national-hospital.png'),
  ('MUHAS', '/img/partners/muhas.png'),
  ('Aga Khan Hospital, Dar es Salaam', '/img/partners/aga-khan-hospital.svg'),
  ('CRDB Bank Foundation', '/img/partners/crdb-bank-foundation.png'),
  ('Amref Health Africa', '/img/partners/amref-health-africa.png'),
  ('Muhimbili Orthopaedic Institute (MOI)', '/img/partners/moi.png'),
  ('Kairuki University', '/img/partners/kairuki-university.png'),
  ('Tanzania Health Summit', '/img/partners/tanzania-health-summit.png'),
  ('CardioTan · JKCI', '/img/partners/jkci.png')
) as v(name, logo)
where p.name = v.name and coalesce(p.logo_url, '') = '';
