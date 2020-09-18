let leafletMap;
let attribution;
let satIcon = L.icon({
  iconUrl: "img/sat_icon.png",
  iconSize: [40, 40],
});
let tleDate;
let tleTime;
let tles = [];
let lastUpdate;

initializeMap()
  .then(parseTles)
  .then(getPositions)
  .then(getFeatures)
  .then(drawMarkers)
  .then(updateFeatures);

function convertTime(tleDateString) {
  let d = tleDateString.split(" ");
  let formattedDateString =
    d[1] + " " + d[2] + " " + d[0] + " " + d[3] + " GMT+00";
  let time = Date.parse(formattedDateString);
  return time;
}

async function parseTles() {
  const file = await fetch("tles.txt");
  const tlesRaw = await file.text();
  const tlesArray = tlesRaw.replace(/\r?\n$/g, "").split(/\r?\n/); // make array

  tleTime = convertTime(tlesArray[0]); // date of tle @ index 0
  tleDate = new Date(tleTime);
  tlesArray.shift();

  return tlesArray.reduce((result, currentEntry, index) => {
    if (index % 3 === 0) result.push([]);
    result[result.length - 1].push(currentEntry);
    return result; // restructured (multidimens) array
  }, tles);
}

async function getPositions(parsedTLEs) {
  let currentDate = new Date();
  return parsedTLEs.reduce((result, currentEntry) => {
    let satrec = satellite.twoline2satrec(currentEntry[1], currentEntry[2]);
    let positionAndVelocity = satellite.propagate(satrec, currentDate);
    let positionGd = satellite.eciToGeodetic(
      positionAndVelocity.position,
      satellite.gstime(currentDate)
    );
    result.push([currentEntry[0].trim(), positionGd]);
    return result;
  }, []);
}

async function getFeatures(satellites) {
  return satellites.reduce((result, currentEntry) => {
    result.push({
      type: "Feature",
      properties: {
        name: currentEntry[0],
        height: currentEntry[1].height,
      },
      geometry: {
        type: "Point",
        coordinates: [
          satellite.degreesLong(currentEntry[1].longitude),
          satellite.degreesLat(currentEntry[1].latitude),
        ],
      },
    });
    return result;
  }, []);
}

async function updateFeatures(markers) {
  let currentDate = Date.now();
  if (lastUpdate === undefined || currentDate - lastUpdate > 1000) {
    lastUpdate = currentDate;
  } else {
    window.requestAnimationFrame(() => {
      updateFeatures(markers);
    });
    return;
  }
  lastUpdate = currentDate;

  const newPositions = await getPositions(tles);
  markers.forEach((marker, i) => {
    marker.setLatLng([
      satellite.degreesLong(newPositions[i][1].latitude),
      satellite.degreesLong(newPositions[i][1].longitude),
    ]);
    marker.feature.properties.height = newPositions[i][1].height;
    marker.feature.geometry.coordinates = [
      satellite.degreesLong(newPositions[i][1].longitude),
      satellite.degreesLat(newPositions[i][1].latitude),
    ];
  });

  window.requestAnimationFrame(() => {
    updateFeatures(markers);
  });
}

async function initializeMap() {
  leafletMap = await L.map(document.getElementById("map"), {
    zoom: 6,
    center: [52, 10],
    worldCopyJump: false,
    attributionControl: false,
    layers: [L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png")],
  });
  attribution = await L.control
    .attribution({
      position: "topright",
      prefix: "",
    })
    .addTo(leafletMap);
  L.control
    .locate({
      drawCircle: true,
      keepCurrentZoomLevel: true,
    })
    .addTo(leafletMap);
  return;
}

async function drawMarkers(features) {
  let markers = [];
  attribution.setPrefix(
    ' <a href="https://www.celestrak.com/NORAD/elements/supplemental/" target="_blank">TLE</a>: ' +
      tleDate.toLocaleTimeString() +
      " |" +
      ' <a href="privacy.html">Datenschutz</a> |' +
      ' <a href="https://leafletjs.com">Leaflet</a> |' +
      ' <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  );
  L.geoJSON(features, {
    pointToLayer: function (feature, latlng) {
      let marker = L.marker(latlng, { icon: satIcon }).bindPopup(
        feature.properties.name +
          " (" +
          feature.properties.height.toFixed(2) +
          " km)"
      );
      markers.push(marker);
      return marker;
    },
    onEachFeature: function (feature, layer) {
      layer.on({
        click: function () {
          // do manually cause auto open seems buggy on a few markers
          layer.openPopup();
        },
        move: function () {
          if (layer.getPopup().isOpen()) {
            layer
              .getPopup()
              .setContent(
                feature.properties.name +
                  " (" +
                  feature.properties.height.toFixed(2) +
                  " km)"
              );
          }
        },
      });
    },
  }).addTo(leafletMap);
  return markers;
}
