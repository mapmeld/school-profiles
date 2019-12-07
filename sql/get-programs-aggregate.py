import json
from sys import argv

import psycopg2
from psycopg2.extras import RealDictCursor

connection_string = argv[1]
conn = psycopg2.connect(connection_string)
cursor = conn.cursor(cursor_factory=RealDictCursor)

programs = {
    'D02c_3': 'paquete',
    'D02c_8': 'leche',
    'D02c_2': 'psych',
    'D02c_4': 'parents'
}

for program_col in programs.keys():
    program_name = programs[program_col]
    print(program_name)

    # consistently yes
    always = []
    cursor.execute('WITH x AS \
        (SELECT "A02" as school_code, MIN("ANIO") AS min, MAX("ANIO") AS max \
        FROM consolidados_limited \
        WHERE "' + program_col + '" \
        GROUP BY "A02")\
    SELECT * from x WHERE min = 2014 AND max = 2016')
    for row in cursor.fetchall():
        school_code = row['school_code']
        always.append(school_code)

    # added
    added = []
    cursor.execute('WITH x AS \
        (SELECT "A02" as school_code, MIN("ANIO") AS min, MAX("ANIO") AS max \
        FROM consolidados_limited \
        WHERE "' + program_col + '" \
        GROUP BY "A02")\
    SELECT * from x WHERE min = 2015 AND max = 2016')
    for row in cursor.fetchall():
        school_code = row['school_code']
        added.append(school_code)

    # dropped
    dropped = []
    cursor.execute('WITH x AS \
        (SELECT "A02" as school_code, MIN("ANIO") AS min, MAX("ANIO") AS max \
        FROM consolidados_limited \
        WHERE "' + program_col + '" \
        GROUP BY "A02")\
    SELECT * from x WHERE min = 2014 AND max = 2014')
    for row in cursor.fetchall():
        school_code = row['school_code']
        dropped.append(school_code)

    print('always: ' + str(len(always)))
    print('added: ' + str(len(added)))
    print('dropped: ' + str(len(dropped)))

    """
    capture enrollment, grades 1-4
    D02c - which programs are used (2014-2016)
    paquete (D02c_3), leche (D02c_8)
    psych (D02c_2), parents (D02c_4)
    F09a1 (2014-16) H01e (17+18) - laptops, H01a (computers in general)
    """

    groups = ['always', 'added', 'dropped']
    group_index = -1
    for group in [always, added, dropped]:
        group_index += 1
        group_name = groups[group_index]
        print(group_name)

        data_by_school = {}

        for year in range(2013, 2018): # ends in 2018
            print(year)
            for grade in range(1, 5): # ends in grade 4
                cursor.execute('SELECT school_code, \
                    COUNT(*) AS students_in_grade \
                    FROM progress_' + str(year) + '_0' + str(grade) + '_to_0' + str(grade + 1) + ' \
                    WHERE school_code in (\'' + "','".join(group) + '\') \
                    GROUP BY school_code')
                for row in cursor.fetchall():
                    school_code = row['school_code']
                    if school_code not in data_by_school:
                        data_by_school[school_code] = {}
                    if grade not in data_by_school[school_code]:
                        data_by_school[school_code][grade] = []
                    data_by_school[school_code][grade].append([year, row['students_in_grade']])
        op = open('../data/programs/' + program_name + '_' + group_name + '.json', 'w')
        op.write(json.dumps(data_by_school))
        op.close()
