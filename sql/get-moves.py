import csv, json
from sys import argv

years = range(2010, 2018)

# creating static JSON files for each school's moves by year
# the original CSVs separate out moves by grade, which I'm not doing here

for year in years:
    print(year)
    cfile = open('../../sql-scripts/school_moves/school_moves_' + str(year) + '.csv', 'r')
    reader = csv.reader(cfile)
    index = 0
    prevSchool = None
    knownSchool = {}
    for row in reader:
        index = index + 1
        if index == 1:
            continue

        # row is ['base_year', 'origin_school', 'next_school', 'base_grade', 'students_in_move']
        school = row[1]
        destination = row[2]
        students_in_move = row[4]
        if school != prevSchool:
            # encountered a new school
            if prevSchool is not None:
                # record the old school
                jout = open('../data/' + str(year) + '/move_' + school + '.json', 'w')
                jout.write(json.dumps(knownSchool))
                jout.close()
            knownSchool = {}
            knownSchool[destination] = int(students_in_move)
            prevSchool = school
        elif destination in knownSchool:
            knownSchool[destination] += int(students_in_move)
        else:
            knownSchool[destination] = int(students_in_move)

    if prevSchool is not None:
        # record the old school
        jout = open('../data/' + str(year) + '/move_' + school + '.json', 'w')
        jout.write(json.dumps(knownSchool, separators=(',', ':')))
        jout.close()
