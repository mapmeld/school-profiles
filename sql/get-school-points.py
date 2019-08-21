 UPDATE geo_schools SET dept = (
    SELECT "DEPARTAMENTO"
    FROM "Sol_MINED_2019_024_coordenadas"
    WHERE "CODIGÓ C.E."::text = school_code
    LIMIT 1
);
 UPDATE geo_schools SET muni = (
    SELECT "MUNICIPIO"
    FROM "Sol_MINED_2019_024_coordenadas"
    WHERE "CODIGÓ C.E."::text = school_code
    LIMIT 1
);

 UPDATE geo_schools SET nombre = (
    SELECT "NOMBRE C.E."
    FROM "Sol_MINED_2019_024_coordenadas"
    WHERE "CODIGÓ C.E."::text = school_code
    LIMIT 1
);

CREATE TABLE school_points AS (
    SELECT ST_X(point::geometry) AS lng,
            ST_Y(point::geometry) AS lat,
            school_code AS codigo,
            nombre,
            dept,
            muni
            FROM geo_schools
);
