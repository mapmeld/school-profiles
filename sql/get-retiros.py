import json
from sys import argv
from os import system

import psycopg2
from psycopg2.extras import RealDictCursor

connection_string = argv[1]
conn = psycopg2.connect(connection_string)
cursor = conn.cursor(cursor_factory=RealDictCursor)

years = range(2010, 2019) # ends with 2018

for year in years:
    print(year)
    data_by_school = {}

    if year in [2011]:
        continue

    cursor.execute('SELECT SUM("ALUMNOS") AS sum, "CÓDIGO C.E."::text AS school_code, "COD. CAUSA" AS cause, SUBSTR("SEXO", 1, 1) AS mf \
        FROM retiros_' + str(year) + ' \
        WHERE "CÓDIGO C.E." IS NOT NULL \
        AND "COD. CAUSA" IS NOT NULL \
        GROUP BY "CÓDIGO C.E.", "COD. CAUSA", "SEXO" \
        ORDER BY "CÓDIGO C.E.", "COD. CAUSA", "SEXO"')
    for row in cursor.fetchall():
        school_code = row['school_code']
        if school_code not in data_by_school:
            data_by_school[school_code] = {}
        data_by_school[school_code][row['cause'] + '_' + row['mf']] = int(row['sum'])

    for school in data_by_school.keys():
        if school is not None:
            op = open('data/' + str(year) + '/retiro_' + school + '.json', 'w')
            op.write(json.dumps(data_by_school[school]))

conn.close()
