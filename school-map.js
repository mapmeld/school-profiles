var map,
    selectSchoolCode,
    currentPointer,
    school_points = {},
    knownPerfs = {},
    moveLines = [],
    year = 2017;

function initMap() {
  map = new google.maps.Map(document.getElementById('map'), {
    zoom: 8,
    center: {lat: 13.7003, lng: -89.175},
    streetViewControl: false,
    fullscreenControl: false
    //mapTypeId: 'satellite'
  });

  fetch("school_points.csv")
    .then(res => res.text())
    .then((csv) => {
      let lines = csv.split("\n");

      // remove an extra blank line
      if (lines[lines.length - 1].length < 4) {
        lines.pop();
      }

      let markerBlock = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQoU2NU6FJIYyACMI4qxBdK1A8eAGEXC+vPUODVAAAAAElFTkSuQmCC';
      let schools = lines.map(school => {
        school = school.split(',');
        let lat = school[1] * 1 || 0,
            lng = school[0] * 1 || 0,
            id = school[2],
            name = school[3],
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
            document.getElementById('school_rates').innerHTML = '';
            moveLines.forEach((line) => {
              line.setMap(null);
            });
            moveLines = [];
            selectSchoolCode = id;
            document.getElementById('autoComplete').style.display = 'none';
            document.getElementById('extra').style.display = 'block';
            document.getElementById('back').style.display = 'block';
            document.getElementById('school_name').innerText = name.toLowerCase();
            document.getElementById('school_rates').innerHTML = '';

            if (currentPointer) {
              currentPointer.setMap(null);
            }
            currentPointer = new google.maps.Marker({
              position: school_points[id],
              map: map,
              clickable: false
            });

            fetch('data/' + year + '/' + selectSchoolCode + '.json').then(res => res.json()).then((perf) => {
              knownPerfs = { year: perf };
              loadPerf(perf);
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
            document.getElementById('autoComplete').style.display = 'none';
            document.getElementById('extra').style.display = 'block';
            document.getElementById('back').style.display = 'block';
            document.getElementById('school_name').innerText = selectSchool[0].toLowerCase();
            document.getElementById('school_rates').innerHTML = '';
            selectSchoolCode = selectSchool[1];
            fetch('data/' + year + '/' + selectSchoolCode + '.json').then(res => res.json()).then((perf) => {
              knownPerfs[year] = perf;
              loadPerf(perf);
            });
          } else {
            alert('This school was not geocoded!');
          }
        }
      });
    });
}

function loadPerf (perf) {
  let headers = document.createElement('tr'),
      grade = document.createElement('th'),
      students = document.createElement('th'),
      moved = document.createElement('th'),
      repeated = document.createElement('th'),
      completed = document.createElement('th');

  grade.innerText = 'Grade';
  students.innerText = 'Students';
  moved.innerText = 'Moved';
  repeated.innerText = 'Repeated';
  completed.innerText = 'Completed';

  headers.appendChild(grade);
  headers.appendChild(students);
  headers.appendChild(moved);
  headers.appendChild(repeated);
  headers.appendChild(completed);
  document.getElementById('school_rates').appendChild(headers);

  Object.keys(perf).forEach((grade) => {
    let gradeRow = document.createElement('tr'),
      gradenum = document.createElement('td'),
      studentsnum = document.createElement('td'),
      movednum = document.createElement('td'),
      repeatednum = document.createElement('td'),
      completednum = document.createElement('td');

    gradenum.innerText = grade;
    studentsnum.innerText = (perf[grade].total * 1).toLocaleString();
    movednum.innerText = Math.round((perf[grade].moved || 0) / perf[grade].total * 100) + '%';
    repeatednum.innerText = Math.round((perf[grade].repeated || 0) / perf[grade].total * 100) + '%';
    completednum.style.fontWeight = 'bold';
    completednum.innerText = Math.round((perf[grade].completed || 0) / perf[grade].total * 100) + '%';

    gradeRow.appendChild(gradenum);
    gradeRow.appendChild(studentsnum);
    gradeRow.appendChild(movednum);
    gradeRow.appendChild(repeatednum);
    gradeRow.appendChild(completednum);

    document.getElementById('school_rates').appendChild(gradeRow);

    fetch('data/' + year + '/move_' + selectSchoolCode + '.json').then(res => res.json()).then((moves) => {
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
    });
  });
}

function back() {
  knownPerfs = {};
  document.getElementById('back').style.display = 'none';
  document.getElementById('extra').style.display = 'none';
  document.getElementById('autoComplete').style.display = 'block';
  currentPointer.setMap(null);
  moveLines.forEach((line) => {
    line.setMap(null);
  });
  moveLines = [];
}

function updateYear (e) {
  year = e.target.value * 1;
  document.getElementById('year').innerText = year;

  // clear table and move lines here
  document.getElementById('school_rates').innerHTML = '';
  moveLines.forEach((line) => {
    line.setMap(null);
  });
  moveLines = [];

  if (knownPerfs[year]) {
    loadPerf(knownPerfs[year]);
  } else {
    fetch('data/' + year + '/' + selectSchoolCode + '.json').then(res => res.json()).then((perf) => {
      knownPerfs[year] = perf;
      loadPerf(perf);
    });
  }
}
