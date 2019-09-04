import json
from sys import argv

import psycopg2

connection_string = argv[1]
conn = psycopg2.connect(connection_string)
cursor = conn.cursor()

# Fix muni lookups
"""
SELECT DISTINCT("MUNICIPIO") FROM "Sol_MINED_2019_024_coordenadas" WHERE "DEPARTAMENTO" LIKE 'CUSCATLAN';

# lakes+
SAN MIGUEL > SAN RAFAEL
SONSONATE > SANTO DOMINGO
"""

geo_areas = json.loads(open('../data/municipios.geojson', 'r').read())
schools_by_muni = {}
for geo in geo_areas["features"]:
    #print(geo["properties"])
    dept = geo["properties"]["NAME_1"].upper()
    dept = dept.replace('Á', 'A').replace('Ñ','N').replace('Ó','O').replace('Í', 'I').replace('É', 'E')
    muni = geo["properties"]["NAME_2"].upper()
    muni = muni.replace('Á', 'A').replace('Ñ','N').replace('Ó','O').replace('Í', 'I').replace('É', 'E')
    if muni == 'NUEVA SAN SALVADOR':
        muni = 'SANTA TECLA'
    if muni == 'OPICO':
        muni = 'SAN JUAN OPICO'
    if muni == 'SAN RAFAEL ORIENTE' and dept != 'SAN MIGUEL':
        muni = 'SAN RAFAEL'
    if muni == 'SAN RAFAEL' and dept == 'SAN MIGUEL':
        muni = 'SAN RAFAEL ORIENTE'
    if muni == 'DELGADO':
        muni = 'CIUDAD DELGADO'
    if muni == 'SANTA ISABEL ISHUATAN':
        muni = 'ISHUATAN'
    if (muni == 'SANTO DOMINGO' or muni == 'SANTO DOMINGO DE GUZMAN') and dept == 'SONSONATE':
        muni = 'SANTO DOMINGO%'
    if muni == 'EL TRIUNFO':
        muni = 'VILLA EL TRIUNFO'

    cursor.execute('SELECT "CODIGÓ C.E." \
        FROM "Sol_MINED_2019_024_coordenadas" \
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("DEPARTAMENTO", \'Á\', \'A\'), \'Ó\', \'O\'), \'Ñ\', \'N\'), \'Í\', \'I\'), \'É\', \'E\') LIKE \'' + dept + '\' \
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("MUNICIPIO", \'Á\', \'A\'), \'Ó\', \'O\'), \'Ñ\', \'N\'), \'Í\', \'I\'), \'É\', \'E\') LIKE \'' + muni + '\' ')
    count = 0
    student_status = {}
    grades = ['01', '02', '03', '04', '05', '06', '07', '08', '1B']
    for school in cursor.fetchall():
        try:
            sk = json.loads(open('../data/2016/' + str(int(school[0])) + '.json', 'r').read())
            for grade in grades:
                if grade not in student_status:
                    student_status[grade] = [0, 0]
                missing_year = True
                for check_grade in sk.keys():
                    if sk[check_grade]["completed"] > float(sk[check_grade]["total"]) / 10.0 or sk[check_grade]["completed"] > 10:
                        missing_year = False
                if missing_year:
                    #print(sk)
                    continue
                if grade in sk:
                    student_status[grade][0] += sk[grade]["total"]
                    student_status[grade][1] += sk[grade]["completed"]
        except:
           r = 1
        count += 1
    # if count == 0:
    #     print("No schools? " + dept + " > " + muni)
    geo["properties"]["rates"] = student_status
exp = open('export.geojson', 'w')
exp.write(json.dumps(geo_areas))
