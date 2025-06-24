let map;
let markerCluster = L.markerClusterGroup();
let navButtons = L.featureGroup();
window.allKmlFeatures = [];

document.addEventListener('DOMContentLoaded', () => {
  map = L.map('map', {
    zoomControl: false
  }).setView([23.6, 120.9], 8);

  const baseLayers = {
    'Google 街道圖': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps'
    }),
    'Google 衛星圖': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps'
    }),
    'Google 地形圖': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps'
    }),
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap 貢獻者'
    })
  };

  baseLayers['Google 街道圖'].addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  markerCluster.addTo(map);
  navButtons.addTo(map);

  document.querySelectorAll('input[type="search"], input[type="text"]').forEach(input => {
    input.addEventListener('focus', () => {
      setTimeout(() => {
        if (map && map.invalidateSize) map.invalidateSize();
      }, 300);
    });
    input.addEventListener('input', () => {
      setTimeout(() => {
        if (map && map.invalidateSize) map.invalidateSize();
      }, 300);
    });
  });

  window.addEventListener('resize', () => {
    if (map && map.invalidateSize) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  });

  map.on('click', () => {
    const searchResults = document.getElementById('searchResults');
    const searchContainer = document.getElementById('searchContainer');
    if (searchResults) {
      searchResults.style.display = 'none';
      if (searchContainer) searchContainer.classList.remove('search-active');
    }
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.value = '';
    }
    navButtons.clearLayers();
  });
});

function waitForMapVisibleAndReady(callback) {
  const mapElement = document.getElementById('map');
  if (!mapElement) return;
  const checkReady = () => {
    if (mapElement.offsetHeight < 100 || mapElement.offsetWidth < 100) {
      requestAnimationFrame(checkReady);
    } else {
      setTimeout(callback, 100);
    }
  };
  requestAnimationFrame(checkReady);
}

window.loadKmlLayerFromFirestore = function(kmlId) {
  waitForMapVisibleAndReady(() => {
    internalLoadKmlLayer(kmlId);
  });
};

async function internalLoadKmlLayer(kmlId) {
  if (!kmlId) {
    console.log("未提供 KML ID，不載入。");
    window.clearAllKmlLayers();
    return;
  }
  setTimeout(() => {
    if (map && map._loaded) {
      map.invalidateSize();
      map.setZoom(map.getZoom());
    }
  }, 50);
  window.clearAllKmlLayers();
  try {
    const docRef = db
      .collection('artifacts').doc(appId)
      .collection('public').doc('data')
      .collection('kmlLayers').doc(kmlId);
    const kmlDoc = await docRef.get();

    if (!kmlDoc.exists) {
      console.error(`KML 圖層 ${kmlId} 不存在`);
      return;
    }

    const featuresRef = docRef.collection('features');
    const querySnapshot = await featuresRef.get();

    const loadedFeatures = [];
    querySnapshot.forEach(doc => {
      const feature = doc.data();
      if (feature.geometry && feature.properties) {
        loadedFeatures.push(feature);
      }
    });

    window.allKmlFeatures = loadedFeatures;
    window.addMarkers(loadedFeatures);

  } catch (err) {
    console.error(`無法載入 KML Features：`, err);
  }
}

window.addMarkers = function(features) {
  markerCluster.clearLayers();
  if (!features || !features.length) return;

  features.forEach(f => {
    const coords = f.geometry?.coordinates;
    const name = f.properties?.name || '未命名';
    if (!coords) return;
    if (f.geometry.type === 'Point') {
      const [lng, lat] = coords;
      const dot = L.marker([lat, lng], {
        icon: L.divIcon({ className: 'custom-dot-icon', iconSize: [18, 18], iconAnchor: [9, 9] })
      });
      const label = L.marker([lat, lng + 0.00015], {
        icon: L.divIcon({
          className: 'marker-label', html: `<span>${name}</span>`, iconSize: [null, null], iconAnchor: [0, 0]
        }),
        interactive: false
      });
      dot.on('click', () => window.createNavButton([lat, lng], name));
      markerCluster.addLayer(dot);
      markerCluster.addLayer(label);
    }
  });

  setTimeout(() => {
    if (map && markerCluster.getBounds().isValid()) {
      map.fitBounds(markerCluster.getBounds());
    }
  }, 300);
};

window.createNavButton = function(latlng, name) {
  navButtons.clearLayers();
  const url = `https://www.google.com/maps/search/?api=1&query=${latlng[0]},${latlng[1]}`;
  const html = `<div class="nav-button-content" onclick="window.open('${url}', '_blank'); event.stopPropagation();">
    <img src="https://i0.wp.com/canadasafetycouncil.org/wp-content/uploads/2018/08/offroad.png" alt="導航" />
  </div>`;
  const icon = L.divIcon({
    className: 'nav-button-icon', html: html, iconSize: [50, 50], iconAnchor: [25, 25]
  });
  L.marker(latlng, { icon }).addTo(navButtons);
};

window.clearAllKmlLayers = function() {
  markerCluster.clearLayers();
  navButtons.clearLayers();
  window.allKmlFeatures = [];
};
