-- Última milla CDMX: precio por parada (sin IVA) Zona 1 = $70 y Zona 2 = $110.
UPDATE "Service" SET "unitPrice" = 70,
  "description" = 'Benito Juárez, Cuauhtémoc, Iztacalco, Venustiano Carranza, Coyoacán y Miguel Hidalgo. Sin límite de cajas por parada. Precio más IVA.'
WHERE "code" = 'UM-02';
UPDATE "Service" SET "unitPrice" = 110,
  "description" = 'Resto de las alcaldías de la Ciudad de México. Sin límite de cajas por parada. Precio más IVA.'
WHERE "code" = 'UM-03';
-- Las tarifas por volumen anteriores quedaban arriba del nuevo precio base: se desactivan
UPDATE "Service" SET "active" = false WHERE "code" IN ('UM-04', 'UM-05', 'UM-06', 'UM-07');
