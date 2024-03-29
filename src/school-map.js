var map,
    selectSchoolCode,
    currentPointer,
    school_points = {},
    knownPerfs = {},
    knownOutcomes = {},
    knownPrograms = {},
    moveLines = [],
    year = 2017,
    codeLookup = {},
    paesHistory = {},
    markerList = [],
    labelMarkers = [],
    currentTab = 'browse',
    munigj,
    deptgj;

// add a number label on each municipio
// removed when you zoom in too far
// changed when you set the grade level
let maxgrade = 0, mingrade = 1;
function populateLabelMarkers() {
  // clear any old labels
  labelMarkers.forEach((marker) => {
    marker.setMap(null);
  });

  let labelFeature = (feature) => {
    let bounds = feature.properties.bounds,
        minx = bounds[0],
        maxx = bounds[1],
        miny = bounds[2],
        maxy = bounds[3],
        labeler = '0',
        selectGrade = $('#muni_grade').val(),
        rate = feature.properties.rates[selectGrade];

    // calculate % of students who continued to the next grade next year
    if (rate && rate[0]) {
      labeler = rate[1] / rate[0];
    } else if (selectGrade == 'all') {
      let gradeCount = 0,
          studentRate = 0;
      Object.keys(feature.properties.rates).forEach((grade) => {
        if (feature.properties.rates[grade] && feature.properties.rates[grade][0]) {
          gradeCount++;
          studentRate += feature.properties.rates[grade][1] / feature.properties.rates[grade][0];
        }
      });
      if (gradeCount) {
        labeler = studentRate / gradeCount;
      } else {
        return;
      }
    } else {
      return;
    }

    // use a <canvas> element to draw the number to an image
    let crv = document.createElement('canvas');
        crv.width = 40;
        crv.height = 40;
    let ctx = crv.getContext('2d');
        ctx.font = '15px sans-serif';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        ctx.fillStyle = '#fff';
        ctx.strokeText(Math.round(labeler * 100), 2, 20);
        ctx.fillText(Math.round(labeler * 100), 2, 20);

    // add the number image at the center (middle X and Y) of the municipio
    labelMarkers.push(new google.maps.Marker({
      map: map,
      position: new google.maps.LatLng((miny + maxy) / 2, (minx + maxx) / 2),
      icon: {
        url: crv.toDataURL(),
        size: new google.maps.Size(25, 25),
        anchor: new google.maps.Point(12, 12)
      },
      clickable: false
    }));
  };

  if (map.getZoom() > 10) {
    munigj.features.forEach(labelFeature);
  } else {
    deptgj.features.forEach(labelFeature);
  }
}

function toggleMovesMapped() {
  // show/hide movement lines on the map
  moveLines.forEach((line) => {
    line.setMap($("#movesMapped").prop("checked") ? map : null);
  });
}

function getColor(selectGrade) {
  let level = Math.round((selectGrade - 0.66) * 240 / 0.33) + 50;
  selectGrade = Math.max(0.45, selectGrade);

  // actual color for muni set here
  if (selectGrade >= 0.8) {
    fillColor = 'rgb(50, ' + level + ', 30)';
  } else {
    fillColor = 'rgb(' + (level + 10) + ',' + level + ', 10)';
  }
  return fillColor;
}
// fill color square key on map page
[0.49, 0.59, 0.69, 0.79, 0.89, 0.99].forEach(function (percent, index) {
  $("#colorscale .sq" + (index+1)).css({
    backgroundColor: getColor(percent)
  });
});

function initMap() {
  map = new google.maps.Map($('#map').get(0), {
    zoom: 9,
    center: {lat: 13.7003, lng: -88.928},
    streetViewControl: false,
    fullscreenControl: false,

    // make a custom background map on https://mapstyle.withgoogle.com
    styles: [
      {
        "featureType": "administrative.land_parcel",
        "stylers": [{
            "visibility": "off"
          }]},
      {
        "featureType": "administrative.neighborhood",
        "stylers": [{
            "visibility": "off"
          }]},
      {
        "featureType": "landscape.natural",
        "elementType": "geometry.fill",
        "stylers": [{
            "color": "#f8f6f6"
          },{
            "visibility": "on"
          }]},
      {
        "featureType": "landscape.natural",
        "elementType": "labels.icon",
        "stylers": [{
            "visibility": "off"
          }]},
      {
        "featureType": "poi",
        "elementType": "labels.text",
        "stylers": [{
            "visibility": "off"
          }]},
      {
        "featureType": "poi.business",
        "stylers": [{
            "visibility": "off"
          }]},
      {
        "featureType": "road",
        "elementType": "labels",
        "stylers": [{
            "visibility": "off"
          }]},
      {
        "featureType": "road",
        "elementType": "labels.icon",
        "stylers": [{
            "visibility": "off"
          }]},
      {
        "featureType": "road.highway",
        "elementType": "geometry.stroke",
        "stylers": [{
            "visibility": "simplified"
          }]},
      {
        "featureType": "transit",
        "stylers": [{
            "visibility": "on"
          }]},
      {
        "featureType": "water",
        "elementType": "labels.text",
        "stylers": [{
            "visibility": "off"
          }]}
    ]
  });

  // there is one shared function for coloring departamentos and municipios
  // departamentos are transparent with a thicker border
  // municipios are color-coded based on graduation rates for selectGrade
  // municipios color-coding goes transparent when we zoom in
  // the muni numbers are calculated in sql/agg-school-scores.py
  let styleFunc = (layer) => {
    let selectGrade = $('#muni_grade').val();

    let rates = layer.getProperty('rates') || {};

    // do we have recorded rates for this muni?
    if (Object.keys(rates).length === 0) {
      console.log('no rates for ' + layer.getProperty('NAME_2'));
      selectGrade = -1;
    } else if (selectGrade === 'all') {
      // sum up all grades
      let sum = 0, totalGrades = 0;
      Object.keys(rates).forEach((grade) => {
        if (rates[grade][0] > 0) {
          sum += rates[grade][1] / rates[grade][0];
          totalGrades++;
        }
      });
      selectGrade = sum / totalGrades;
    } else {
      // look up graduation for this municipio, if available
      if (rates[selectGrade][0]) {
        selectGrade = rates[selectGrade][1] / rates[selectGrade][0];
      } else {
        // console.log('no students graduated select grade ' + layer.getProperty('NAME_2'));
        selectGrade = -1;
      }
    }

    let fillColor = '#fff';
    // console.log(selectGrade);
    if (selectGrade > 0) {
      maxgrade = Math.max(maxgrade, selectGrade);
      mingrade = Math.min(mingrade, selectGrade);
      fillColor = getColor(selectGrade);
    }
    return {
      clickable: false, // (map.getZoom() < 12 && layer.getProperty('TYPE_1') !== 'Departamento'),
      fillOpacity: (
        (
          (layer.getProperty('TYPE_1') === 'Departamento' && map.getZoom() > 10)
          || (layer.getProperty('TYPE_1') !== 'Departamento' && map.getZoom() <= 10)
          || (map.getZoom() > 12)
        )
          ? 0 // depto OR muni at wrong zoom
          : 0.3 // depto or muni at right zoom
      ),
      strokeWeight: (
        (layer.getProperty('TYPE_1') === 'Departamento')
          ? 5 // depto
          : 0.5 // muni
      ),
      fillColor: fillColor,
      strokeOpacity: 0.5
    };
  };
  map.data.setStyle(styleFunc);

  $('#muni_grade').on('change', () => {
    // update muni coloring whenever we change this dropdown
    map.data.setStyle(styleFunc);
    populateLabelMarkers();
  });

  let addBounds = (feature) => {
    // find bounds for each dept and muni
    let minx = 180,
        maxx = -180,
        miny = 90,
        maxy = -90;
    feature.geometry.coordinates.forEach((shape) => {
      shape.forEach((ring) => {
        ring.forEach((point) => {
          minx = Math.min(minx, point[0]);
          maxx = Math.max(maxx, point[0]);
          miny = Math.min(miny, point[1]);
          maxy = Math.max(maxy, point[1]);
        });
      });
    });
    feature.properties.bounds = [minx, maxx, miny, maxy];
  };

  d3.json('data/dept.topojson').then((dept) => {
    deptgj = topojson.feature(dept, dept.objects.departamentos);
    deptgj.features.forEach(addBounds);
    map.data.addGeoJson(deptgj);

    d3.json('data/muni3.topojson').then((muni) => {
      munigj = topojson.feature(muni, muni.objects.export);
      munigj.features.forEach(addBounds);
      map.data.addGeoJson(munigj);

      // draw numbers on top of dept and muni
      populateLabelMarkers();
    });
  });

  // this makes it so clicking a muni -> zoom to that muni
  // map.data.addListener('click', (e) => {
  //   let b = e.feature.getProperty('bounds');
  //   map.fitBounds(new google.maps.LatLngBounds(
  //     new google.maps.LatLng(b[2], b[0]),
  //     new google.maps.LatLng(b[3], b[1])
  //   ));
  // });

  // update muni transparency and visible markers, when you zoom < or > zoom level 12
  let lastZoom = 0;
  map.addListener('zoom_changed', (e) => {
    if (map.getZoom() > 12 && (lastZoom <= 12 || lastZoom <= 10)) {
      markerList.forEach((marker) => {
        marker.setMap(map);
      });
      map.data.setStyle(styleFunc);
      $('#muni_view').hide();
      labelMarkers.forEach((marker) => {
        marker.setMap(null);
      });
    } else if (map.getZoom() <= 12 && (lastZoom > 12 || lastZoom <= 10)) {
      map.data.setStyle(styleFunc);
      markerList.forEach((marker) => {
        marker.setMap(null);
      });
      $('#muni_view').show();
      populateLabelMarkers();
    } else if (map.getZoom() <= 10 && lastZoom > 10) {
      map.data.setStyle(styleFunc);
      markerList.forEach((marker) => {
        marker.setMap(null);
      });
      $('#muni_view').show();
      populateLabelMarkers();
    }
    lastZoom = map.getZoom();
  });

  // load all of the school names and positions
  d3.csv("data/school_points.csv").then((lines) => {
    // dark green square, could be replaced with a URL to any image
    // or color-coding by school
    let markerBlock = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQoU2NU6FJIYyACMI4qxBdK1A8eAGEXC+vPUODVAAAAAElFTkSuQmCC';

    let schools = lines.map(school => {
      let lat = school.lat * 1 || 0,
          lng = school.lng * 1 || 0,
          id = school.codigo,
          name = school.nombre,
          marker = null,

      // remove accents and extra words, so it's easier to match schools to PAES scores
          dept_san = sanitize(school.dept),
          muni_san = sanitize(school.muni),
          name_san = sanitize(school.nombre);
      if (!codeLookup[dept_san]) {
        codeLookup[dept_san] = {};
      }
      if (!codeLookup[dept_san][muni_san]) {
        codeLookup[dept_san][muni_san] = {};
      }
      if (!codeLookup[dept_san][muni_san][name_san]) {
        codeLookup[dept_san][muni_san][name_san] = id;
      }

      // most have geolocation, but you can skip this if you don't have a location
      if (lat && lng) {
        school_point = new google.maps.LatLng(lat, lng);
        school_points[id] = school_point;
        marker = new google.maps.Marker({
          map: null,
          position: school_point,
          clickable: true,
          icon: {
            url: markerBlock,
            size: new google.maps.Size(7, 7)
          }
        });

        // use the marker list for the clustering
        markerList.push(marker);

        marker.addListener('click', () => {
          // clear current table and school-to-school move lines
          $('#school_rates thead').html('');
          $('#school_rates tbody').html('');
          moveLines.forEach((line) => {
            line.setMap(null);
          });
          moveLines = [];
          selectSchoolCode = id;
          $('#initial').hide();
          $('#extra, #back').show();

          // the school named is stored IN CAPS
          // we make it lower case and then use CSS to capitalize ("In Caps")
          $('#school_name').text(name.toLowerCase());

          // when you select a school, it turns into a red maps pin
          // the previous maps pin should be turned back into a regular marker
          if (currentPointer) {
            currentPointer.setMap(null);
          }
          currentPointer = new google.maps.Marker({
            position: school_points[id],
            map: map,
            clickable: false
          });

          // load student data for this school and year
          d3.json('data/' + year + '/' + selectSchoolCode + '.json').then((perf) => {
            knownPerfs = {};
            knownOutcomes = {};
            knownPerfs[year] = perf;
            loadPerf(perf);
          }).catch((err) => {
            // couldn't find the data
            loadPerf(null);
            console.log(err);
            console.log('No record for this year');
            $('#school_rates tbody').html('').text('No record for this year');
          });
        });
      }
      return [name, id, marker];
    });

    // combine markers into clusters while you are zoomed out
    // new MarkerClusterer(map, markerList, {
    //   imagePath: 'lib/cluster',
    //   minimumClusterSize: 3,
    //   maxZoom: 14
    // });

    // set up autocomplete to look up schools by name
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
          // focus the map at this school
          map.setCenter(marker.getPosition());
          map.setZoom(14);

          // replacing old square marker with traditional google maps marker
          currentPointer = new google.maps.Marker({
            position: marker.getPosition(),
            map: map,
            clickable: false
          });

          // show content about school
          $('#initial').hide();
          $('#extra, #back').show();
          $('#school_name').text(selectSchool[0].toLowerCase());
          $('#school_rates thead').html('');
          $('#school_rates tbody').html('');
          selectSchoolCode = selectSchool[1];

          // load the student records data for this school and year
          d3.json('data/' + year + '/' + selectSchoolCode + '.json').then((perf) => {
            knownPerfs[year] = perf;
            loadPerf(perf);
          }).catch((err) => {
            console.log(err);
            console.log('No record for this year');
            $('#school_rates tbody').html('').text('No record for this year');
          });
        } else {
          alert('This school was not geocoded!');
        }
      }
    });


    // load school scores and associate them with a school ID
    // we have some school names and IDs from loading geocoded schools
    // we add some school names and IDs from the PAES 2016 data
    // PAES scores before 2016 need help getting associated with school IDs
    d3.csv('data/PAES.csv').then((paes) => {
      let subjects = ['CIENCIAS NATURALES', 'CIENCIAS SOCIALES', 'LENGUAJE Y LITERATUA', 'MATEMÁTICA', 'NOTA GLOBAL'];
      paes.forEach((record) => {
        let testyear = record['Año'].replace(',', '') * 1;
        if (typeof paesHistory[record.COD_CE] === 'undefined') {
          paesHistory[record.COD_CE] = {};
        }

        // average all of the PAES scores for all subjects
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

        // try to find match for this PAES record
        let dept = sanitize(record.DEPARTAMENTO),
            muni = sanitize(record.MUNICIPIO),
            name = sanitize(record['NOMBRE DEL CENTRO EDUCATIVO']);
        if (!codeLookup[dept]) {
          codeLookup[dept] = {};
        }
        if (!codeLookup[dept][muni]) {
          codeLookup[dept][muni] = {};
        }
        if (!codeLookup[dept][muni][name]) {
          if (record.COD_CE) {
            codeLookup[dept][muni][name] = record.COD_CE;
          } else {
            let knownNames = Object.keys(codeLookup[dept][muni]);
            for (let c = 0; c < knownNames.length; c++) {
              if ((knownNames[c].indexOf(name) > -1) || (name.indexOf(knownNames[c]) > -1)) {
                name = knownNames[c];
                break;
              }
            }
          }
        }
        record.COD_CE = codeLookup[dept][muni][name];

        // storing final PAES record
        if (!record.COD_CE) {
          //console.log(record);
        } else {
          //console.log(record);
          if (!paesHistory[record.COD_CE]) {
            paesHistory[record.COD_CE] = {};
          }
          paesHistory[record.COD_CE][testyear] = (scores / matchSubjects).toFixed(1);
        }
      });
    });
  });
}

