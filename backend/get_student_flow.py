# Flask backend for grade outcomes
import os, json
from sys import argv

# pip3 install flask flask-cors psycopg2
import flask
from flask import request
from flask_cors import CORS

import psycopg2
connection_string = argv[1]
conn = psycopg2.connect(connection_string)
cursor = conn.cursor()

"""
SQL - follow these students

SELECT "NIE", "ANIO", "CODIGO_ENTIDAD", "GRADO"
    FROM students_plus_dates
    WHERE "ANIO" > 2017
    AND "NIE" IN (
        SELECT "NIE"
        FROM students_plus_dates
        WHERE "ANIO" = 2017
        AND "GRADO" LIKE '02%'
        AND "CODIGO_ENTIDAD" = '11768'
    )
    ORDER BY "NIE", "ANIO";
"""

app = flask.Flask(__name__)
CORS(app)

@app.route('/track')
def track():
    year = int(request.args.get('year'))
    school = int(request.args.get('school')[1:])
    school = request.args.get('school')
    grade = int(request.args.get('grade'))
    grade = request.args.get('grade')

    cursor.execute("SELECT \"NIE\"::text, \"ANIO\"::text, \"CODIGO_ENTIDAD\", \"GRADO\" \
        FROM students_plus_dates \
        WHERE \"ANIO\" > " + str(year) + " \
        AND \"NIE\" IN ( \
            SELECT \"NIE\" \
            FROM students_plus_dates \
            WHERE \"ANIO\" = " + str(year) + " \
            AND \"GRADO\" LIKE '" + str(grade) + "%' \
            AND \"CODIGO_ENTIDAD\" = '" + str(school) + "' \
        ) \
        ORDER BY \"NIE\", \"ANIO\" ")
    results = []
    student_ids = []
    for item in cursor.fetchall():
        if item[0] not in student_ids:
            student_ids.append(item[0])
        item = [student_ids.index(item[0]), item[1], item[2], item[3]]
        results.append(item)
    return json.dumps(results)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
