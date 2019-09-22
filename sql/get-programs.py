import json
from sys import argv

import psycopg2
from psycopg2.extras import RealDictCursor

connection_string = argv[1]
conn = psycopg2.connect(connection_string)
cursor = conn.cursor(cursor_factory=RealDictCursor)

"""
capture enrollment, grades 1-4, 2012-2017
D02c - which programs are used (2014-2016)
paquete (D02c_3), leche (D02c_8)
psych (D02c_2), parents (D02c_4)
F09a1 (2014-16) H01e (17+18) - laptops, H01a (computers in general)
"""

data_by_school = {}

for year in range(2013, 2018): # ends in 2017
    print(year)
    for grade in range(1, 5): # ends in grade 4
        cursor.execute('SELECT school_code, \
            COUNT(*) AS students_in_grade \
            FROM progress_' + str(year) + '_0' + str(grade) + '_to_0' + str(grade + 1) + ' \
            GROUP BY school_code')
        for row in cursor.fetchall():
            school_code = row['school_code']
            if school_code not in data_by_school:
                data_by_school[school_code] = {}
            if year not in data_by_school[school_code]:
                data_by_school[school_code][year] = {}
            data_by_school[school_code][year][grade] = { 'total': int(row['students_in_grade']) }

programs = {
    'D02c_3': 'paquete',
    'D02c_8': 'leche',
    'D02c_2': 'psych',
    'D02c_4': 'parents'
}

for program_col in programs.keys():
    program_name = programs[program_col]
    print(program_name)
    cursor.execute('SELECT "A02" as school_code, MIN("ANIO") AS min, MAX("ANIO") AS max \
        FROM consolidados_limited \
        WHERE "' + program_col + '" \
        GROUP BY "A02"')
    for row in cursor.fetchall():
        school_code = row['school_code']
        if school_code in data_by_school:
            data_by_school[school_code][program_name] = [int(row['min']), int(row['max'])]

programs2 = {
    'F09a1': 'laptops',
    'H01e': 'laptops2'
}

for program_col in programs2.keys():
    program_name = programs2[program_col]
    print(program_name)
    cursor.execute('SELECT "A02" as school_code, "ANIO", "' + program_col + '" \
        FROM consolidado_datos')
    for row in cursor.fetchall():
        school_code = row['school_code']
        year = int(row['ANIO'])
        if school_code in data_by_school and year in data_by_school[school_code] and row[program_col] is not None:
            try:
                data_by_school[school_code][year]["laptops"] = int(row[program_col])
            except:
                sometimes_int = 'h01e'

print("output JSON")
for school_code in data_by_school.keys():
    op = open('data/programs/' + school_code + '.json', 'w')
    op.write(json.dumps(data_by_school[school_code], separators=(',', ':')))
