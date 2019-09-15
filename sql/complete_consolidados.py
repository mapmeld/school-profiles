import csv

with open('consolidados_rightcols.csv') as csvfile:
    rdr = csv.reader(csvfile, delimiter=',')
    op = csv.writer(open('consolidados_limited.csv', 'w'))
    for row in rdr:
        # header only
            #print(row.index('H01_27'))
            #print(row.index('J011'))
            #print(row.index('D02c_1'))
        row = row[:2] + row[255 : 359] + row[489:]
        op.writerow(row)
