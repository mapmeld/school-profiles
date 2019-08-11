var map,
    selectSchoolCode,
    currentPointer,
    school_points = {},
    knownPerfs = {},
    moveLines = [],
    paesHistory = {},
    year = 2017,
    codeLookup = {};

function initMap() {
  map = new google.maps.Map($('#map').get(0), {
    zoom: 8,
    center: {lat: 13.7003, lng: -89.175},
    streetViewControl: false,
    fullscreenControl: false
    //mapTypeId: 'satellite'
  });

  d3.csv("data/school_points.csv").then((lines) => {
    let markerBlock = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQoU2NU6FJIYyACMI4qxBdK1A8eAGEXC+vPUODVAAAAAElFTkSuQmCC';
    let schools = lines.map(school => {
      let lat = school.lat * 1 || 0,
          lng = school.lng * 1 || 0,
          id = school.codigo,
          name = school.nombre,
          marker = null;
          // also remove accents, spaces, quotes
      if (lat && lng) {
        school_point = new google.maps.LatLng(lat, lng);
        school_points[id] = school_point;
        marker = new google.maps.Marker({
          map: map,
          position: school_point,
          clickable: true,
          icon: {
            url: markerBlock,
            size: new google.maps.Size(7, 7)
          }
        });
        marker.addListener('click', () => {
          d3.select('#school_rates thead, #school_rates tbody').html('');
          moveLines.forEach((line) => {
            line.setMap(null);
          });
          moveLines = [];
          selectSchoolCode = id;
          $('#autoComplete').hide();
          $('#extra, #back').show();
          $('#school_name').text(name.toLowerCase());
          $('#school_rates thead, #school_rates tbody').html('');

          if (currentPointer) {
            currentPointer.setMap(null);
          }
          currentPointer = new google.maps.Marker({
            position: school_points[id],
            map: map,
            clickable: false
          });

          d3.json('data/' + year + '/' + selectSchoolCode + '.json').then((perf) => {
            knownPerfs = { year: perf };
            loadPerf(perf);
          }).catch((err) => {
            console.log(err);
            console.log('No record for this year');
            d3.select('#school_rates tbody').html('').text('No record for this year');
          });
        });
      }
      return [name, id, marker];
    });

    // set up autocomplete
    new autoComplete({
      data: {
        src: schools.map(school => school[0].toLowerCase())
      },
      placeHolder: 'Type a school name',
      searchEngine: 'loose',
      resultsList: {
        render: true
      },
      onSelection: feedback => {
        // console.log(feedback.selection.index);
        let selectSchool = schools[feedback.selection.index];
        let marker = selectSchool[2];
        if (marker) {
          map.setCenter(marker.getPosition());
          map.setZoom(14);

          // replacing old square marker with traditional google maps marker
          currentPointer = new google.maps.Marker({
            position: marker.getPosition(),
            map: map,
            clickable: false
          });

          // show content about school
          $('#autoComplete').hide();
          $('#extra, #back').show();
          $('#school_name').text(selectSchool[0].toLowerCase());
          $('#school_rates thead').html('');
          $('#school_rates tbody').html('');
          selectSchoolCode = selectSchool[1];
          d3.json('data/' + year + '/' + selectSchoolCode + '.json').then((perf) => {
            knownPerfs[year] = perf;
            loadPerf(perf);
          }).catch((err) => {
            console.log(err);
            console.log('No record for this year');
            d3.select('#school_rates tbody').html('').text('No record for this year');
          });
        } else {
          alert('This school was not geocoded!');
        }
      }
    });

    // load school scores
    d3.csv('data/PAES.csv').then((paes) => {
      let subjects = ['CIENCIAS NATURALES', 'CIENCIAS SOCIALES', 'LENGUAJE Y LITERATUA', 'MATEMÁTICA', 'NOTA GLOBAL'];
      paes.forEach((record) => {
        let testyear = record['Año'].replace(',', '') * 1;
        if (typeof paesHistory[record.COD_CE] === 'undefined') {
          paesHistory[record.COD_CE] = {};
        }

        let scores = 0,
            matchSubjects = 0;
        subjects.forEach((subject) => {
          if (record[subject]) {
            scores += record[subject].replace(',', '') * 1;
            matchSubjects++;
          }
          // if (isNaN(scores / matchSubjects)) {
          //   console.log(record);
          // }
        });

        let dept = sanitize(record.DEPARTAMENTO),
            muni = sanitize(record.MUNICIPIO),
            name = sanitize(record['NOMBRE DEL CENTRO EDUCATIVO']);
        if (testyear === 2016) {
          if (!codeLookup[dept]) {
            codeLookup[dept] = {};
          }
          if (!codeLookup[dept][muni]) {
            codeLookup[dept][muni] = {};
          }
          codeLookup[dept][muni][name] = record.COD_CE;
        } else {
          if (!codeLookup[dept][muni]) {
            //console.log(muni);
            //console.log(Object.keys(codeLookup[dept]).sort());
          } else if (!codeLookup[dept][muni][name]) {
            let foundMatch = false;
            Object.keys(codeLookup[dept][muni]).forEach((knownName) => {
              if (!foundMatch && knownName.indexOf(name) > -1) {
                name = knownName;
                foundMatch = true;
              }
            });
            if (!foundMatch && testyear === 2015) {
              //console.log(record['NOMBRE DEL CENTRO EDUCATIVO'] + ' / ' + name + ' in list:');
              //console.log(Object.keys(codeLookup[dept][muni]).sort());
            }
          }
          record.COD_CE = (codeLookup[dept][muni] || {})[name];
        }

        if (!record.COD_CE) {
          //console.log(record);
        } else {
          paesHistory[record.COD_CE][testyear] = (scores / matchSubjects).toFixed(1);
        }
      });
      //console.log(paesHistory);
    });
  });
}

