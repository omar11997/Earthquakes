///////////////// Map Creation ///////////////
const map = new ol.Map({
  target: "map",
  view: new ol.View({
    center: ol.proj.transform(
      [31.231255160736538, 30.045877615975883],
      "EPSG:4326",
      "EPSG:3857"
    ),
    zoom: 2,
  }),
  layers: [],
  controls: ol.control.defaults.defaults({
    attribution: false,
  }),
});
window.MAP = map;

// ///////////// Map Modes //////////////////

const osm = new ol.layer.Tile({
  source: new ol.source.OSM(),
  visible: false,
  layerName: "OSM",
});
map.addLayer(osm);

const stadiamap = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png",
  }),
  visible: true,
  layerName: "Stadia",
});
map.addLayer(stadiamap);
const basemapsGroup = new ol.layer.Group({
  layers: [osm, stadiamap],
});

////////////////// Switcher Button Hnadling //////////////////////////

const switchers = document.querySelectorAll("input[name='switcher']");
switchers.forEach((switcher) => {
  switcher.addEventListener("change", (e) => {
    const name = e.target.id;
    basemapsGroup.getLayers().forEach((layer) => {
      if (layer.get("layerName") === name) {
        layer.setVisible(true);
      } else {
        layer.setVisible(false);
      }
    });
  });
});

////////////////// Clustering ///////////////////////////////////////////////////

let feats;
fetch(
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2023-02-04&endtime=2023-02-07"
)
  .then((response) => response.json())
  .then((data) => {
    // console.log(data);
    feats = createFeatures(data.features);

    // console.log(feats);
    let clusterSource = new ol.source.Cluster({
      distance: 50,
      minDistance: 10,
      source: new ol.source.Vector({
        features: feats,
      }),
    });
    const vectorLayer = new ol.layer.Vector({
      source: clusterSource,
      style: (clster) => {
        // console.log(clster);
        let gha = clster.get("features");
        let rad;
        let counter = 0;
        gha.forEach((gh) => {
          rad = gh.values_.EqkPower;
          counter += 1;
          // console.log(rad);
          if (rad < 0) {
            rad = 0;
          }
        });
        let col;
        if (rad > 4.5) {
          col = "#eb0505";
        } else if (3.0 < rad < 4.5) {
          col = "#0244b5";
        }
        if (rad < 3.0) {
          col = "#02b54a";
        }

        return new ol.style.Style({
          image: new ol.style.Circle({
            fill: new ol.style.Fill({ color: col }),
            stroke: new ol.style.Stroke({ color: col }),
            radius: rad * 4,
          }),
          text: new ol.style.Text({
            text: "" + counter,
            fill: new ol.style.Fill({
              color: "#fff",
            }),
          }),
        });
      },
    });

    map.addLayer(vectorLayer);

    // Define your popup overlay
    var popup = new ol.Overlay({
      element: document.getElementById("popup"),
      autoPan: true,
      autoPanAnimation: {
        duration: 250,
      },
    });
    map.addOverlay(popup);

    // Define the popup closer button
    var popupCloser = document.getElementById("popup-closer");
    popupCloser.addEventListener("click", function () {
      popup.setPosition(undefined);
      popupCloser.blur();
      return false;
    });
    let avg;
    let place;
    // Define the map click event
    map.on("click", function (event) {
      var feature = map.forEachFeatureAtPixel(event.pixel, function (feature) {
        let sum = 0;
        let count = 0;

        var earthquakepower = feature.get("features");
        console.log(earthquakepower);
        earthquakepower.forEach((e) => {
          var properties = e.values_.EqkPower;
          place = e.values_.place;
          console.log(place);
          sum += properties;
          count += 1;
        });
        avg = sum / count;
        console.log(avg);
        // console.log(feature.values_.features[0].values_.EqkPower);
        return avg;
      });
      if (feature) {
        // Get the feature properties to display in the popup
        // Create the popup content
        document.getElementById("popup").style.display = "block";
        var content = "<h2>" + "Earthquakepower" + "</h2>";
        content += "<p>" + "Mag(Avg.) = " + avg.toFixed(2) + "</p>";
        content += "<p>" + "Place: " + place + "</p>";

        // Set the popup content and position
        document.getElementById("popup-content").innerHTML = content;
        popup.setPosition(event.coordinate);
        flage = false;
      } else {
        // Hide the popup if no feature was clicked
        // popup.setPosition(undefined);
        document.getElementById("popup").style.display = "none";
      }
    });
  });

function createFeatures(features) {
  let featContainer = []; //? empty array to store the result
  features.forEach((feature) => {
    //? loopign for each feature
    let lon = feature.geometry.coordinates[0];
    let lat = feature.geometry.coordinates[1];
    let EqkPower = feature.properties.mag;
    let place = feature.properties.place;
    // console.log(feature);
    // console.log(place);
    // console.log(lon, lat, EqkPower);
    let feature2 = new ol.Feature({
      geometry: new ol.geom.Point( //!' P (capital)' :)
        ol.proj.transform([lon, lat], "EPSG:4326", "EPSG:3857")
      ),
      EqkPower,
      place,
    });
    featContainer.push(feature2);
  });
  return featContainer;
}

//*   GeoCoding   *//////////////////////////////////////////////////////////////

const searchbar = document.querySelector("#geocode");
const searchList = document.querySelector("#placeOption");
let timeRef;

searchbar.addEventListener("input", (e) => {
  let typed = e.target.value;
  clearTimeout(timeRef);

  timeRef = setTimeout(() => {
    let dataPromise = getData(typed);
    // console.log(dataPromise);
    dataPromise.then((data) => {
      // console.log("DDD", data);

      searchList.innerHTML = " ";

      data.features.forEach((f) => {
        let name = f.properties.display_name;
        let li = document.createElement("li");

        li.innerHTML = name;
        li.id = f.properties.osm_id;
        li.addEventListener("click", (e) =>
          searchClickHandler(e, data.features)
        );

        searchList.append(li);
      });
    });
  }, 900);
});

function getData(searchParam) {
  return fetch(
    `https://nominatim.openstreetmap.org/search?q=${searchParam}&format=geojson`
  )
    .then((res) => res.json())
    .then((data) => {
      return data;
    });
}

function searchClickHandler(e, features) {
  let id = e.target.id;
  // console.log(features[0].properties.osm_id, id);
  let feature = features.find((f) => f.properties.osm_id == id);
  let coords = ol.proj.transform(
    feature.geometry.coordinates,
    "EPSG:4326",
    "EPSG:3857"
  );
  map.getView().animate({ zoom: 8 }, { center: coords });
}