function sanitize (placename) {
  // make it easier to compare names of departmentos, municipios, and schools
  // removes accents, confused letters, common acronyms, common extra words (ciudad, centro escolar)

  placename = placename.toLowerCase().trim();
  if (placename === 'nueva san salvador') {
    placename = 'santa tecla';
  }
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

function showPercent (pr) {
  // format a percentage or write N/A for unavailable/undefined
  if (typeof pr !== 'undefined') {
    if (isNaN(pr * 1)) {
      return '0%';
    } else {
      return (Math.round(pr) / 10) + '%';
    }
  } else {
    return 'N/A';
  }
}

function showStudentFlow (grade) {
  // experimental: call backend/get_student_flow.py server
  // see a flow chart of students from this school, year, and grade level going forward
  // use D3's Sankey graph
  let hostname = (window.location.hostname === 'localhost') ? 'http://localhost:5000' : 'https://gis.georeactor.com/students';
  d3.json(hostname + '/track?year=' + year + '&school=' + selectSchoolCode + '&grade=' + grade).then((records) => {
    let lastStudentRecord = null,
        lastStudentNode = null,
        maxLinkSize = 1,
        links = [],
        knownNodes = [
          [year, selectSchoolCode, grade].join('_')
        ],
        nodes = [
          { name: [year, selectSchoolCode, grade].join('_') }
        ];

    records.forEach((record) => {
      let addedToOldLink = false;
      let nextStudentNode = [
        record[1],
        (record[2] === selectSchoolCode) ? selectSchoolCode : 'Other',
        record[3].split(' ')[0]
      ].join('_');
      if (record[0] === lastStudentRecord) {
        if (knownNodes.indexOf(nextStudentNode) === -1) {
          nodes.push({ name: nextStudentNode });
          knownNodes.push(nextStudentNode);
        } else {
          links.forEach((link) => {
            if (!addedToOldLink
                && link.source === knownNodes.indexOf(lastStudentNode)
                && link.target === knownNodes.indexOf(nextStudentNode)) {
              addedToOldLink = true;
              link.value++;
              maxLinkSize = Math.max(maxLinkSize, link.value);
            }
          });
        }
        if (!addedToOldLink) {
          links.push({
            source: knownNodes.indexOf(lastStudentNode),
            target: knownNodes.indexOf(nextStudentNode),
            value: 1
          });
        }
        lastStudentNode = nextStudentNode;
      } else {
        lastStudentRecord = record[0];
        lastStudentNode = nextStudentNode;
        if (knownNodes.indexOf(lastStudentNode) === -1) {
          nodes.push({ name: lastStudentNode });
          knownNodes.push(lastStudentNode);
        } else {
          links.forEach((link) => {
            if (!addedToOldLink
                && link.source === 0
                && link.target === knownNodes.indexOf(lastStudentNode)) {
              addedToOldLink = true;
              link.value++;
              maxLinkSize = Math.max(maxLinkSize, link.value);
            }
          });
        }
        if (!addedToOldLink) {
          links.push({
            source: 0,
            target: knownNodes.indexOf(lastStudentNode),
            value: 1
          });
        }
      }
    });
    // console.log(links);

    $('#flow-modal .modal-body').html('');
    let svg = d3.select("#flow-modal .modal-body").append("svg")
      .attr("width", 650)
      .attr("height", 500)
      .append("g");

    let sankey = d3.sankey()
      .nodeWidth(15)
      .nodePadding(10)
      .size([650, 450]);

    sankey({ nodes: nodes, links: links });

    svg.append("g")
    .selectAll("rect")
    .data(nodes)
    .join("rect")
      .attr("fill", "#aaa")
      .attr("x", d => d.x0)
      .attr("y", d => d.y0)
      .attr("height", d => d.y1 - d.y0)
      .attr("width", d => d.x1 - d.x0);

    svg.append("g")
        .attr("fill", "none")
      .selectAll("g")
      .data(links)
      .join("path")
        .attr("d", d3.sankeyLinkHorizontal())
        .attr("stroke", "#00f")
        .attr("stroke-width", d => Math.round(d.value / maxLinkSize * 50))
        .style("mix-blend-mode", "multiply");

  svg.append("g")
      .style("font", "10px sans-serif")
    .selectAll("text")
    .data(nodes)
    .join("text")
      .attr("x", d => d.x0 < 150 ? d.x1 + 6 : d.x0 - 6)
      .attr("y", d => (d.y1 + d.y0) / 2)
      .attr("writing-mode", "tb")
      .attr("text-anchor", "middle")
      .text((d) => {
        let name = d.name.split('_');
        let year = name[0],
            school = name[1],
            grade = name[2] * 1;
        if (school === selectSchoolCode) {
          return year + "\nGrade " + grade;
        } else {
          return year + "\nGrade " + grade + "\nat " + school;
        }
      });

    $('#flow-modal').modal({ show: true });
  });
}

// open a file with known student numbers and outcomes
function loadPerf (perf) {
  $('#predict_6').text(showPercent(original_6[selectSchoolCode]));
  $('#predict_1b').text(showPercent(original_1b[selectSchoolCode]));

  if (perf) {

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

    $('#retain_6').text('N/A');
    $('#retain_1b').text('N/A');

    Object.keys(perf).forEach((grade) => {
      let gradeRow = $('<tr>'),
        gradenum = $('<td>'),
        studentsnum = $('<td>').text((perf[grade].total * 1).toLocaleString()),
        movednum = $('<td>').text(Math.round((perf[grade].moved || 0) / perf[grade].total * 100) + '%'),
        repeatednum = $('<td>').text(Math.round((perf[grade].repeated || 0) / perf[grade].total * 100) + '%'),
        completednum = $('<td>').text(Math.round((perf[grade].completed || 0) / perf[grade].total * 100) + '%')
          .css({ fontWeight: 'bold' });

      let gradeLink = $('<button>').text(grade);
      gradeLink.on('click', (e) => {
        showStudentFlow(grade);
      });
      gradenum.append(gradeLink);
      gradeRow.append(gradenum);
      gradeRow.append(studentsnum);
      gradeRow.append(movednum);
      gradeRow.append(repeatednum);
      gradeRow.append(completednum);

      if (grade === '06') {
        $('#retain_6').text(showPercent(1000 * perf[grade].completed / perf[grade].total));
      } else if (grade === '1B') {
        $('#retain_1b').text(showPercent(1000 * perf[grade].completed / perf[grade].total));
      }

      $('#school_rates tbody').append(gradeRow);

      // load the school-to-school move lines for this school year
      d3.json('data/' + year + '/move_' + selectSchoolCode + '.json').then((moves) => {
        // we want to show different line weights based on how many students moved
        // find the maximum number of students moving to another school, for scale
        let maxCount = 0;
        Object.keys(moves).forEach((moveSchool) => {
          maxCount = Math.max(maxCount, moves[moveSchool]);
        });

        Object.keys(moves).forEach((moveSchool) => {
          if (!school_points[moveSchool]) {
            // this school doesn't have a known geo location
            return;
          }

          let count = moves[moveSchool];
          // create a line showing students moving away from this school
          moveLines.push(
            new google.maps.Polyline({
              map: $("#movesMapped").prop("checked") ? map : null,
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
        // usually means file was not found
        console.log(err);
        console.log('No move lines')
      });
    });
  }

  // did we download retiros yet for this school + year?
  // if not, we load the file and sent it to loadRetiros
  if (knownOutcomes[year]) {
    loadRetiros(knownOutcomes[year]);
    loadPrograms(selectSchoolCode);
  } else {
    d3.json('data/' + year + '/retiro_' + selectSchoolCode + '.json').then((retiro) => {
      knownOutcomes[year] = retiro;
      loadRetiros(retiro);
      loadPrograms(selectSchoolCode);
    }).catch((err) => {
      console.log(err);
      console.log('No record for this year');
      $('#retiro_reasons tbody').html('').text('No record for this year');
      loadPrograms(selectSchoolCode);
    });
  }

  // show PAES score (if match was made)
  $('.paes').text((paesHistory[selectSchoolCode] || {})[year] || 'no record')
}

function updateYear (e) {
  year = e.target.value * 1;
  $('.year').text(year);
  $('#year_select').val(year);
  $('#outcome_year_select').val(year);

  // clear table and school-to-school move lines
  $('#school_rates thead').html('');
  $('#school_rates tbody').html('');
  moveLines.forEach((line) => {
    line.setMap(null);
  });
  moveLines = [];

  // previously stored values for this school for this year ?
  if (knownPerfs[year]) {
    loadPerf(knownPerfs[year]);
  } else {
    // load a new performance file
    d3.json('data/' + year + '/' + selectSchoolCode + '.json').then((perf) => {
      // store the performance file for this school
      knownPerfs[year] = perf;
      loadPerf(perf);
    }).catch((err) => {
      // it is normal for the school not to have a file; this is how we handle it
      loadPerf(null);
      console.log(err);
      console.log('No record for this year')
      $('#school_rates tbody').html('').text('No record for this year');
    });
  }
}

// reasons for dropping out
// displaying a table of values inside the tab
let reasonLookup = {
  'A': 'Student agricultural work',
  'B': 'Student housework',
  'C': 'Student working',
  'D': 'Student address changed',
  'E': 'Moved to another school',
  'F': 'Moved to EDUCAME',
  'G': 'Left the country',
  'H': 'Pregnancy',
  'I': 'Economic difficulties',
  'J': 'Parents withdrew from school',
  'K': 'School is too far',
  'L': 'Poor academic performance',
  'M': 'Delinquency',
  'N': 'Physical disability',
  'O': 'Sickness',
  'P': 'Accident',
  'Q': 'Natural death',
  'R': 'Death by murder',
  'S': 'Death by accident',
  'T': 'Forced displacement',
  'U': 'Gang victim',
  'V': 'Other causes'
};
function loadRetiros (outcomes) {
  let headers = $('<tr>'),
      reason = $('<th>').text('Reason'),
      gender = $('<th>').text('Gender'),
      count = $('<th>').text('Count');
  $('#retiro_reasons thead').html('');
  $('#retiro_reasons tbody').html('');

  headers.append(reason);
  headers.append(gender);
  headers.append(count);
  $('#retiro_reasons thead').append(headers);

  Object.keys(outcomes).forEach((outcome) => {
    // the outcome is a code like A_M (reason code is A, gender is Male)
    // we can then get the count from the object
    let op = outcome.split('_');
    if (op[0].trim().length) {
      let reason = reasonLookup[op[0].trim().toUpperCase()],
          gender = op[1].toUpperCase(),
          count = outcomes[outcome];

      let rRow = $('<tr>'),
        rtd = $('<td>').text(reason),
        gtd = $('<td>').text(gender),
        ctd = $('<td>').text(count);

      rRow.append(rtd);
      rRow.append(gtd);
      rRow.append(ctd);

      $('#retiro_reasons tbody').append(rRow);
    }
  });
}

function loadPrograms(schoolCode) {
  $('#programs').text('loading...');
  $('#computers').text('loading...');

  let process = (data) => {
    // named programs
    let usedPrograms = $('<ul>');
    let formatRange = (years) => {
      if (years.length === 1) {
        return years[0];
      } else {
        return years.join('-');
      }
    };
    if (data.leche) { usedPrograms.append($('<li>Leche (' + formatRange(data.leche) + ')</li>')) }
    if (data.paquete) { usedPrograms.append($('<li>Paquetes Escolares (' + formatRange(data.paquete) + ')</li>')) }
    if (data.parents) { usedPrograms.append($('<li>Padres y madres (' + formatRange(data.parents) + ')</li>')) }
    $('#programs').html(usedPrograms.length ?
        usedPrograms
        : 'None from set')

    // laptops (when not just y/n)
    $('#computers').text('No record');
    let laptops = [],
        yearEnrollment = [[], [], [], []],
        years = [];
    Object.keys(data).forEach((year) => {
      // verify key is a year
      if (!isNaN(1 * year)) {
        years.push(year * 1);
        yearEnrollment[0].push((data[year]["1"] || {}).total * 1);
        yearEnrollment[1].push((data[year]["2"] || {}).total * 1);
        yearEnrollment[2].push((data[year]["3"] || {}).total * 1);
        yearEnrollment[3].push((data[year]["4"] || {}).total * 1);

        if (data[year]["laptops"]) {
          laptops.push(year + ': ' + data[year]["laptops"].toLocaleString());
        }
      }
    });

    if (years.length) {
      c3.generate({
        bindTo: '#chart',
        data: {
          x: 'Year',
          columns: [
            ['Year'].concat(years),
            ['Grade 1'].concat(yearEnrollment[0]),
            ['Grade 2'].concat(yearEnrollment[1]),
            ['Grade 3'].concat(yearEnrollment[2]),
            ['Grade 4'].concat(yearEnrollment[3])
          ]
        },
        axis: { y: { tick: { format: d3.format("d") } } }
      });
    } else {
      $('#chart').html('No enrollment');
    }

    if (laptops.length) {
      $('#computers').text(laptops.join(', '));
    }
  };
  if (!knownPrograms[schoolCode]) {
    d3.json('data/programs/' + schoolCode + '.json').then((d) => {
      knownPrograms[schoolCode] = d;
      process(d);
    })
    .catch((err) => {
      $('#computers').text('No record');
      $('#programs').text('No record');
      $('#chart').html('No record');
      console.error(err);
      console.log('Programs not found');
    });
  } else {
    process(knownPrograms[schoolCode]);
  }
}

// UI: return to the starting search panel
function back() {
  knownPerfs = {};
  knownOutcomes = {};
  $('#back, #extra').hide();
  $('#initial').show();
  currentPointer.setMap(null);
  moveLines.forEach((line) => {
    line.setMap(null);
  });
  moveLines = [];
}

// UI: switching between tabs
function setTab(tab) {
  if (tab !== currentTab) {
    $('.tabpanel').hide();
    $('a.nav-link').removeClass('active');
    $('.' + tab + '-tab').addClass('active');
    $('#' + tab + '-tab').show();
    currentTab = tab;
    //loadRetiros(null);
  }
}

// these are the *predicted* completion rates for grades 6 and 1B for each school
// a number is 10x (810 = 81.0%)
// you can obtain them from record_predictions.py in the prediction model repo

let original_6 = {"11890": 810, "60185": 717, "12131": 703, "10763": 379, "10138": 755, "86255": 614, "10136": 538, "80069": 542, "10971": 803, "68084": 444, "60322": 377, "11135": 679, "78015": 697, "20747": 773, "64001": 776, "74077": 762, "88118": 748, "20037": 806, "80119": 379, "13139": 467, "78012": 236, "11106": 683, "10998": 753, "10095": 791, "10741": 759, "20904": 832, "13105": 786, "86415": 621, "12671": 790, "13502": 773, "84059": 367, "21482": 763, "86159": 652, "13431": 765, "13304": 835, "10151": 691, "12319": 871, "60171": 688, "21517": 619, "86275": 366, "13434": 734, "13448": 859, "62005": 746, "86501": 311, "86117": 380, "13200": 805, "68148": 539, "60100": 594, "13779": 378, "11785": 863, "88045": 812, "21519": 633, "12446": 759, "76005": 493, "13495": 540, "13707": 730, "20752": 828, "86398": 564, "20512": 818, "12660": 824, "74049": 497, "70004": 665, "76033": 308, "11780": 780, "68154": 700, "68120": 612, "86058": 352, "20466": 462, "12782": 793, "10537": 821, "20882": 582, "82045": 316, "72070": 558, "12503": 786, "66139": 466, "88108": 794, "10615": 670, "11349": 785, "14784": 584, "84089": 747, "86433": 764, "10781": 474, "80139": 550, "74035": 558, "60055": 766, "68178": 710, "11787": 654, "10844": 765, "11111": 625, "10266": 287, "10576": 666, "12218": 724, "13537": 497, "86112": 521, "13249": 806, "62043": 120, "82074": 302, "12835": 841, "12692": 838, "13335": 438, "60094": 484, "86410": 641, "11920": 578, "10367": 431, "60075": 763, "62070": 717, "14870": 669, "11768": 808, "10368": 766, "11646": 703, "82030": 770, "21098": 809, "70054": 743, "64066": 419, "20975": 763, "13087": 900, "12427": 886, "64020": 739, "21431": 810, "13501": 804, "13182": 781, "10255": 764, "21055": 874, "86070": 493, "10683": 757, "11643": 713, "66147": 399, "12117": 843, "13349": 744, "60103": 374, "12344": 599, "74079": 722, "60223": 289, "82134": 432, "74008": 787, "82121": 362, "12752": 443, "11503": 861, "60244": 610, "10074": 810, "86453": 566, "10733": 683, "11437": 794, "62032": 683, "12678": 789, "21410": 915, "12627": 777, "60079": 751, "80075": 710, "68206": 498, "86503": 594, "10442": 542, "11941": 792, "80009": 557, "12820": 561, "10630": 496, "80038": 382, "11666": 571, "12244": 547, "86437": 496, "10129": 571, "68168": 373, "86546": 370, "82146": 822, "84042": 505, "84065": 778, "80140": 392, "86015": 792, "80004": 623, "10147": 769, "88132": 831, "13246": 817, "80108": 579, "11414": 692, "80080": 748, "86492": 506, "78064": 614, "11903": 770, "10749": 828, "10391": 761, "90051": 850, "84036": 460, "13132": 770, "13569": 747, "76056": 308, "86302": 760, "74030": 683, "10970": 733, "11631": 765, "70080": 722, "13175": 802, "10384": 667, "12536": 771, "20559": 816, "13567": 834, "86011": 473, "78057": 530, "11249": 540, "11585": 827, "12255": 556, "13420": 595, "10070": 486, "64123": 822, "64013": 623, "13551": 797, "10314": 622, "20873": 764, "13309": 767, "11032": 718, "12015": 762, "76013": 693, "10935": 714, "78082": 729, "21132": 862, "20446": 846, "82126": 813, "88038": 869, "86258": 704, "11926": 735, "86361": 488, "64053": 554, "10620": 733, "11758": 617, "11109": 856, "11977": 630, "86342": 769, "78037": 709, "74020": 336, "10769": 338, "84111": 495, "80035": 419, "82107": 446, "84087": 478, "11190": 393, "12626": 471, "86308": 518, "64096": 376, "20082": 767, "74061": 632, "11875": 846, "86372": 556, "11971": 818, "20164": 796, "12065": 761, "74070": 776, "62094": 396, "11426": 686, "86309": 492, "12201": 752, "14858": 701, "10143": 788, "10015": 768, "88043": 874, "62097": 719, "10218": 645, "20973": 830, "86060": 479, "11382": 821, "12407": 733, "11244": 735, "68089": 751, "68030": 807, "21074": 873, "10795": 803, "20861": 790, "64089": 367, "78033": 734, "12170": 790, "12572": 576, "13469": 771, "60333": 775, "80060": 347, "20838": 925, "86348": 642, "86050": 393, "10267": 644, "78021": 814, "70087": 775, "78008": 725, "72045": 851, "11512": 829, "11816": 838, "20173": 710, "12568": 584, "60074": 488, "12787": 459, "64087": 519, "13192": 751, "86038": 411, "80064": 508, "21386": 790, "60064": 706, "11277": 416, "72003": 843, "12047": 524, "86241": 721, "10281": 727, "84126": 834, "12629": 553, "80053": 434, "86395": 707, "14868": 547, "14787": 422, "80104": 551, "80151": 807, "13399": 442, "66044": 372, "76053": 368, "64027": 786, "60080": 788, "20889": 892, "86499": 797, "60154": 463, "13342": 413, "60155": 745, "10893": 664, "11263": 717, "12573": 591, "12368": 367, "10225": 718, "11312": 780, "11674": 779, "20937": 842, "20701": 807, "60209": 498, "10877": 740, "80002": 587, "13136": 450, "86462": 629, "20318": 858, "60060": 502, "11922": 711, "11651": 771, "11702": 780, "68072": 746, "72035": 752, "12831": 812, "68038": 733, "13074": 812, "86449": 424, "72081": 726, "86090": 742, "86394": 832, "13440": 792, "62031": 606, "86455": 361, "82147": 723, "88034": 794, "10173": 753, "70097": 532, "10694": 620, "10359": 738, "11715": 798, "78087": 476, "10884": 686, "12651": 807, "20923": 935, "72071": 731, "20335": 770, "10977": 607, "20636": 807, "11720": 813, "76018": 457, "84016": 512, "12055": 731, "86148": 756, "11182": 694, "86040": 372, "60276": 514, "20066": 814, "11654": 800, "11441": 682, "10693": 751, "60268": 610, "86487": 522, "11880": 863, "13160": 783, "13583": 430, "12996": 853, "70048": 593, "10556": 724, "10818": 845, "86460": 495, "10415": 713, "12232": 668, "88116": 802, "13413": 402, "88039": 844, "64109": 752, "78016": 408, "78089": 866, "12212": 424, "86042": 749, "11907": 833, "21268": 875, "10452": 676, "66015": 550, "82011": 437, "74032": 555, "12922": 819, "12093": 531, "11031": 775, "21450": 825, "10076": 745, "11633": 806, "11531": 803, "21178": 627, "86151": 537, "12229": 357, "11082": 761, "11932": 784, "60222": 700, "60271": 486, "11719": 723, "11015": 571, "82026": 380, "11575": 761, "13005": 762, "80030": 588, "11968": 609, "64071": 457, "68156": 691, "86247": 716, "10177": 782, "76016": 682, "62004": 603, "88036": 894, "11878": 859, "80052": 694, "80057": 551, "10353": 720, "21364": 704, "10194": 560, "13385": 689, "20890": 909, "78043": 540, "84090": 411, "10681": 779, "11713": 726, "13572": 864, "10492": 798, "60015": 688, "74006": 784, "13083": 812, "13509": 749, "10338": 835, "86261": 548, "11741": 793, "20464": 898, "12210": 712, "80039": 667, "80135": 411, "12478": 835, "10750": 841, "84091": 791, "60248": 735, "86226": 581, "12617": 716, "10974": 801, "66089": 496, "84108": 408, "12518": 797, "12421": 770, "70062": 832, "20469": 707, "88178": 650, "12461": 651, "21439": 799, "11034": 745, "10099": 796, "13205": 726, "11735": 761, "12066": 778, "12815": 482, "11679": 547, "13563": 609, "86023": 405, "11163": 736, "76023": 723, "12267": 771, "64038": 788, "12278": 715, "12448": 614, "13400": 706, "66131": 757, "12269": 664, "80112": 733, "72060": 681, "86142": 500, "13263": 802, "86043": 467, "70020": 836, "13210": 776, "66019": 371, "68164": 489, "84125": 541, "80178": 754, "10396": 729, "12954": 369, "80131": 705, "10007": 780, "86107": 467, "10865": 780, "82157": 678, "68041": 700, "10374": 746, "10837": 768, "86289": 667, "12364": 413, "12907": 801, "12109": 779, "13788": 406, "60203": 527, "20281": 849, "20658": 653, "78081": 662, "60129": 390, "13007": 787, "14853": 399, "13180": 758, "14820": 798, "66007": 387, "12467": 644, "11765": 714, "88130": 665, "12955": 739, "66097": 556, "76040": 235, "12199": 775, "10732": 846, "88095": 635, "84002": 505, "82027": 812, "12995": 840, "88064": 819, "60143": 383, "68142": 755, "66046": 345, "13361": 527, "11288": 760, "62071": 303, "11247": 585, "86333": 598, "13353": 341, "62052": 451, "78040": 351, "64022": 386, "86311": 382, "86220": 805, "11432": 717, "20920": 907, "68032": 530, "12324": 886, "13454": 697, "12732": 604, "21540": 670, "10697": 513, "11324": 850, "86312": 726, "86447": 629, "12019": 730, "80092": 355, "13075": 858, "12179": 637, "84094": 797, "78034": 750, "12211": 740, "11173": 797, "11982": 825, "10746": 781, "13556": 832, "78092": 619, "11642": 797, "86113": 437, "12813": 790, "11396": 676, "66055": 750, "10127": 577, "60087": 758, "60003": 752, "13060": 832, "20171": 797, "74036": 580, "80123": 517, "66086": 432, "66150": 284, "62042": 348, "12184": 746, "10109": 716, "20813": 736, "11410": 766, "20790": 835, "80170": 772, "14855": 420, "84003": 368, "11809": 742, "11641": 721, "82012": 769, "21605": 782, "76071": 548, "10889": 715, "11052": 803, "11723": 737, "76068": 638, "80010": 572, "12250": 768, "12914": 817, "10057": 850, "72053": 570, "64037": 811, "20722": 734, "10680": 626, "21287": 661, "62077": 746, "10155": 811, "86319": 476, "86123": 749, "11063": 534, "66009": 250, "21270": 751, "10217": 752, "12392": 780, "20995": 798, "12876": 474, "11767": 762, "64112": 438, "10291": 676, "10512": 734, "10198": 776, "10839": 703, "12482": 616, "10294": 534, "82128": 758, "70073": 836, "10087": 620, "10928": 749, "13503": 592, "11831": 768, "12645": 782, "80126": 790, "21097": 843, "10010": 546, "11358": 758, "10982": 335, "72061": 513, "78031": 561, "10794": 751, "60190": 376, "78056": 620, "12758": 826, "86543": 554, "66157": 395, "21487": 807, "10916": 700, "13059": 822, "12528": 770, "86299": 347, "13091": 840, "10583": 758, "20345": 786, "86221": 804, "64108": 725, "86495": 417, "86465": 491, "60027": 560, "10528": 517, "60206": 383, "13373": 778, "11079": 683, "13267": 814, "12652": 790, "11851": 846, "82102": 353, "86153": 494, "20197": 794, "86164": 380, "20119": 612, "12140": 671, "64126": 394, "12166": 805, "11733": 800, "10544": 746, "12814": 708, "11449": 812, "68182": 434, "64097": 706, "20001": 770, "60285": 570, "86386": 818, "21116": 723, "88111": 568, "84092": 795, "10018": 691, "74086": 661, "20312": 724, "12062": 789, "68191": 457, "10986": 620, "86537": 623, "86500": 444, "62024": 705, "10243": 758, "12099": 488, "10507": 407, "11374": 762, "78096": 312, "72033": 776, "82056": 793, "10646": 742, "76036": 623, "11367": 775, "68160": 721, "12398": 448, "11319": 822, "70065": 652, "60053": 763, "66056": 329, "74074": 334, "60290": 531, "12213": 264, "11884": 802, "60011": 752, "60076": 757, "70099": 657, "80109": 826, "10915": 691, "21470": 768, "11451": 848, "82101": 451, "62089": 582, "13494": 582, "60023": 709, "74081": 692, "70079": 731, "64032": 722, "60133": 670, "12564": 601, "13273": 833, "82002": 300, "86485": 633, "68065": 518, "86508": 533, "10764": 523, "13457": 521, "12829": 772, "12853": 773, "76044": 782, "86413": 577, "10154": 475, "11385": 796, "76034": 348, "66084": 317, "20766": 840, "13329": 769, "20547": 703, "20069": 853, "12122": 866, "68152": 542, "88044": 758, "11970": 528, "20887": 896, "12321": 727, "80073": 838, "12395": 746, "10201": 755, "86317": 346, "21505": 740, "11351": 682, "74065": 348, "76055": 541, "10962": 771, "11416": 701, "10568": 805, "20628": 888, "74062": 745, "21192": 627, "13127": 768, "86088": 278, "12001": 698, "10039": 764, "10809": 776, "21399": 780, "10572": 719, "21456": 792, "86444": 451, "12331": 872, "13213": 762, "86253": 741, "13364": 821, "64079": 470, "80050": 486, "21530": 762, "74009": 592, "64042": 734, "12363": 510, "11672": 777, "12836": 765, "10486": 797, "20086": 548, "60274": 550, "13161": 683, "20039": 446, "13355": 591, "68091": 735, "86417": 617, "13370": 481, "12455": 728, "20045": 761, "90017": 632, "86101": 724, "10042": 555, "70056": 704, "60269": 460, "88120": 846, "10522": 727, "60267": 337, "66126": 353, "21246": 675, "62085": 475, "13540": 476, "86014": 534, "80134": 579, "10540": 744, "80121": 382, "62013": 758, "80033": 456, "11580": 667, "86066": 406, "88087": 866, "12646": 847, "78065": 492, "80018": 521, "86061": 755, "13433": 693, "66058": 248, "86019": 556, "86010": 745, "86452": 402, "80141": 391, "10045": 813, "66045": 544, "70010": 618, "20635": 700, "10718": 875, "13473": 803, "12174": 588, "10344": 743, "13218": 814, "20394": 842, "90015": 497, "72078": 754, "60153": 466, "11895": 561, "12727": 622, "78083": 371, "20333": 671, "11737": 612, "86271": 537, "60214": 674, "21007": 837, "11639": 709, "12715": 631, "12193": 698, "74037": 583, "90003": 713, "12443": 745, "86055": 363, "12196": 680, "14806": 760, "76012": 638, "78041": 789, "82129": 372, "11712": 774, "68133": 532, "72056": 348, "10101": 797, "12359": 558, "70069": 817, "11518": 837, "60062": 677, "70085": 774, "20527": 839, "21460": 811, "10031": 815, "20606": 713, "11705": 646, "10919": 616, "10950": 806, "10736": 775, "12486": 496, "12970": 808, "11018": 657, "86307": 503, "88078": 854, "11120": 680, "86484": 443, "12647": 790, "86356": 344, "88117": 443, "82109": 278, "12677": 819, "84041": 579, "10236": 677, "11006": 626, "10777": 724, "64116": 687, "82130": 788, "10594": 752, "12472": 845, "72051": 555, "10808": 833, "80070": 746, "60251": 349, "86279": 299, "10013": 734, "84121": 740, "66018": 652, "11166": 813, "10863": 563, "13565": 392, "10376": 434, "10207": 704, "10124": 738, "10896": 467, "86295": 685, "14860": 623, "10493": 659, "12554": 773, "62022": 748, "66053": 379, "20202": 973, "13099": 815, "13223": 731, "62041": 595, "10661": 545, "64030": 750, "10293": 794, "88104": 809, "21209": 876, "12612": 467, "11799": 614, "20741": 881, "80012": 689, "86434": 376, "11690": 725, "10195": 777, "11728": 762, "60052": 812, "11769": 704, "82118": 568, "88026": 746, "88013": 852, "68134": 439, "86049": 477, "12535": 786, "86219": 846, "11681": 642, "20516": 935, "12008": 806, "20100": 853, "11630": 787, "62066": 712, "12052": 547, "11648": 753, "70017": 768, "86363": 409, "70045": 733, "86108": 288, "88061": 830, "80180": 211, "74004": 813, "74072": 539, "13102": 782, "10758": 434, "68073": 544, "86530": 325, "64083": 702, "70081": 719, "13526": 416, "10134": 688, "20731": 788, "60163": 358, "12633": 838, "11223": 532, "78062": 632, "10669": 711, "82039": 496, "86475": 758, "11635": 622, "21040": 820, "10799": 705, "13066": 756, "88124": 791, "10499": 791, "13284": 818, "13222": 748, "13515": 538, "10249": 676, "64009": 565, "80132": 618, "14837": 642, "10044": 517, "68036": 719, "13546": 750, "11179": 757, "10366": 712, "86488": 773, "84034": 427, "68197": 761, "12691": 766, "13425": 724, "74080": 738, "66101": 401, "11511": 843, "10907": 281, "12641": 817, "70044": 745, "13259": 772, "72062": 716, "78018": 735, "78001": 671, "10622": 665, "11888": 628, "13539": 757, "70001": 757, "80074": 825, "12909": 770, "66118": 791, "10766": 809, "84027": 745, "10834": 746, "68119": 633, "10485": 767, "86432": 400, "10891": 751, "21545": 660, "12186": 807, "74019": 362, "70096": 544, "12639": 471, "20872": 860, "60283": 524, "60107": 501, "68033": 728, "84116": 733, "10624": 783, "20412": 714, "86122": 496, "12061": 805, "12415": 697, "88029": 771, "20041": 807, "86336": 425, "20912": 833, "70089": 662, "12268": 739, "66113": 416, "80101": 463, "20405": 618, "12734": 853, "80043": 781, "10251": 657, "11678": 681, "10936": 768, "10796": 580, "10079": 769, "78046": 400, "62034": 704, "13574": 866, "88092": 772, "86021": 804, "90031": 569, "20483": 840, "80097": 809, "82153": 564, "88053": 854, "13482": 395, "13219": 563, "84020": 767, "10881": 389, "21511": 655, "12230": 549, "11284": 753, "12311": 535, "20982": 703, "64073": 771, "11675": 795, "21119": 571, "10567": 743, "60051": 583, "76063": 774, "60205": 355, "82122": 815, "68147": 471, "80098": 676, "21167": 776, "86374": 445, "12878": 738, "12779": 354, "10483": 720, "82022": 733, "10835": 743, "20094": 839, "20718": 712, "88069": 890, "13202": 792, "68199": 618, "11176": 676, "66077": 450, "10695": 473, "11827": 833, "76028": 280, "21032": 595, "13258": 796, "84119": 577, "10227": 691, "62069": 417, "88107": 515, "20265": 733, "12110": 579, "21367": 749, "11825": 587, "10343": 782, "12286": 384, "86152": 390, "12162": 692, "10682": 629, "82085": 534, "10484": 713, "10647": 503, "13043": 513, "66116": 444, "68171": 707, "60164": 674, "11801": 614, "62003": 765, "66093": 454, "62028": 467, "12163": 521, "20358": 859, "64019": 406, "20619": 455, "11871": 643, "84072": 741, "10960": 416, "10869": 757, "20402": 647, "11706": 782, "72012": 651, "68039": 700, "10921": 713, "78067": 281, "11987": 742, "68013": 641, "10443": 471, "88144": 727, "11944": 763, "80157": 587, "68012": 491, "68166": 576, "11095": 721, "12063": 642, "10901": 761, "13663": 701, "10653": 630, "76045": 703, "13068": 723, "10734": 798, "13157": 687, "10351": 570, "60120": 760, "78002": 819, "11732": 738, "20971": 882, "88135": 775, "84113": 804, "86450": 656, "13435": 795, "84043": 558, "12340": 770, "90009": 629, "60037": 794, "13162": 803, "88096": 847, "12370": 326, "12816": 540, "21289": 788, "10765": 742, "68040": 763, "10635": 860, "78053": 865, "21607": 510, "10521": 735, "66155": 267, "66063": 750, "12266": 760, "66029": 389, "12314": 692, "21549": 806, "86156": 165, "11779": 831, "64080": 503, "80115": 596, "84032": 728, "64033": 439, "64061": 766, "21155": 892, "11464": 685, "12238": 625, "21406": 672, "21276": 771, "84082": 495, "12648": 798, "68170": 516, "11729": 619, "82060": 570, "84105": 422, "13500": 574, "88017": 693, "82028": 813, "60216": 626, "10349": 788, "60227": 399, "64062": 743, "12565": 717, "20410": 828, "21455": 650, "62016": 572, "60081": 527, "11965": 494, "60145": 538, "82049": 650, "86469": 617, "60273": 494, "14864": 584, "12338": 665, "12043": 804, "86364": 454, "80094": 614, "21198": 726, "76069": 598, "84053": 803, "68096": 812, "12818": 485, "20908": 913, "64101": 539, "13022": 802, "21382": 701, "14876": 365, "78054": 746, "11270": 538, "10027": 772, "90005": 319, "11332": 812, "14278": 518, "11515": 846, "10105": 792, "84011": 765, "10321": 344, "10331": 569, "14840": 857, "86089": 485, "13579": 411, "86512": 617, "21126": 881, "10307": 742, "12242": 662, "68101": 660, "80061": 734, "12009": 715, "12828": 803, "10370": 627, "12540": 770, "80019": 422, "86353": 422, "21244": 675, "86357": 428, "80025": 491, "12583": 750, "12027": 546, "12097": 684, "76070": 516, "86313": 550, "11908": 824, "70016": 705, "21615": 469, "11861": 831, "70043": 771, "12667": 764, "10639": 777, "13093": 859, "72047": 848, "86146": 751, "86445": 539, "14847": 795, "11744": 816, "11225": 557, "80078": 339, "78011": 248, "20814": 745, "13492": 790, "70046": 720, "14809": 565, "74068": 803, "12908": 772, "12630": 534, "11778": 778, "10309": 498, "90002": 308, "88072": 813, "60189": 445, "12519": 802, "11858": 758, "10996": 701, "11377": 736, "62083": 802, "20370": 884, "12039": 805, "10545": 705, "88019": 793, "13339": 443, "13241": 759, "80031": 329, "12544": 752, "13292": 790, "21255": 876, "10589": 801, "84040": 792, "68066": 431, "11024": 689, "11494": 730, "21094": 831, "11434": 754, "10745": 793, "12328": 865, "13580": 821, "82149": 405, "10792": 684, "13578": 759, "86376": 727, "78079": 424, "10068": 812, "12173": 585, "21297": 889, "10404": 563, "68174": 781, "80107": 605, "10280": 648, "12724": 825, "13008": 797, "86428": 660, "20074": 750, "62015": 742, "10447": 755, "60226": 418, "82138": 800, "13141": 423, "21616": 759, "20083": 766, "72020": 805, "11171": 813, "68137": 741, "20525": 805, "10723": 653, "10886": 732, "88084": 877, "64041": 494, "66070": 453, "80105": 422, "11479": 650, "20541": 596, "10297": 352, "82042": 367, "11991": 685, "10464": 747, "68187": 715, "86136": 339, "11770": 833, "12852": 772, "12416": 873, "12339": 744, "60174": 448, "86287": 526, "12273": 729, "10279": 746, "82025": 790, "12702": 674, "13041": 816, "80065": 519, "74018": 562, "86098": 361, "80106": 570, "86542": 390, "88106": 918, "80027": 360, "60320": 459, "74013": 766, "80086": 754, "10017": 797, "12776": 885, "10026": 688, "11590": 611, "21477": 703, "10230": 725, "88025": 836, "11856": 804, "11073": 789, "20461": 866, "21195": 794, "13331": 781, "86524": 421, "60242": 474, "20907": 907, "82090": 416, "11468": 677, "13257": 519, "68070": 582, "60084": 788, "60122": 585, "20820": 794, "11923": 535, "62087": 506, "14846": 275, "11840": 776, "10439": 731, "10791": 588, "60220": 784, "11039": 788, "10577": 659, "10614": 797, "10153": 398, "12711": 835, "72082": 694, "21219": 810, "68010": 703, "60255": 354, "20561": 637, "86355": 410, "66109": 523, "20726": 840, "86223": 786, "60058": 572, "13829": 603, "11100": 708, "86064": 435, "70019": 760, "70047": 585, "11220": 646, "62095": 487, "72049": 854, "64029": 750, "72006": 830, "20022": 687, "74031": 600, "12148": 479, "60010": 749, "13088": 773, "13366": 725, "80056": 785, "13051": 813, "12598": 814, "10292": 659, "12926": 833, "86441": 536, "60275": 756, "13049": 832, "20979": 770, "13047": 471, "10587": 729, "13365": 742, "84062": 638, "13576": 761, "10401": 842, "12903": 597, "20879": 814, "86104": 726, "88035": 751, "11340": 794, "60116": 522, "20773": 894, "88180": 623, "12390": 766, "86133": 401, "84038": 495, "82091": 316, "20854": 759, "64060": 734, "10437": 740, "86535": 634, "20329": 839, "12760": 827, "10050": 863, "60001": 494, "70090": 847, "12401": 809, "70038": 811, "60034": 515, "80142": 655, "84076": 395, "10940": 650, "13014": 857, "80136": 792, "10788": 777, "12962": 761, "10801": 581, "80020": 770, "88037": 815, "62039": 452, "12082": 507, "64115": 389, "10965": 508, "12235": 413, "60014": 553, "13287": 800, "68196": 818, "84109": 391, "66049": 629, "13559": 509, "60083": 691, "10377": 490, "10268": 798, "10132": 589, "13484": 458, "11820": 810, "86477": 327, "84052": 773, "13452": 420, "13231": 769, "86244": 527, "10319": 711, "12371": 780, "60029": 512, "60262": 465, "10803": 593, "86265": 391, "66103": 424, "64103": 504, "86340": 477, "62090": 682, "60212": 670, "10360": 440, "10579": 595, "86278": 472, "21548": 681, "78030": 463, "13477": 466, "10513": 778, "12144": 568, "66124": 399, "12320": 749, "86412": 792, "86068": 479, "12053": 794, "10082": 407, "11829": 779, "78069": 806, "88001": 855, "84017": 453, "10084": 732, "60167": 609, "13021": 769, "20178": 788, "11265": 611, "80079": 746, "10051": 814, "70027": 760, "86012": 761, "14826": 479, "66035": 391, "10142": 776, "88080": 844, "88176": 779, "10543": 733, "11327": 840, "20468": 883, "13100": 801, "70064": 822, "10269": 640, "12697": 796, "86538": 504, "21378": 793, "60238": 797, "10152": 743, "12966": 573, "20211": 696, "88167": 873, "82116": 495, "21350": 821, "76037": 247, "12934": 344, "84078": 796, "86440": 499, "84010": 524, "13031": 652, "12839": 796, "13384": 605, "86404": 807, "11097": 732, "82114": 436, "13532": 332, "84012": 762, "12625": 462, "14734": 305, "72067": 763, "12060": 794, "12838": 741, "12258": 527, "12620": 670, "60050": 738, "84023": 370, "10904": 507, "13268": 813, "68106": 505, "20844": 853, "12614": 671, "86218": 751, "88146": 601, "11089": 704, "11838": 875, "10125": 767, "12257": 332, "84013": 712, "10617": 811, "66039": 586, "13381": 746, "66032": 769, "86425": 567, "66148": 502, "76011": 386, "74091": 774, "21373": 870, "12261": 594, "80088": 399, "88015": 738, "11059": 734, "12111": 527, "88041": 840, "11495": 699, "11736": 843, "84074": 525, "66096": 354, "60130": 652, "12805": 611, "20141": 838, "13040": 833, "10925": 732, "84100": 404, "10552": 773, "88075": 900, "80044": 507, "12508": 431, "88077": 893, "11817": 822, "86424": 609, "21060": 793, "12231": 737, "10077": 824, "80171": 564, "11595": 788, "88162": 835, "10906": 411, "60258": 829, "82009": 659, "10526": 687, "10836": 791, "10658": 841, "88004": 807, "88166": 867, "80015": 416, "20353": 827, "12507": 857, "68018": 677, "12409": 470, "13785": 604, "11030": 751, "74026": 706, "86528": 491, "84075": 426, "20109": 609, "12323": 662, "10964": 570, "86371": 473, "78005": 551, "64058": 717, "12765": 822, "13426": 726, "20918": 794, "20504": 831, "88148": 812, "13516": 775, "10032": 811, "10211": 549, "76041": 458, "82005": 362, "11956": 537, "10874": 700, "62053": 617, "70077": 762, "68186": 771, "13029": 804, "62011": 772, "68014": 675, "84033": 246, "88021": 797, "86354": 543, "10170": 813, "86531": 587, "60200": 395, "86193": 249, "64078": 470, "64067": 718, "20832": 681, "13362": 384, "88059": 742, "68200": 672, "86466": 413, "90000": 725, "60281": 679, "12596": 789, "10946": 518, "70024": 781, "12577": 808, "11393": 793, "10062": 648, "10355": 696, "21345": 791, "12013": 781, "82141": 775, "10148": 740, "20945": 914, "10253": 319, "86106": 455, "86315": 460, "10228": 560, "11369": 814, "88024": 852, "10455": 702, "10603": 369, "10608": 766, "13166": 797, "84103": 694, "20445": 914, "21322": 843, "20024": 732, "13595": 802, "12114": 438, "64075": 574, "11217": 560, "11175": 722, "13285": 498, "14862": 493, "13439": 763, "86167": 339, "68022": 620, "86125": 582, "84055": 324, "84054": 747, "12513": 556, "64014": 587, "60165": 387, "20771": 837, "10563": 802, "12263": 597, "11428": 735, "80168": 595, "11101": 699, "60316": 413, "13293": 771, "20286": 888, "88071": 826, "21372": 822, "86489": 718, "72076": 342, "11934": 639, "78044": 355, "80116": 628, "68054": 689, "12404": 491, "72079": 401, "10270": 807, "20590": 828, "11399": 794, "10885": 767, "78007": 624, "86259": 732, "86044": 460, "12706": 770, "86075": 549, "82132": 449, "11870": 812, "12611": 733, "62055": 306, "82016": 769, "11755": 567, "21498": 608, "20030": 796, "60033": 505, "11818": 810, "68135": 673, "60110": 435, "62014": 755, "13587": 754, "11626": 752, "88169": 845, "21340": 840, "80008": 824, "82105": 407, "13252": 796, "11443": 784, "21191": 789, "20845": 921, "78073": 390, "66031": 502, "10659": 828, "12877": 534, "88105": 846, "72010": 854, "60194": 701, "80122": 751, "13101": 571, "74012": 742, "10110": 721, "11071": 552, "10601": 457, "20035": 811, "10444": 755, "76019": 286, "74023": 710, "20295": 773, "82095": 438, "10862": 788, "13340": 800, "74075": 286, "13564": 753, "11886": 697, "68185": 762, "86325": 531, "11331": 808, "12543": 835, "78070": 670, "10524": 797, "11005": 802, "62023": 360, "62073": 356, "13429": 409, "60021": 596, "20339": 831, "72031": 757, "11436": 850, "12185": 739, "20170": 818, "11150": 728, "21024": 849, "88066": 907, "20925": 876, "13343": 776, "82099": 781, "66071": 454, "12808": 770, "11917": 761, "70029": 751, "12224": 384, "20146": 811, "70076": 393, "20413": 748, "11037": 756, "84024": 371, "86388": 536, "74055": 472, "88046": 814, "10024": 811, "12225": 520, "86322": 341, "13437": 750, "11763": 791, "11134": 605, "10178": 776, "10350": 489, "70067": 634, "11828": 610, "86446": 608, "12447": 778, "11952": 782, "13262": 759, "68155": 508, "12095": 769, "21187": 778, "88177": 663, "62076": 748, "76046": 746, "88094": 962, "80129": 443, "88090": 836, "88133": 846, "21448": 660, "21102": 862, "11338": 565, "64017": 751, "11501": 837, "11354": 751, "13496": 473, "14828": 536, "13449": 749, "11860": 834, "11383": 786, "86124": 829, "86349": 729, "82008": 431, "21523": 776, "86346": 422, "11384": 757, "86224": 809, "60300": 402, "20368": 865, "72032": 732, "66120": 767, "60297": 454, "68150": 743, "13282": 443, "12076": 842, "12441": 768, "82019": 505, "11836": 663, "11133": 711, "12771": 859, "20749": 807, "11243": 767, "12882": 473, "84058": 365, "86318": 496, "20465": 847, "62072": 320, "84063": 396, "10220": 716, "10892": 573, "12988": 679, "10696": 824, "20736": 796, "86242": 753, "86380": 490, "10667": 775, "13453": 713, "68163": 566, "13402": 712, "11472": 554, "76006": 600, "20058": 772, "12444": 556, "86158": 437, "20804": 850, "86020": 509, "88149": 841, "11657": 693, "13061": 697, "80049": 793, "10021": 545, "12517": 714, "11113": 417, "10807": 625, "11864": 818, "13549": 716, "20737": 803, "66069": 353, "11999": 759, "11107": 675, "11924": 526, "66094": 329, "86471": 383, "60318": 687, "76048": 678, "10422": 778, "12333": 890, "88008": 787, "68035": 778, "10067": 597, "20182": 835, "90004": 673, "10471": 692, "10328": 721, "13535": 446, "12806": 746, "76074": 394, "68122": 658, "13447": 787, "20150": 796, "76010": 449, "10783": 784, "88010": 746, "21459": 708, "21337": 832, "68050": 763, "11488": 796, "13585": 496, "74085": 623, "12681": 893, "62092": 610, "21245": 880, "86059": 445, "80036": 496, "84021": 769, "60142": 437, "12169": 788, "12260": 410, "60176": 432, "86474": 754, "12761": 816, "76024": 723, "86256": 593, "60008": 438, "11177": 809, "84039": 764, "76073": 291, "10431": 658, "11868": 801, "21048": 817, "13396": 775, "66020": 495, "10192": 558, "13209": 786, "12800": 567, "20707": 835, "12476": 800, "82097": 648, "62012": 713, "20304": 846, "21338": 785, "20579": 843, "60301": 456, "88058": 588, "12522": 809, "20157": 743, "10841": 770, "72068": 485, "10244": 644, "20574": 883, "60031": 755, "10725": 744, "68011": 752, "86360": 355, "11256": 745, "86051": 776, "13415": 385, "74093": 753, "10535": 781, "10388": 674, "21205": 833, "12498": 418, "10820": 826, "12175": 490, "84028": 746, "60162": 772, "68159": 445, "86421": 368, "20770": 829, "68025": 546, "12576": 721, "74082": 656, "11214": 659, "10187": 714, "10761": 762, "84057": 454, "11808": 906, "12975": 815, "12471": 755, "86478": 474, "80162": 770, "10949": 751, "10156": 842, "11933": 733, "72066": 501, "11759": 763, "11033": 710, "20365": 859, "10605": 467, "20463": 828, "60137": 627, "12531": 685, "68105": 723, "84001": 463, "76020": 611, "80068": 494, "10342": 612, "10488": 799, "12198": 732, "13046": 538, "13148": 433, "10428": 631, "62063": 631, "12655": 791, "10596": 800, "88156": 821, "82094": 665, "12542": 782, "12136": 531, "10575": 571, "64026": 770, "13358": 753, "86270": 405, "10078": 761, "13072": 758, "20432": 829, "14845": 812, "88060": 749, "10828": 663, "60180": 364, "86147": 802, "12798": 625, "20900": 832, "10461": 720, "86100": 392, "13239": 494, "13352": 635, "10226": 499, "86280": 649, "12581": 632, "74059": 821, "11035": 737, "11583": 730, "72065": 483, "86350": 606, "10988": 794, "11997": 642, "78047": 397, "10407": 686, "13106": 825, "13519": 452, "12402": 680, "12682": 577, "21017": 706, "12334": 686, "11927": 723, "21335": 861, "13095": 843, "60125": 621, "68132": 759, "84022": 640, "10385": 747, "11209": 792, "12754": 838, "12016": 708, "20386": 841, "13428": 274, "11274": 774, "66013": 389, "68015": 756, "12460": 639, "13341": 416, "21169": 701, "10277": 705, "66026": 551, "12532": 551, "11036": 709, "20457": 753, "10780": 771, "64114": 717, "11149": 761, "60139": 534, "10237": 506, "10815": 859, "78010": 348, "84086": 554, "80016": 792, "88139": 898, "14851": 778, "78052": 596, "13190": 460, "82111": 443, "12430": 883, "68097": 766, "60067": 700, "66073": 454, "11318": 806, "84005": 765, "86392": 625, "60157": 733, "80014": 726, "13082": 807, "13294": 740, "12769": 722, "10714": 716, "21420": 563, "80110": 394, "86031": 477, "86262": 330, "12775": 824, "11121": 673, "86481": 249, "12509": 766, "60249": 409, "80143": 523, "11673": 511, "60004": 724, "60035": 708, "10080": 819, "12867": 601, "10753": 351, "12631": 828, "60278": 444, "86553": 649, "11859": 791, "82033": 372, "60158": 509, "12096": 710, "12374": 852, "12797": 373, "86491": 669, "12010": 631, "12873": 738, "88070": 843, "60329": 416, "12668": 662, "10012": 791, "10271": 686, "82001": 769, "10120": 792, "20120": 796, "13566": 812, "13080": 416, "10115": 439, "86352": 381, "74064": 367, "11900": 744, "88073": 792, "21320": 827, "10449": 490, "11009": 763, "21306": 856, "11877": 833, "86339": 555, "70040": 766, "60231": 545, "11833": 837, "86468": 549, "21563": 772, "64085": 717, "11865": 708, "11188": 433, "11936": 607, "11743": 805, "21298": 836, "13392": 484, "11552": 506, "86366": 602, "10923": 758, "21272": 788, "60307": 600, "12428": 887, "60192": 240, "12985": 574, "80054": 655, "60113": 703, "13023": 740, "86005": 790, "84061": 409, "11824": 847, "64092": 778, "20801": 829, "88184": 841, "12520": 733, "84030": 286, "12719": 821, "80013": 731, "13562": 808, "12708": 824, "11099": 749, "88047": 741, "10375": 724, "10851": 384, "76008": 741, "64068": 395, "11427": 729, "12445": 764, "12425": 887, "78042": 632, "10104": 695, "11279": 464, "60241": 772, "11508": 797, "86063": 716, "10118": 615, "80007": 823, "86502": 435, "60235": 796, "12772": 916, "21425": 883, "20640": 826, "12145": 786, "82110": 240, "60196": 633, "21181": 891, "12773": 867, "20857": 784, "62049": 752, "11336": 796, "82131": 771, "11798": 689, "10113": 439, "90014": 609, "11376": 731, "66115": 610, "11409": 814, "20499": 840, "80077": 412, "60105": 584, "10429": 681, "12037": 772, "11299": 768, "86067": 756, "82043": 424, "12728": 516, "11711": 799, "11815": 824, "84101": 427, "11500": 810, "68192": 763, "64031": 361, "82124": 561, "10690": 741, "20839": 734, "86076": 379, "74040": 780, "12998": 837, "86004": 449, "80149": 658, "10700": 775, "12723": 815, "11680": 761, "66072": 392, "10878": 724, "74042": 547, "60324": 372, "76062": 401, "88086": 829, "20633": 716, "20214": 586, "86409": 458, "78049": 597, "82006": 762, "12694": 810, "20739": 846, "13054": 858, "13191": 787, "11881": 590, "20542": 829, "80165": 799, "84009": 566, "20201": 831, "86009": 746, "12848": 822, "14812": 825, "11562": 594, "78077": 327, "82004": 779, "11078": 788, "68111": 651, "10215": 405, "12157": 760, "86216": 474, "13067": 831, "21546": 728, "11002": 777, "10454": 703, "11593": 793, "13542": 717, "20230": 764, "20229": 851, "11345": 817, "20992": 776, "68149": 754, "82096": 793, "68118": 673, "60032": 526, "11236": 631, "86314": 619, "90006": 214, "12868": 682, "10469": 771, "10649": 716, "11656": 722, "12939": 767, "12177": 762, "21165": 798, "84048": 571, "11677": 761, "12750": 854, "78072": 508, "12925": 799, "12935": 312, "11665": 745, "88018": 843, "88123": 866, "10768": 432, "13009": 730, "12393": 740, "12216": 492, "80042": 611, "10973": 794, "66040": 336, "72008": 822, "11746": 808, "88085": 815, "21273": 897, "21557": 607, "12579": 591, "12072": 802, "84106": 709, "10417": 733, "13423": 598, "20720": 771, "11259": 747, "12683": 817, "13438": 750, "60195": 461, "66153": 595, "60006": 618, "12202": 456, "20255": 849, "68195": 792, "20551": 612, "86334": 402, "64028": 695, "66001": 392, "86454": 495, "80127": 679, "86069": 436, "60112": 426, "20006": 841, "60228": 531, "86431": 393, "64006": 675, "13359": 731, "11104": 700, "13092": 739, "60199": 457, "10345": 807, "86514": 430, "10426": 693, "60070": 385, "21105": 801, "60336": 515, "86438": 830, "66125": 719, "64021": 733, "20277": 738, "21370": 841, "76047": 576, "86045": 451, "66011": 193, "86534": 754, "60236": 819, "10691": 741, "60183": 521, "82018": 472, "11267": 743, "78071": 755, "86377": 759, "80144": 468, "60132": 731, "21495": 868, "64086": 683, "11574": 759, "10035": 693, "11475": 539, "68045": 695, "21197": 437, "20550": 810, "12172": 575, "72084": 818, "88179": 730, "13547": 788, "68139": 519, "10272": 807, "20581": 761, "12880": 781, "68095": 607, "12459": 868, "13441": 752, "12957": 409, "78078": 721, "11721": 676, "72058": 707, "13592": 475, "86551": 536, "86192": 419, "66076": 446, "10459": 773, "10560": 496, "60280": 603, "20780": 644, "10926": 511, "13144": 686, "86321": 431, "20429": 861, "10386": 523, "10621": 793, "60213": 367, "10004": 778, "88155": 817, "82003": 410, "13344": 750, "86228": 453, "80111": 630, "86435": 532, "88000": 794, "68184": 452, "20520": 828, "68069": 738, "10216": 549, "70091": 797, "20789": 855, "20355": 659, "68183": 756, "13042": 401, "12628": 486, "20693": 744, "64003": 741, "13521": 491, "10358": 766, "74076": 392, "86457": 422, "20234": 625, "88164": 773, "10016": 844, "13278": 529, "66021": 634, "86085": 525, "62093": 528, "86141": 455, "12247": 726, "11904": 806, "86358": 342, "78088": 386, "13311": 549, "20647": 770, "21412": 712, "11422": 808, "10432": 526, "80067": 721, "80051": 611, "10586": 804, "13012": 440, "12347": 765, "13288": 644, "76075": 645, "66052": 743, "11375": 477, "66087": 580, "88079": 824, "88022": 774, "78038": 727, "86199": 736, "78023": 713, "11667": 606, "13107": 784, "12986": 556, "86375": 551, "11342": 597, "12673": 815, "11298": 783, "11662": 685, "12759": 813, "66104": 476, "86533": 675, "12857": 737, "11262": 819, "13831": 847, "84095": 765, "64117": 595, "82100": 783, "12964": 777, "84066": 428, "20199": 833, "88032": 826, "12796": 775, "12892": 765, "88065": 802, "10318": 375, "66107": 713, "12087": 826, "78028": 710, "12077": 725, "88088": 963, "64064": 744, "20853": 877, "68009": 679, "12440": 743, "72007": 693, "84112": 575, "20817": 829, "11492": 722, "10096": 735, "12419": 828, "10085": 746, "11226": 705, "86252": 810, "64072": 669, "66138": 440, "13372": 754, "10890": 424, "11969": 804, "62017": 483, "10663": 690, "13253": 600, "64093": 788, "86097": 455, "86249": 822, "21610": 734, "60181": 198, "10947": 620, "10323": 306, "12933": 877, "12601": 795, "12701": 796, "11772": 698, "10549": 568, "76067": 499, "20842": 859, "76026": 694, "20008": 686, "70022": 552, "12161": 727, "60187": 578, "88140": 854, "10631": 825, "13463": 775, "10210": 606, "70057": 777, "74029": 768, "88089": 875, "86548": 518, "13790": 769, "68067": 308, "11756": 566, "20515": 741, "20638": 835, "11231": 535, "10853": 477, "88052": 840, "13281": 539, "80022": 538, "86458": 493, "11241": 746, "11184": 649, "10855": 758, "20776": 820, "86105": 495, "12158": 760, "10564": 749, "10412": 499, "11527": 592, "10994": 751, "13094": 760, "76025": 390, "12206": 467, "21522": 771, "88012": 904, "20138": 888, "10392": 691, "12451": 755, "11760": 711, "20860": 832, "13045": 833, "60069": 674, "76054": 384, "68109": 787, "20379": 837, "12855": 794, "11946": 787, "68143": 682, "12748": 831, "11123": 703, "82145": 713, "10779": 789, "12662": 535, "20129": 799, "13000": 741, "10287": 709, "12408": 737, "80048": 543, "21354": 613, "68068": 478, "12709": 641, "88112": 738, "66085": 695, "88051": 779, "10379": 487, "70018": 367, "11883": 793, "84019": 575, "78094": 778, "12132": 716, "11691": 682, "12684": 795, "20627": 901, "10688": 748, "10920": 707, "60170": 380, "76014": 548, "11145": 755, "11230": 791, "20307": 675, "60049": 565, "12582": 810, "88048": 686, "11239": 636, "64099": 738, "10436": 503, "74015": 777, "12726": 791, "13017": 832, "12592": 783, "70058": 703, "68062": 457, "11481": 731, "12028": 725, "66144": 585, "13561": 820, "11388": 793, "21339": 860, "74010": 749, "10743": 696, "13296": 353, "66122": 331, "66078": 633, "76058": 740, "21304": 708, "60102": 412, "13057": 730, "13096": 616, "13158": 421, "20891": 882, "68049": 685, "68123": 602, "78013": 344, "12183": 759, "21600": 719, "21578": 818, "12011": 745, "20192": 689, "12176": 366, "82021": 442, "82017": 776, "86173": 429, "10813": 761, "20374": 842, "80066": 738, "11584": 507, "60118": 699, "13299": 730, "10325": 726, "12318": 778, "10130": 545, "20510": 653, "11726": 778, "10548": 858, "14640": 742, "86504": 626, "21525": 792, "20687": 762, "72023": 805, "20123": 855, "12650": 840, "60197": 403, "10558": 780, "20065": 815, "13062": 773, "80155": 795, "60090": 481, "88042": 808, "20151": 794, "21403": 773, "86407": 666, "60109": 749, "86196": 733, "10002": 837, "86290": 499, "12190": 764, "80058": 659, "20521": 733, "11486": 738, "68100": 607, "86016": 535, "78029": 370, "60341": 407, "12228": 737, "78025": 668, "21108": 583, "60250": 804, "74067": 444, "11938": 517, "12959": 482, "12181": 759, "64023": 387, "72016": 822, "70098": 762, "60328": 707, "80082": 291, "10006": 845, "12168": 676, "84007": 684, "12785": 420, "88031": 701, "86079": 410, "21504": 828, "74088": 500, "11572": 716, "60066": 450, "10951": 551, "60254": 424, "82067": 576, "10623": 633, "12150": 610, "86473": 332, "68188": 735, "21000": 762, "86277": 202, "12073": 821, "13071": 832, "10176": 797, "11172": 780, "10634": 785, "64076": 622, "86343": 452, "20577": 825, "86406": 797, "78014": 852, "10213": 718, "12753": 769, "60030": 621, "60253": 354, "12920": 755, "10720": 778, "10917": 748, "86053": 413, "66068": 709, "12801": 560, "66134": 405, "11314": 615, "12452": 555, "60091": 797, "13085": 819, "10527": 784, "60279": 738, "12521": 860, "10955": 730, "20779": 737, "80113": 810, "12484": 853, "10578": 599, "12618": 479, "12593": 605, "68085": 709, "80179": 410, "10706": 754, "11453": 755, "20367": 806, "62082": 709, "12030": 812, "13084": 823, "11164": 773, "20637": 828, "60127": 451, "86243": 730, "60095": 769, "13216": 690, "20874": 808, "21138": 763, "80095": 836, "14733": 623, "12843": 779, "10932": 762, "84114": 474, "11129": 719, "86137": 747, "11380": 845, "12817": 465, "12149": 767, "10730": 753, "10114": 588, "10025": 806, "86448": 571, "13347": 378, "86368": 465, "62079": 768, "11550": 749, "12644": 804, "11795": 687, "13048": 822, "11670": 775, "20911": 939, "64107": 782, "12883": 783, "60152": 413, "78027": 734, "10737": 851, "11745": 848, "80017": 732, "12116": 796, "10265": 740, "68129": 792, "10398": 754, "86292": 630, "11683": 849, "82015": 433, "11485": 574, "10847": 614, "13462": 624, "88027": 741, "21256": 798, "12221": 363, "82154": 411, "13173": 547, "11847": 784, "11061": 747, "82031": 340, "80091": 388, "60186": 673, "12104": 739, "64084": 772, "12024": 765, "86082": 402, "20175": 812, "13573": 824, "20484": 877, "13328": 498, "21564": 817, "76007": 585, "10341": 682, "21516": 815, "10242": 764, "11411": 806, "20392": 825, "70063": 808, "80087": 764, "90053": 454, "10363": 738, "11649": 795, "10785": 658, "11661": 693, "11652": 520, "82133": 412, "20408": 754, "20189": 743, "11365": 776, "60173": 607, "11862": 844, "60342": 367, "66048": 322, "10562": 732, "86039": 733, "60215": 531, "13125": 731, "13035": 630, "11794": 796, "12606": 454, "11405": 797, "12904": 799, "86522": 433, "11983": 656, "13403": 487, "11752": 840, "20497": 665, "13489": 723, "10728": 758, "10334": 521, "11848": 845, "12389": 602, "13212": 511, "20539": 711, "11215": 644, "64074": 596, "12167": 761, "11945": 792, "86102": 783, "86480": 484, "13479": 793, "86084": 452, "20108": 811, "64100": 798, "62048": 530, "86482": 640, "11835": 705, "60237": 561, "74078": 440, "10139": 746, "86257": 412, "12725": 915, "10704": 727, "12054": 530, "11876": 769, "21250": 720, "11914": 745, "20734": 844, "11102": 748, "60024": 606, "86286": 588, "78074": 353, "11869": 820, "60048": 517, "10284": 756, "68075": 441, "66043": 716, "70086": 700, "13053": 837, "12481": 818, "14818": 814, "10689": 585, "10111": 433, "11228": 738, "68008": 603, "84046": 760, "60018": 519, "66008": 743, "62030": 708, "86026": 713, "12634": 791, "13243": 537, "78024": 644, "11821": 818, "11910": 413, "66066": 737, "20928": 845, "82080": 549, "12686": 796, "86296": 376, "10748": 763, "11355": 709, "76009": 429, "10934": 710, "64065": 723, "80146": 832, "12891": 693, "10534": 583, "60002": 788, "12485": 827, "82051": 639, "13184": 803, "10677": 657, "11849": 831, "60085": 788, "82148": 324, "11477": 730, "11280": 751, "11645": 727, "20549": 827, "10233": 746, "88097": 600, "88093": 900, "11440": 718, "80071": 813, "10381": 795, "13436": 440, "12574": 786, "60309": 771, "10086": 760, "12545": 775, "13211": 733, "80041": 768, "80166": 667, "10146": 796, "10984": 718, "12003": 635, "82059": 553, "10347": 587, "11062": 830, "12246": 670, "60243": 698, "20334": 707, "60096": 799, "10462": 680, "60240": 336, "70070": 815, "10727": 543, "68046": 717, "11178": 753, "68141": 534, "13128": 750, "12121": 554, "14843": 516, "10326": 808, "13064": 504, "11632": 781, "10930": 750, "20033": 748, "21028": 681, "13266": 790, "86442": 399, "13681": 447, "12256": 761, "66042": 426, "10629": 784, "80118": 745, "86479": 468, "62046": 283, "86436": 403, "12200": 759, "86092": 398, "12477": 863, "20391": 768, "86414": 407, "86324": 516, "20016": 819, "82078": 803, "12470": 595, "10870": 518, "12756": 646, "66083": 726, "86062": 459, "20279": 844, "88159": 793, "21279": 675, "13570": 478, "70083": 779, "11640": 717, "86052": 471, "10866": 761, "20759": 831, "86006": 505, "86529": 379, "86408": 658, "70068": 620, "20067": 867, "76052": 717, "72017": 812, "88152": 842, "72085": 820, "11389": 838, "11343": 826, "11013": 742, "12567": 844, "20730": 718, "10310": 531, "60266": 472, "10626": 822, "70071": 711, "13417": 463, "86094": 425, "72083": 800, "86552": 316, "20858": 792, "10580": 707, "20841": 883, "68028": 735, "12252": 576, "12849": 745, "10122": 725, "68202": 788, "60131": 564, "20285": 876, "66132": 457, "68110": 709, "20012": 874, "11457": 692, "10810": 802, "60326": 766, "66141": 740, "11364": 727, "20449": 833, "11054": 359, "12672": 552, "60323": 526, "10108": 763, "10756": 725, "72037": 805, "68151": 733, "80083": 328, "13430": 447, "12575": 709, "60063": 787, "21203": 733, "84015": 726, "12924": 609, "10739": 826, "82037": 509, "21400": 719, "86065": 761, "20490": 901, "10296": 391, "60092": 772, "68157": 447, "78066": 834, "88082": 897, "20406": 829, "66143": 499, "11132": 780, "60159": 584, "86496": 441, "60219": 497, "13513": 781, "13375": 816, "76066": 627, "60149": 784, "76022": 833, "80046": 470, "11029": 805, "66106": 530, "12794": 838, "12312": 756, "12429": 879, "12091": 576, "86007": 488, "78048": 882, "13511": 749, "88103": 664, "20710": 736, "84047": 494, "20848": 827, "13193": 519, "60093": 772, "20956": 872, "21589": 612, "70025": 823, "66098": 483, "76030": 290, "11811": 866, "20517": 889, "86429": 382, "12380": 820, "10582": 614, "10972": 774, "10672": 805, "12649": 754, "21506": 679, "20222": 589, "21257": 735, "11832": 664, "13382": 339, "11949": 547, "86490": 429, "20644": 838, "12676": 713, "64047": 812, "60302": 559, "64018": 518, "13445": 837, "78035": 822, "66034": 494, "86266": 413, "11272": 794, "20395": 791, "84088": 339, "10829": 523, "60005": 534, "10348": 619, "12262": 268, "20795": 820, "82047": 802, "86036": 390, "12766": 812, "10802": 496, "20906": 879, "62091": 356, "11937": 805, "20216": 679, "20038": 820, "20088": 604, "80028": 385, "12128": 788, "76057": 748, "12035": 824, "13097": 835, "86426": 476, "12123": 820, "10382": 631, "78026": 259, "13323": 544, "86345": 435, "13363": 851, "86402": 411, "12695": 836, "80006": 823, "84117": 556, "60022": 744, "86225": 722, "12137": 496, "86381": 771, "13525": 460, "60256": 492, "66137": 521, "86399": 595, "66140": 655, "60308": 417, "10157": 793, "60315": 765, "12811": 445, "10161": 759, "13208": 819, "12036": 628, "11989": 591, "86237": 805, "11764": 786, "60314": 827, "12474": 822, "10840": 798, "12860": 815, "88002": 892, "13098": 786, "13545": 702, "11394": 804, "11581": 692, "12762": 811, "21083": 859, "10491": 721, "20061": 805, "20140": 925, "74003": 624, "60009": 786, "86359": 431, "84006": 412, "11671": 642, "13560": 594, "10510": 491, "60178": 715, "11594": 852, "11517": 837, "12139": 800, "20080": 835, "62001": 417, "60218": 577, "11344": 887, "20796": 840, "11096": 733, "13044": 571, "20826": 767, "13265": 789, "13038": 693, "10981": 273, "60150": 753, "68193": 568, "86114": 719, "11353": 786, "21478": 856, "86430": 388, "11782": 723, "12080": 730, "20625": 555, "60245": 428, "86341": 382, "64106": 728, "74066": 580, "86127": 571, "60263": 560, "20932": 859, "12600": 359, "10097": 728, "12846": 463, "20389": 889, "20630": 842, "10487": 806, "10811": 794, "76035": 203, "13131": 719, "86110": 770, "86037": 744, "11108": 655, "10119": 762, "70026": 860, "60123": 596, "84107": 730, "68086": 532, "10959": 466, "12770": 854, "10014": 825, "62027": 738, "64010": 518, "11962": 793, "64011": 758, "11751": 841, "72072": 472, "60104": 647, "21503": 719, "86365": 342, "12156": 753, "13307": 781, "66108": 669, "78051": 677, "86030": 816, "12693": 844, "12893": 788, "72041": 822, "82108": 389, "21085": 811, "20092": 735, "62026": 316, "12743": 454, "74071": 685, "12875": 767, "20267": 833, "86157": 537, "11148": 747, "21299": 871, "82135": 768, "12349": 669, "86027": 592, "12208": 400, "60344": 524, "86056": 447, "12810": 732, "11204": 768, "12944": 836, "20717": 876, "12534": 815, "10029": 570, "11260": 716, "12306": 597, "20591": 861, "10317": 416, "86527": 383, "11682": 738, "74058": 607, "86172": 477, "66111": 215, "64124": 821, "80148": 647, "11333": 853, "20714": 780, "12938": 733, "72055": 778, "68204": 674, "86260": 452, "60088": 776, "11867": 777, "12032": 833, "14867": 631, "11431": 796, "64034": 777, "11963": 820, "12512": 826, "60286": 523, "13543": 429, "12821": 770, "12102": 587, "12946": 607, "72038": 803, "13201": 776, "86155": 788, "86298": 423, "20203": 904, "11386": 809, "10590": 743, "64049": 801, "11951": 781, "86510": 447, "86310": 384, "10856": 770, "86251": 528, "60210": 605, "88063": 710, "80128": 715, "86300": 786, "86222": 573, "86411": 792, "10887": 762, "76021": 626, "12165": 579, "12293": 283, "10168": 789, "11810": 876, "13351": 760, "11597": 828, "66074": 381, "11400": 737, "10335": 370, "11685": 817, "10038": 846, "12454": 713, "11406": 826, "80120": 396, "12000": 763, "68169": 472, "86048": 325, "10569": 802, "12058": 489, "66022": 578, "11766": 817, "13523": 734, "11110": 778, "12960": 427, "13581": 745, "20534": 815, "86420": 461, "80103": 778, "10048": 636, "12207": 710, "88023": 840, "10263": 481, "68098": 791, "68053": 469, "86419": 544, "86506": 724, "13620": 784, "86472": 571, "70009": 791, "11734": 836, "11019": 783, "20869": 632, "10356": 817, "12327": 776, "21228": 851, "11308": 663, "86291": 373, "21303": 808, "78055": 718, "11806": 621, "10968": 585, "86046": 657, "86078": 533, "86288": 388, "13236": 797, "60054": 562, "64077": 465, "14835": 727, "20191": 686, "20323": 830, "12113": 826, "62044": 353, "11402": 830, "62064": 694, "64119": 744, "12048": 556, "10551": 625, "82155": 420, "10188": 749, "88136": 668, "80001": 630, "60311": 674, "10707": 691, "12251": 486, "10525": 754, "13277": 797, "20271": 729, "62002": 496, "10632": 825, "66005": 439, "10094": 578, "86118": 804, "12991": 834, "20812": 835, "10327": 432, "10657": 527, "21261": 800, "11994": 373, "11392": 771, "20704": 757, "60059": 816, "20984": 825, "70061": 824, "10145": 698, "72057": 707, "10288": 716, "12240": 437, "84008": 755, "21275": 861, "72059": 759, "82014": 802, "13232": 502, "10303": 628, "86335": 400, "10090": 495, "84031": 725, "14830": 512, "11337": 831, "60042": 785, "86416": 801, "60265": 621, "60331": 396, "10160": 791, "66102": 339, "70049": 708, "10773": 723, "80174": 598, "12911": 815, "82142": 394, "10573": 799, "11498": 866, "10320": 430, "12923": 768, "10411": 854, "62056": 474, "68103": 827, "64002": 757, "10231": 797, "68019": 723, "70051": 781, "12968": 719, "12294": 750, "10003": 691, "88030": 826, "10606": 734, "12804": 789, "86227": 776, "86540": 356, "62086": 761, "12233": 464, "64051": 396, "13242": 800, "12636": 804, "11010": 704, "84096": 752, "88100": 813, "60073": 787, "72054": 748, "21416": 654, "11939": 795, "11898": 734, "88141": 845, "20292": 846, "60168": 519, "11407": 793, "12367": 720, "66135": 760, "12632": 837, "68034": 437, "12017": 783, "86095": 442, "12984": 758, "10922": 406, "64007": 727, "13196": 627, "12237": 752, "13090": 836, "12045": 584, "12372": 392, "72027": 616, "60151": 420, "10640": 460, "62033": 319, "13360": 465, "70014": 743, "20727": 485, "20003": 854, "10561": 825, "88005": 793, "12388": 777, "10565": 769, "68005": 791, "78093": 598, "86001": 188, "21453": 763, "66033": 451, "13289": 794, "10660": 631, "13599": 766, "13286": 420, "76042": 346, "20901": 877, "72036": 714, "82158": 255, "12092": 498, "12007": 617, "11510": 823, "60340": 452, "20746": 833, "10066": 413, "10183": 707, "12275": 851, "80177": 484, "12791": 588, "10671": 726, "82112": 731, "13336": 444, "13387": 751, "10275": 759, "12807": 446, "60246": 454, "13470": 835, "12569": 513, "68017": 760, "13485": 699, "21263": 960, "10075": 531, "12414": 770, "80099": 464, "86545": 382, "20288": 804, "60038": 770, "84115": 820, "70074": 512, "12563": 506, "66028": 672, "10123": 823, "13468": 520, "11292": 464, "86509": 523, "10234": 662, "60077": 424, "11233": 672, "10190": 575, "68179": 435, "84104": 369, "13118": 367, "21294": 734, "10121": 740, "86091": 687, "78076": 343, "12385": 643, "70015": 718, "21258": 645, "60047": 747, "88040": 692, "20062": 909, "13013": 831, "11918": 632, "62007": 744, "10762": 694, "64059": 694, "20371": 807, "10797": 826, "20706": 822, "11350": 725, "88003": 868, "11879": 864, "68165": 668, "13224": 617, "86272": 718, "21571": 832, "11334": 804, "80032": 536, "80138": 654, "10221": 693, "13070": 674, "72029": 755, "20373": 598, "80100": 467, "78095": 718, "68057": 786, "20930": 618, "20319": 782, "82140": 366, "12969": 708, "10397": 738, "60099": 741, "86254": 472, "66136": 442, "13188": 756, "21233": 859, "86282": 519, "66038": 471, "11992": 667, "10775": 395, "86276": 642, "84077": 443, "72014": 875, "21464": 720, "12803": 747, "12586": 844, "11777": 683, "13409": 777, "60327": 468, "10500": 758, "21001": 730, "12101": 788, "10980": 525, "20070": 821, "10845": 767, "20544": 833, "88127": 819, "13261": 803, "78086": 489, "88185": 711, "14752": 843, "12303": 267, "13346": 429, "80024": 801, "86498": 364, "86418": 581, "13220": 553, "12825": 728, "10020": 536, "74094": 779, "84050": 781, "20502": 872, "84037": 532, "10656": 374, "11873": 815, "12127": 667, "13274": 785, "60057": 747, "13086": 836, "70023": 685, "64069": 501, "74005": 738, "11038": 763, "84035": 754, "74060": 832, "20507": 621, "13522": 784, "10742": 810, "13390": 400, "21604": 800, "80090": 365, "64104": 466, "76017": 676, "12589": 561, "20418": 848, "11201": 737, "84079": 558, "82024": 781, "60146": 456, "20467": 778, "20926": 914, "88068": 764, "11045": 777, "12330": 826, "86379": 533, "13713": 798, "68104": 811, "20791": 881, "88153": 836, "88113": 845, "21044": 798, "21117": 743, "12834": 447, "21151": 666, "82020": 464, "12931": 851, "10912": 453, "86022": 446, "70041": 747, "20002": 788, "10276": 702, "12253": 338, "11947": 780, "10468": 617, "11313": 821, "13301": 806, "68063": 449, "86057": 774, "10898": 534, "11972": 814, "86523": 442, "11310": 762, "86017": 507, "88114": 747, "10738": 845, "86427": 266, "88115": 817, "13081": 785, "12827": 716, "11390": 784, "12884": 803, "14863": 742, "13459": 755, "11913": 794, "12874": 553, "13529": 488, "12457": 770, "64113": 709, "12560": 720, "10502": 771, "84070": 583, "62045": 711, "12379": 804, "21353": 853, "13577": 450, "82062": 796, "11048": 688, "88091": 859, "76038": 378, "10365": 828, "20948": 896, "64063": 714, "20282": 884, "11306": 806, "70050": 735, "86316": 467, "68074": 471, "88134": 745, "13001": 884, "11891": 589, "62051": 705, "11676": 793, "66082": 669, "13571": 751, "10289": 673, "12160": 754, "13280": 813, "13140": 554, "10299": 666, "68060": 786, "12795": 752, "80176": 766, "12071": 795, "11896": 775, "86138": 485, "82120": 515, "13238": 844, "13027": 841, "11599": 841, "11131": 778, "74054": 620, "11980": 739, "74027": 720, "80055": 808, "60089": 739, "86332": 777, "11452": 870, "70078": 547, "13443": 751, "20342": 615, "88098": 865, "84026": 748, "88076": 895, "60177": 665, "11207": 793, "11931": 618, "80093": 736, "12845": 793, "10246": 699, "12674": 548, "82029": 443, "20193": 804, "84123": 603, "10022": 745, "20921": 910, "10256": 766, "60068": 648, "10453": 577, "12151": 732, "11482": 767, "11323": 783, "20528": 583, "86347": 484, "10438": 694, "21609": 846, "86387": 574, "76032": 610, "86135": 379, "20840": 698, "20453": 688, "68131": 758, "20369": 855, "12424": 860, "86532": 517, "84025": 722, "60232": 235, "72024": 584, "11008": 732, "11430": 738, "12120": 607, "12529": 798, "80169": 336, "74016": 423, "10369": 790, "10191": 497, "78017": 311, "86304": 357, "13557": 586, "60224": 436, "60252": 786, "13374": 753, "12192": 588, "20347": 876, "74041": 623, "62036": 690, "11516": 814, "11471": 713, "88011": 809, "84124": 516, "82093": 315, "11146": 798, "68167": 480, "74034": 456, "11976": 788, "12468": 808, "11077": 706, "68117": 745, "10403": 418, "12004": 685, "12051": 783, "10092": 801, "20927": 924, "12854": 579, "82089": 762, "86351": 774, "10602": 778, "10969": 531, "13555": 825, "62057": 439, "12332": 682, "11341": 744, "68130": 629, "11221": 798, "86143": 351, "12778": 902, "12059": 735, "10185": 755, "10199": 430, "11180": 843, "74089": 465, "11915": 744, "20756": 825, "20924": 925, "11165": 786, "12863": 756, "12870": 746, "12298": 491, "13487": 465, "12129": 733, "10083": 520, "82152": 509, "10245": 562, "10061": 744, "11276": 725, "20349": 885, "80011": 548, "12523": 549, "66036": 310, "20009": 900, "12245": 646, "74002": 581, "10625": 804, "88182": 833, "20361": 866, "86389": 767, "13089": 821, "80045": 776, "12619": 677, "12403": 469, "13410": 706, "88171": 595, "12033": 800, "60330": 525, "66041": 310, "10636": 805, "60012": 591, "13291": 749, "64090": 590, "20377": 784, "11489": 649, "13531": 429, "10523": 621, "64043": 472, "60261": 435, "10336": 624, "11216": 641, "68016": 701, "20320": 833, "20354": 821, "10131": 707, "20300": 833, "12236": 745, "86246": 356, "10424": 773, "68079": 696, "12580": 623, "12182": 730, "86140": 409, "10421": 659, "12081": 787, "66110": 362, "86120": 442, "86073": 529, "14815": 838, "88158": 773, "10354": 839, "12191": 361, "88154": 841, "84102": 716, "88125": 863, "11493": 764, "60039": 528, "10408": 715, "62038": 389, "20624": 819, "13490": 800, "12613": 755, "10687": 798, "10495": 732, "11955": 805, "78090": 560, "82123": 755, "74057": 567, "10064": 720, "74014": 718, "66002": 361, "11845": 832, "10963": 825, "20513": 832, "10112": 735, "20576": 782, "20851": 877, "90011": 791, "86198": 385, "12696": 842, "11483": 685, "12976": 430, "10126": 807, "13376": 771, "13269": 860, "88131": 802, "88173": 861, "12133": 811, "60045": 483, "60284": 837, "64024": 446, "10252": 808, "88172": 492, "11130": 703, "20447": 831, "11499": 815, "74017": 543, "12841": 717, "11889": 705, "21208": 741, "78036": 753, "84049": 820, "84122": 794, "86229": 800, "20570": 778, "10071": 583, "12292": 386, "11957": 579, "84018": 453, "11141": 702, "12254": 769, "11771": 777, "80062": 672, "10184": 741, "78075": 470, "86383": 746, "62029": 742, "20503": 890, "74028": 476, "68107": 727, "88099": 884, "11484": 705, "82113": 396, "84097": 494, "20190": 601, "80102": 495, "10427": 406, "20871": 887, "20338": 809, "11813": 875, "12417": 598, "21129": 844, "68042": 718, "12886": 737, "11709": 661, "60097": 405, "68029": 745, "74084": 675, "10771": 427, "13295": 796, "13330": 363, "78003": 892, "80164": 787, "10001": 832, "10814": 591, "68125": 525, "76015": 739, "68127": 431, "11943": 812, "68190": 826, "72011": 765, "11138": 722, "86029": 664, "60036": 546, "21436": 901, "12387": 755, "84084": 380, "20646": 834, "10037": 822, "21128": 811, "10721": 725, "86150": 547, "10641": 406, "60188": 645, "70013": 635, "10976": 595, "60282": 623, "10430": 638, "13552": 753, "70088": 643, "88110": 825, "11438": 837, "10063": 641, "88128": 788, "68162": 498, "86121": 473, "68048": 735, "72034": 594, "12378": 903, "78009": 729, "10824": 795, "84056": 517, "20460": 829, "11571": 601, "88028": 766, "82115": 450, "64082": 533, "80029": 638, "60230": 659, "82070": 327, "11021": 751, "10993": 739, "10857": 461, "80021": 538, "72052": 632, "72022": 850, "21232": 832, "20834": 760, "12736": 816, "76061": 420, "13393": 372, "11753": 737, "10033": 718, "13671": 857, "60025": 486, "72021": 851, "20648": 790, "86439": 634, "78058": 673, "64102": 767, "10285": 757, "10197": 724, "12355": 874, "11703": 801, "88006": 829, "13034": 766, "80063": 756, "10678": 811, "21027": 624, "74001": 651, "60061": 783, "11940": 704, "86378": 659, "82119": 396, "66010": 728, "12147": 740, "70039": 638, "20160": 856, "68055": 735, "21418": 850, "60202": 535, "76065": 590, "86081": 414, "10939": 764, "10448": 711, "78060": 671, "12012": 602, "12994": 767, "11784": 504, "64036": 568, "10329": 744, "10420": 664, "68056": 776, "13170": 811, "88074": 869, "20524": 768, "10541": 736, "20226": 777, "12688": 801, "21308": 736, "14877": 516, "13122": 718, "10247": 375, "14782": 557, "86002": 511, "86459": 470, "10141": 694, "12335": 892, "20897": 753, "11027": 618, "86294": 709, "11128": 686, "60082": 573, "12280": 577, "12918": 751, "12124": 745, "20835": 794, "13416": 592, "12881": 732, "20833": 722, "12869": 773, "14861": 467, "20000": 741, "12209": 760, "64039": 660, "10676": 793, "86403": 413, "72019": 854, "20448": 882, "12525": 493, "76049": 627, "13073": 817, "10812": 519, "11058": 732, "13187": 817, "20772": 701, "64008": 525, "10566": 718, "11591": 758, "10942": 748, "86194": 550, "68146": 744, "68080": 749, "10169": 767, "11086": 479, "20127": 951, "13530": 477, "10164": 492, "10019": 766, "68081": 526, "88109": 609, "10295": 717, "74038": 388, "10952": 774, "60117": 416, "20543": 672, "76039": 154, "12112": 754, "82079": 579, "86494": 392, "11960": 635, "12079": 827, "10918": 688, "60289": 608, "13303": 783, "12675": 648, "11372": 742, "60007": 640, "12538": 763, "82088": 369, "90038": 757, "60135": 504, "11433": 828, "20427": 758, "10011": 669, "76003": 505, "84004": 485, "20291": 802, "11998": 771, "12115": 805, "80172": 669, "10735": 812, "13586": 436, "12591": 584, "10433": 566, "12942": 645, "64118": 751, "64015": 555, "12885": 759, "11596": 803, "10778": 805, "20073": 718, "86268": 399, "90026": 559, "64048": 480, "60044": 772, "10542": 793, "13039": 655, "64016": 792, "13388": 771, "11863": 814, "70055": 718, "12348": 799, "84044": 709, "86370": 409, "84051": 359, "82038": 458, "12713": 542, "86547": 740, "13270": 796, "68126": 683, "68077": 538, "82139": 775, "20118": 572, "88168": 752, "12622": 716, "12171": 747, "64120": 430, "10627": 768, "12826": 781, "10588": 827, "76029": 414, "12945": 828, "84029": 331, "10924": 759, "13367": 728, "66123": 754, "11153": 459, "78098": 813, "10497": 650, "10699": 727, "13037": 567, "60294": 588, "10989": 541, "68136": 352, "10308": 752, "64091": 803, "11507": 380, "12070": 791, "62006": 774, "20409": 575, "20545": 732, "11011": 707, "10643": 742, "84081": 794, "21281": 627, "20200": 784, "11012": 750, "86330": 560, "88007": 724, "82087": 459, "12141": 619, "68031": 521, "20101": 697, "21476": 704, "80085": 442, "13467": 721, "12751": 640, "20149": 671, "12492": 551, "12777": 861, "10966": 588, "13198": 704, "82136": 428, "64125": 817, "20978": 820, "88014": 827, "20442": 800, "12088": 832, "60303": 383, "11807": 863, "20859": 790, "76060": 283, "11598": 581, "11257": 771, "12423": 867, "13808": 620, "76051": 367, "11687": 809, "13554": 410, "12993": 846, "11959": 772, "10209": 775, "12553": 746, "84080": 793, "86025": 782, "72050": 840, "62054": 748, "10204": 737, "10816": 831, "11995": 485, "60114": 582, "62021": 418, "60065": 423, "88067": 883, "80153": 538, "11740": 875, "88174": 860, "13018": 555, "12929": 789, "88020": 840, "12774": 893, "64088": 565, "11964": 782, "78068": 716, "20456": 700, "10498": 664, "12930": 782, "11802": 853, "12599": 530, "76064": 340, "13348": 755, "86331": 580, "60041": 493, "13033": 703, "86096": 622, "13026": 544, "80150": 672, "80023": 607, "68102": 531, "70093": 693, "66142": 560, "84014": 759, "72073": 501, "74092": 629, "21023": 811, "66051": 714, "78020": 760, "86274": 279, "10383": 616, "11781": 720, "12745": 836, "20018": 814};
let original_1b = {"20907": 910, "13144": 722, "20191": 776, "20484": 951, "88141": 826, "11853": 855, "70026": 825, "20062": 929, "20150": 816, "10311": 756, "20157": 920, "21078": 835, "10230": 788, "20543": 936, "21208": 871, "13434": 801, "10698": 743, "21239": 503, "84078": 847, "21593": 892, "20948": 895, "20160": 857, "20722": 872, "20267": 824, "14808": 799, "12928": 833, "11707": 825, "20759": 816, "21468": 830, "21023": 877, "10430": 791, "10746": 785, "13343": 797, "20080": 886, "13610": 817, "11547": 736, "84094": 760, "21571": 779, "13597": 699, "14770": 838, "21126": 899, "11244": 791, "10828": 795, "11377": 800, "21436": 840, "21431": 872, "21155": 861, "12247": 836, "14795": 815, "20058": 917, "20961": 845, "13082": 847, "11522": 825, "20814": 752, "12484": 795, "14799": 784, "20525": 924, "10548": 805, "12962": 672, "20266": 835, "20688": 841, "68133": 829, "11694": 806, "11009": 660, "13000": 805, "11082": 820, "20281": 767, "10027": 851, "12756": 743, "11849": 852, "11324": 666, "10700": 840, "14803": 808, "13391": 785, "10526": 850, "20395": 907, "20497": 816, "20627": 899, "20016": 865, "88167": 923, "88086": 822, "82128": 834, "12459": 879, "20958": 812, "88094": 930, "88186": 809, "20566": 810, "20544": 924, "88156": 829, "20229": 902, "12232": 715, "10103": 869, "14818": 823, "21060": 880, "11667": 693, "14819": 812, "20279": 859, "11438": 778, "13145": 756, "11723": 791, "11283": 829, "20334": 829, "21476": 892, "12913": 820, "11909": 779, "21191": 907, "10110": 743, "78038": 738, "20197": 891, "11763": 806, "20606": 850, "20261": 871, "10644": 840, "20214": 831, "20660": 828, "11816": 742, "20965": 876, "10134": 702, "13087": 780, "20577": 901, "10716": 730, "88029": 946, "10864": 832, "20516": 914, "10401": 892, "13229": 773, "11491": 833, "21492": 883, "88032": 902, "10721": 749, "11337": 795, "86227": 843, "20467": 916, "10438": 783, "82100": 849, "21102": 928, "21406": 790, "21105": 845, "11883": 748, "12617": 832, "20932": 940, "10176": 845, "88175": 823, "12856": 814, "20146": 875, "11482": 841, "20925": 938, "11507": 677, "11499": 755, "13663": 849, "12666": 774, "88043": 878, "20653": 767, "20510": 845, "21489": 828, "21611": 835, "20203": 958, "88165": 816, "80024": 754, "88106": 878, "20230": 914, "20889": 883, "88026": 802, "20018": 901, "10671": 722, "13439": 689, "20170": 872, "20490": 905, "21106": 875, "10262": 801, "11877": 834, "12143": 782, "10239": 737, "11441": 834, "21094": 894, "11868": 802, "20542": 875, "20945": 876, "14789": 815, "10770": 829, "21116": 790, "13255": 805, "20791": 880, "10059": 790, "10033": 793, "14805": 779, "12981": 896, "10699": 691, "20226": 803, "21495": 870, "11506": 721, "11742": 844, "11543": 743, "12126": 762, "12329": 844, "20082": 934, "20900": 780, "20070": 946, "72057": 810, "20389": 932, "14794": 824, "20519": 878, "11450": 824, "10736": 626, "10058": 831, "10725": 776, "13111": 816, "74062": 793, "12538": 841, "21364": 890, "88154": 846, "10499": 777, "10053": 817, "20216": 928, "20377": 814, "10583": 723, "88139": 898, "20912": 875, "21197": 874, "21451": 888, "20926": 949, "11388": 765, "10718": 794, "10156": 824, "12585": 800, "88067": 913, "12547": 802, "10381": 785, "66118": 811, "10049": 823, "88044": 744, "11838": 789, "12877": 728, "21371": 856, "20015": 827, "10077": 793, "11817": 751, "20245": 811, "88085": 801, "10757": 762, "20432": 742, "21350": 861, "12488": 763, "20066": 919, "13365": 754, "12083": 758, "20483": 912, "88100": 739, "12944": 746, "68019": 819, "20906": 852, "12659": 786, "20504": 916, "12351": 808, "10500": 777, "11469": 767, "10324": 906, "88170": 800, "20959": 886, "10391": 704, "11380": 732, "20817": 890, "11410": 752, "20849": 792, "11782": 696, "20202": 908, "20734": 821, "21131": 836, "64028": 782, "11703": 820, "12771": 664, "20801": 844, "11640": 780, "88176": 802, "11671": 664, "11471": 770, "12681": 814, "13475": 853, "14841": 858, "10470": 746, "20981": 830, "14869": 805, "11395": 785, "60084": 796, "11051": 824, "10836": 735, "20065": 902, "88091": 801, "12873": 738, "20061": 897, "11390": 644, "11542": 800, "11117": 784, "20496": 846, "20741": 851, "12266": 770, "12395": 863, "12133": 783, "10562": 758, "20149": 813, "10649": 776, "11751": 839, "20534": 912, "11280": 753, "11262": 825, "21299": 845, "20009": 882, "14831": 794, "20976": 868, "88069": 913, "13412": 836, "88066": 866, "11317": 720, "12451": 802, "12379": 856, "10165": 753, "74027": 738, "12567": 786, "21088": 857, "10999": 768, "10928": 733, "12773": 810, "88123": 817, "14873": 905, "11378": 768, "11972": 821, "21070": 861, "10031": 797, "10483": 863, "20662": 822, "20527": 828, "10558": 776, "10167": 813, "21138": 777, "21517": 838, "13177": 849, "12392": 841, "20099": 877, "20687": 818, "13601": 800, "12861": 782, "21228": 858, "20073": 897, "12184": 761, "10013": 748, "20590": 894, "84121": 759, "20503": 922, "90026": 750, "88099": 880, "76032": 789, "21308": 729, "20349": 902, "70001": 833, "10484": 767, "20179": 851, "20871": 932, "10793": 850, "11420": 744, "20813": 878, "20633": 799, "12346": 859, "86412": 783, "21233": 953, "88005": 883, "88031": 852, "12006": 834, "11959": 744, "12447": 735, "21616": 786, "12055": 799, "14816": 868, "20672": 786, "88080": 914, "10459": 836, "10962": 870, "20448": 816, "14871": 855, "20468": 901, "60063": 846, "10428": 694, "72062": 799, "20574": 780, "10295": 755, "10089": 864, "13516": 745, "10513": 764, "10672": 832, "13443": 775, "20012": 908, "88184": 849, "21322": 783, "11872": 865, "11932": 807, "13539": 759, "10568": 800, "11988": 799, "20201": 895, "11003": 805, "10491": 749, "13381": 739, "20127": 830, "11010": 776, "74005": 811, "11785": 853, "10250": 856, "80128": 744, "10207": 749, "20502": 904, "20282": 817, "82078": 774, "10521": 729, "12780": 846, "11532": 777, "68150": 712, "20295": 805, "14804": 823, "11890": 766, "20465": 910, "11879": 822, "12536": 703, "11436": 799, "14793": 866, "12507": 697, "13409": 779, "10849": 793, "11134": 711, "10095": 787, "20570": 934, "12890": 802, "88168": 737, "10683": 829, "20841": 833, "11155": 804, "13411": 839, "21335": 896, "11718": 850, "13459": 853, "13175": 825, "21181": 890, "10806": 781, "72067": 794, "12951": 832, "12793": 838, "10553": 863, "88082": 870, "86223": 733, "88045": 883, "20442": 788, "21040": 881, "10681": 795, "11792": 861, "88109": 905, "12734": 793, "13624": 809, "13206": 796, "10450": 893, "20105": 782, "10658": 860, "11254": 812, "11495": 737, "11478": 754, "21494": 787, "64020": 780, "12631": 758, "88122": 835, "13252": 785, "21235": 861, "10408": 810, "20006": 910, "20499": 947, "60104": 709, "21263": 843, "10062": 723, "11893": 812, "20868": 866, "20838": 872, "10137": 795, "10622": 814, "20887": 913, "11104": 697, "10434": 857, "10900": 805, "88088": 923, "13093": 781, "13374": 741, "13246": 780, "20918": 815, "88025": 848, "88105": 824, "20199": 935, "12677": 797, "12128": 761, "12080": 836, "20966": 889, "20227": 820, "11233": 783, "20869": 795, "10217": 791, "14820": 736, "20361": 824, "21030": 856, "66121": 771, "13595": 847, "20180": 870, "11319": 743, "14874": 803, "11869": 814, "10182": 808, "12023": 894, "20804": 865, "20624": 865, "21440": 940, "11364": 729, "10707": 781, "11400": 716, "11921": 816, "10417": 742, "20286": 871, "12305": 784, "11330": 806, "10952": 876, "21261": 812, "86351": 810, "13309": 847, "10102": 836, "10938": 821, "10608": 838, "12049": 773, "20674": 820, "14875": 896, "10399": 831, "20942": 826, "76063": 766, "88010": 831, "20335": 782, "21245": 838, "11541": 857, "10256": 782, "11030": 841, "10688": 703, "14775": 781, "10561": 758, "11827": 818, "20920": 885, "11263": 745, "21504": 859, "21066": 827, "12775": 872, "12938": 705, "10696": 842, "21250": 836, "11175": 782, "20038": 836, "12217": 817, "20100": 913, "20406": 849, "12685": 822, "11712": 808, "21055": 901, "10634": 756, "11303": 840, "90052": 859, "14792": 792, "11674": 733, "21338": 956, "14752": 817, "20041": 826, "12408": 764, "80052": 753, "20967": 891, "11839": 784, "12117": 788, "12381": 793, "88087": 781, "88133": 819, "12714": 817, "10564": 757, "11533": 742, "10139": 734, "13376": 788, "11708": 804, "10291": 824, "12990": 918, "10116": 759, "13611": 841, "21289": 876, "10918": 818, "21298": 895, "20471": 837, "12810": 765, "11276": 799, "10717": 784, "12361": 830, "14798": 790, "20449": 792, "11257": 694, "78041": 820, "10704": 792, "11006": 725, "10883": 804, "90006": 768, "21600": 913, "20429": 845, "20318": 900, "21273": 817, "20924": 926, "20067": 856, "11523": 697, "20347": 801, "13202": 775, "12340": 766, "21523": 633, "20363": 817, "12316": 799, "20513": 911, "20517": 947, "20675": 866, "12895": 835, "10117": 853, "10073": 857, "20140": 835, "20625": 872, "13301": 800, "13104": 788, "10833": 836, "20842": 815, "20466": 890, "11297": 805, "60096": 809, "12818": 835, "14848": 794, "20382": 875, "20083": 913, "12977": 786, "10948": 795, "11433": 803, "12619": 699, "10148": 832, "20128": 862, "10990": 775, "14757": 763, "11329": 775, "12007": 733, "13129": 882, "88006": 885, "20789": 810, "11427": 835, "60305": 774, "21460": 890, "20452": 831, "88150": 817, "10382": 810, "14817": 838, "12132": 728, "20848": 854, "20646": 881, "88130": 799, "10925": 732, "21303": 837, "21324": 874, "20549": 940, "12837": 808, "21275": 850, "13520": 798, "11919": 773, "13513": 794, "66043": 789, "20927": 842, "10060": 813, "11307": 843, "20541": 898, "10991": 795, "86433": 723, "10629": 802, "11138": 722, "20984": 835, "13449": 780, "21074": 838, "10308": 749, "11078": 764, "11982": 798, "13283": 868, "20693": 760, "21224": 865, "88051": 803, "82022": 721, "20576": 917, "20464": 953, "12979": 785, "13222": 736, "90011": 770, "10939": 850, "21163": 806, "20144": 781, "10639": 758, "11501": 798, "20524": 887, "20756": 879, "20956": 865, "11349": 770, "20846": 828, "10283": 811, "10588": 795, "11954": 835, "20255": 843, "14833": 765, "20069": 904, "13541": 808, "90009": 757, "12548": 790, "10585": 786, "12738": 796, "11779": 775, "88104": 872, "21578": 899, "10778": 823, "86410": 816, "10616": 815, "12425": 760, "11505": 756, "13787": 833, "12079": 750, "10206": 816, "12511": 774, "20200": 934, "11935": 806, "12524": 763, "10468": 740, "12282": 792, "72071": 800, "20726": 893, "11945": 783, "88090": 850, "80086": 786, "88157": 856, "20164": 865, "74085": 710, "13555": 820, "21355": 861, "10844": 715, "88181": 861, "20710": 861, "11574": 757, "13385": 743, "13580": 818, "20014": 854, "21165": 776, "21028": 838, "12980": 839, "11062": 837, "20681": 859, "21256": 865, "12475": 838, "10596": 835, "88160": 848, "21120": 882, "21410": 813, "11092": 732, "21512": 880, "20701": 861, "14800": 865, "20658": 907, "88101": 837, "20923": 833, "12259": 816, "11540": 735, "21337": 802, "14753": 780, "20171": 897, "14783": 825, "12432": 798, "21304": 867, "68077": 745, "10170": 803, "20928": 917, "21128": 833, "10398": 884, "21564": 826, "20447": 787, "88035": 792, "20463": 898, "11677": 701, "10005": 818, "20657": 923, "20250": 841, "10235": 886, "20370": 770, "20571": 891, "12429": 729, "10594": 779, "12276": 845, "12455": 761, "10305": 857, "20138": 912, "20647": 858, "10271": 758, "20908": 876, "11486": 719, "14802": 830, "14786": 837, "13066": 757, "20039": 772, "10125": 739, "13607": 829, "88012": 886, "20094": 811, "20937": 920, "12982": 760, "11580": 715, "11393": 766, "64016": 761, "13375": 807, "10225": 768, "10160": 729, "11741": 658, "21297": 877, "13445": 767, "20550": 932, "88036": 837, "10819": 820, "14797": 833, "10174": 764, "20921": 935, "21551": 888, "20001": 807, "12602": 827, "20736": 825, "10626": 779, "21540": 755, "13550": 804, "20707": 857, "10714": 809, "13453": 766, "20104": 824, "10446": 718, "12031": 760, "12012": 725, "13205": 757, "72055": 820, "20151": 823, "11546": 712, "14774": 770, "20845": 903, "20506": 818, "10093": 772, "21339": 780, "12399": 825, "90017": 674, "12013": 733, "20743": 852, "11133": 799, "11830": 821, "11984": 735, "20512": 862, "70015": 696, "10635": 829, "11089": 767, "20481": 724, "84027": 831, "11204": 793, "14790": 796, "20628": 934, "10088": 758, "20507": 950, "21418": 813, "20717": 784, "20773": 893, "20559": 864, "14791": 847, "12965": 844, "88079": 807, "64095": 730, "64102": 812, "21546": 896, "20248": 781, "20861": 731, "20671": 809, "12465": 836, "20469": 807, "12622": 677, "11453": 738, "20386": 838, "11318": 771, "11180": 811, "88162": 876, "12623": 868, "10169": 817, "14732": 762, "12042": 821, "20911": 806, "20638": 727, "10618": 764, "88084": 854, "13352": 736, "10155": 819, "70056": 800, "11367": 795, "10065": 792, "20277": 752, "21130": 828, "70037": 773, "11824": 751, "21290": 839, "20445": 845, "88039": 859, "10131": 742, "10052": 794, "11061": 820, "20045": 784, "14842": 800, "11028": 794, "20640": 941, "12331": 841, "20123": 789, "12574": 777, "64118": 782, "14796": 754, "20247": 793, "86065": 759, "11406": 666};