function sanitize (placename) {
  placename = placename.toLowerCase().trim();
  if (placename.substring(0, 3) === 'ce ') {
    placename = placename.substring(3);
  }
  [['á', 'a'],['é', 'e'],['í', 'i'],['ó', 'o'],['ú', 'u'],['ñ', 'n'],
    [',', ''],['(',''],[')',''],['complejo educativo',''],['"',''],['\'',''],
  ['dr.', 'doctor'],['ciudad',''],['concepcion',''],['c.e.','centro escolar'],['caserio','cs'],['canton','ct'],
  ['caserio','crio.'],['cton','ct'],['i.n ','instituto'],
  ['.', ''],['c/', ''],['y','i'],['z','s'],['ce','se'],['ci','si'],
  ['nn','n'],['j','i'],['h',''],['ll','i'],['la ',' '],['v','b'],
  ['gi', 'ii'],['ge', 'ie'],['k','c'],['de ',' '],['del ', ' '],
  ['el ',' '],['los ', ' '],['las ', ' '],['san ',' '],[' ', ''],
  ['ususlutan', 'usulutan'], ['iose', ''], ['seedu', ''], ['institutonasional', ''],
  ['sentroescolar',''], ['compedu', ''], ['profesor', 'prof'], ['came', '']
    ].forEach(
    (accent) => {
      while (placename.indexOf(accent[0]) > -1) {
        placename = placename.replace(accent[0], accent[1]);
      }
    });
  placename = placename.trim();
  return placename;
}

function loadPerf (perf) {
  let headers = $('<tr>'),
      grade = $('<th>').text('Grade'),
      students = $('<th>').text('Students'),
      moved = $('<th>').text('Moved'),
      repeated = $('<th>').text('Repeated'),
      completed = $('<th>').text('Completed');

  $('#school_rates thead').html('');
  $('#school_rates tbody').html('');

  headers.append(grade);
  headers.append(students);
  headers.append(moved);
  headers.append(repeated);
  headers.append(completed);
  $('#school_rates thead').append(headers);

  Object.keys(perf).forEach((grade) => {
    let gradeRow = $('<tr>'),
      gradenum = $('<td>').text(grade),
      studentsnum = $('<td>').text((perf[grade].total * 1).toLocaleString()),
      movednum = $('<td>').text(Math.round((perf[grade].moved || 0) / perf[grade].total * 100) + '%'),
      repeatednum = $('<td>').text(Math.round((perf[grade].repeated || 0) / perf[grade].total * 100) + '%'),
      completednum = $('<td>').text(Math.round((perf[grade].completed || 0) / perf[grade].total * 100) + '%')
        .css({ fontWeight: 'bold' });

    gradeRow.append(gradenum);
    gradeRow.append(studentsnum);
    gradeRow.append(movednum);
    gradeRow.append(repeatednum);
    gradeRow.append(completednum);

    $('#school_rates tbody').append(gradeRow);

    d3.json('data/' + year + '/move_' + selectSchoolCode + '.json').then((moves) => {
      let maxCount = 0;
      Object.keys(moves).forEach((moveSchool) => {
        maxCount = Math.max(maxCount, moves[moveSchool]);
      });

      Object.keys(moves).forEach((moveSchool) => {
        let count = moves[moveSchool];
        if (!school_points[moveSchool]) {
          return;
        }

        moveLines.push(
          new google.maps.Polyline({
            map: map,
            clickable: false,
            geodesic: true,
            path: [
              school_points[selectSchoolCode],
              school_points[moveSchool]
            ],
            strokeColor: 'darkblue',
            strokeOpacity: (count == 1) ? 0.5 : 0.8,
            strokeWeight: (maxCount > 4) ? (5 * (count / maxCount)) : maxCount
          })
        );
      });
    }).catch((err) => {
      console.log(err);
      console.log('No move lines')
    });
  });

  d3.select('#paes').text((paesHistory[selectSchoolCode] || {})[year] || 'no record')
}

function back() {
  knownPerfs = {};
  $('#back, #extra').hide();
  $('#autoComplete').show();
  currentPointer.setMap(null);
  moveLines.forEach((line) => {
    line.setMap(null);
  });
  moveLines = [];
}

function updateYear (e) {
  year = e.target.value * 1;
  d3.select('#year').text(year);

  // clear table and move lines here
  d3.select('#school_rates thead, #school_rates tbody').html('');
  moveLines.forEach((line) => {
    line.setMap(null);
  });
  moveLines = [];

  if (knownPerfs[year]) {
    loadPerf(knownPerfs[year]);
  } else {
    d3.json('data/' + year + '/' + selectSchoolCode + '.json').then((perf) => {
      knownPerfs[year] = perf;
      loadPerf(perf);
    }).catch((err) => {
      console.log(err);
      console.log('No record for this year')
      d3.select('#school_rates tbody').html('').text('No record for this year');
    });
  }
}
