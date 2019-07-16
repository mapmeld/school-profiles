var map;

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

      let markerBlock = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAGElEQVQoU2NkSGH4z0AEYBxViC+UqB88ABKCDemh9/nQAAAAAElFTkSuQmCC';
      let schools = lines.map(school => {
        school = school.split(',');
        let lat = school[1] * 1 || 0,
            lng = school[0] * 1 || 0,
            id = school[2],
            name = school[3],
            marker = null;
            // also remove accents, spaces, quotes
        if (lat && lng) {
          marker = new google.maps.Marker({
            map: map,
            position: new google.maps.LatLng(lat, lng),
            clickable: false,
            icon: {
              url: markerBlock,
              size: new google.maps.Size(7, 7)
            }
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
            new google.maps.Marker({
              position: marker.getPosition(),
              map: map,
              clickable: false
            });
            marker.setMap(null);
          } else {
            alert('This school was not geocoded!');
          }
        }
      });
    });
}
