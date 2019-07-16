import json
from sys import argv
from os import system

import psycopg2
from psycopg2.extras import RealDictCursor

connection_string = argv[1]
conn = psycopg2.connect(connection_string)
cursor = conn.cursor(cursor_factory=RealDictCursor)

years = [2017]
school_levels = {
    'students_plus_dates': [
        '01','02','03','04','05','06','07','08','09'
    ],
    'high_school_students': [
       '1B', '2B', '3B', '4B'
    ]
}

for year in years:
    data_by_school = {}

    for sktype in school_levels.keys():
        for grade in school_levels[sktype][:-1]:
            next_grade = school_levels[sktype][school_levels[sktype].index(grade) + 1]

            print(grade + ' to ' + next_grade)

            cursor.execute('SELECT school_code, \
                COUNT(*) AS students_in_grade \
                FROM progress_' + str(year) + '_' + grade + '_to_' + next_grade + ' \
                GROUP BY school_code')
            for row in cursor.fetchall():
                school_code = row['school_code']
                if school_code not in data_by_school:
                    data_by_school[school_code] = {}
                data_by_school[school_code][grade] = { 'total': int(row['students_in_grade']) }

            cursor.execute('SELECT school_code, \
                COUNT(*) AS students_in_grade \
                FROM progress_' + str(year) + '_' + grade + '_to_' + next_grade + ' \
                WHERE NOT repeated \
                    AND NOT temp_dropped_out \
                    AND NOT perm_dropped_out \
                GROUP BY school_code')
            for row in cursor.fetchall():
                school_code = row['school_code']
                data_by_school[school_code][grade]['completed'] = int(row['students_in_grade'])

            for action in ['repeated', 'moved']:
                cursor.execute('SELECT school_code, \
                    COUNT(*) AS students_in_grade \
                    FROM progress_' + str(year) + '_' + grade + '_to_' + next_grade + ' \
                    WHERE ' + action + ' \
                    GROUP BY school_code')
                for row in cursor.fetchall():
                    school_code = row['school_code']
                    data_by_school[school_code][grade][action] = int(row['students_in_grade'])

    for school in data_by_school.keys():
        if school is not None:
            op = open('data/' + str(year) + '/' + school + '.json', 'w')
            op.write(json.dumps(data_by_school[school]))

conn.close()
