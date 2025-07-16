// map-logic.js

let map;
let markers = L.featureGroup(); // �Ω��x�s�Ҧ��аO�H�K�޲z
let navButtons = L.featureGroup(); // �Ω��x�s�ɯ���s

// �s�W�@�ӥ����ܼơA�Ω��x�s�Ҧ��a�ϤW KML Point Features ���ƾڡA�ѷj�M�ϥ�
window.allKmlFeatures = [];

document.addEventListener('DOMContentLoaded', () => {
    // ��l�Ʀa��
    map = L.map('map', {
      attributionControl: true,
      zoomControl: false,
      maxZoom: 25,
      minZoom: 5
    }).setView([23.6, 120.9], 8);

    // �w�q�򥻹ϼh
    const baseLayers = {
        'Google ��D��': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20
        }),
        'Google �ìP��': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20

        }),
        'Google �a�ι�': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20
        }),
        'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 25,
            maxNativeZoom: 20
        })
    };

      // �q localStorage ���J�O�йϼh�]�Y���^�A�_�h���J�w�]
      const lastLayerName = localStorage.getItem('lastBaseLayer');
      if (lastLayerName && baseLayers[lastLayerName]) {
        baseLayers[lastLayerName].addTo(map);
        console.log(`�w�٭�W���ϥΪ��ϼh�G${lastLayerName}`);
      } else {
        baseLayers['Google ��D��'].addTo(map);
        console.log('�w���J�w�]���ϡGGoogle ��D��');
      }
     
      // �۩w�q�w�챱�
      const LocateMeControl = L.Control.extend({
          _userLocationMarker: null,
          _userLocationCircle: null,
  
          onAdd: function(map) {
              const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-locate-me');
              const button = L.DomUtil.create('a', '', container);
              button.href = "#";
              button.title = "��ܧڪ���m";
              button.setAttribute("role", "button");
              button.setAttribute("aria-label", "��ܧڪ���m");
              button.innerHTML = `<span class="material-symbols-outlined" style="font-size: 24px; line-height: 30px;">my_location</span>`;
  
              L.DomEvent.on(button, 'click', this._locateUser, this);
  
              // ���a�z�w�즨�\/���Ѩƥ�K�[��ť��
              map.on('locationfound', this._onLocationFound, this);
              map.on('locationerror', this._onLocationError, this);
  
              return container;
          },
  
          onRemove: function(map) {
              map.off('locationfound', this._onLocationFound, this);
              map.off('locationerror', this._onLocationError, this);
              this._clearLocationMarkers();
          },
  
          _locateUser: function(e) {
              L.DomEvent.stopPropagation(e);
              L.DomEvent.preventDefault(e);
  
              this._clearLocationMarkers();
  
              // �}�l�w��Τ��m
              map.locate({
                  setView: true,
                  maxZoom: 16,
                  enableHighAccuracy: true,
                  watch: false
              });
              window.showMessageCustom({
                  title: '�w�줤',
                  message: '���b����z����m...',
                  buttonText: '����',
                  autoClose: false
                });
              },
  
          _onLocationFound: function(e) {
              this._clearLocationMarkers();
  
              const radius = e.accuracy / 2;
  
              this._userLocationMarker = L.marker(e.latlng, {
                  icon: L.divIcon({
                      className: 'user-location-dot',
                      iconSize: [16, 16],
                      iconAnchor: [8, 8]
                  })
              }).addTo(map);
  
              this._userLocationCircle = L.circle(e.latlng, radius, {
                  color: '#1a73e8',
                  fillColor: '#1a73e8',
                  fillOpacity: 0.15,
                  weight: 2
              }).addTo(map);
  
              window.showMessageCustom({
                  title: '�w�즨�\',
                  message: `�z����m�w�w��A�~�t�� ${radius.toFixed(0)} ���ءC`,
                  buttonText: '�T�w',
                  autoClose: true,
                  autoCloseDelay: 3000
                });
              },
  
          _onLocationError: function(e) {
              this._clearLocationMarkers();
              window.showMessage('�w�쥢��', `�L�k����z����m: ${e.message}`);
              console.error('Geolocation error:', e.message);
          },
  
          _clearLocationMarkers: function() {
              if (this._userLocationMarker) {
                  map.removeLayer(this._userLocationMarker);
                  this._userLocationMarker = null;
              }
              if (this._userLocationCircle) {
                  map.removeLayer(this._userLocationCircle);
                  this._userLocationCircle = null;
              }
          }
      });
      
      window.showMessageCustom = function({
        title = '',
        message = '',
        buttonText = '�T�w',
        autoClose = false,
        autoCloseDelay = 3000,
        onClose = null
      }) {
        const overlay = document.querySelector('.message-box-overlay');
        const content = overlay.querySelector('.message-box-content');
        const header = content.querySelector('h3');
        const paragraph = content.querySelector('p');
        const button = content.querySelector('button');
      
        header.textContent = title;
        paragraph.textContent = message;
        button.textContent = buttonText;
        overlay.classList.add('visible');
      
        // �����ª� onclick
        button.onclick = () => {
          overlay.classList.remove('visible');
          if (typeof onClose === 'function') onClose();
        };
      
        if (autoClose) {
          setTimeout(() => {
            overlay.classList.remove('visible');
            if (typeof onClose === 'function') onClose();
          }, autoCloseDelay);
        }
      };
      
  
    // �a�ϱ��
    L.control.zoom({ position: 'topright' }).addTo(map);
    const layerControl = L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
  
    map.on('baselayerchange', function (e) {
      console.log("�򥻹ϼh�w�ܧ�:", e.name);
      localStorage.setItem('lastBaseLayer', e.name);
  
      const controlContainer = layerControl.getContainer();
      if (controlContainer && controlContainer.classList.contains('leaflet-control-layers-expanded')) {
        controlContainer.classList.remove('leaflet-control-layers-expanded');
        console.log("�ϼh����O�w�۰ʦ��_�C");
      }
    });
  
    markers.addTo(map);
    navButtons.addTo(map);
  
    // �q localStorage ���J�O�йϼh�]�Y���^�A�_�h���J�w�]
    const lastLayerName = localStorage.getItem('lastBaseLayer');
    if (lastLayerName && baseLayers[lastLayerName]) {
      baseLayers[lastLayerName].addTo(map);
      console.log(`�w�٭�W���ϥΪ��ϼh�G${lastLayerName}`);
    } else {
      baseLayers['Google ��D��'].addTo(map);
      console.log('�w���J�w�]���ϡGGoogle ��D��');
    }
  
    // �a�ϱ��
    L.control.zoom({ position: 'topright' }).addTo(map);
    const layerControl = L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
  
    map.on('baselayerchange', function (e) {
      console.log("�򥻹ϼh�w�ܧ�:", e.name);
      localStorage.setItem('lastBaseLayer', e.name);
  
      const controlContainer = layerControl.getContainer();
      if (controlContainer && controlContainer.classList.contains('leaflet-control-layers-expanded')) {
        controlContainer.classList.remove('leaflet-control-layers-expanded');
        console.log("�ϼh����O�w�۰ʦ��_�C");
      }
    });
  
    markers.addTo(map);
    navButtons.addTo(map);
  
    // ? �٭�O�Ъ� KML �ϼh
    const lastKmlId = localStorage.getItem('lastKmlId');
    if (lastKmlId && typeof window.loadKmlLayerFromFirestore === 'function') {
      console.log(`���b�٭�W���}�Ҫ� KML �ϼh�G${lastKmlId}`);
      window.loadKmlLayerFromFirestore(lastKmlId);
    }
  
    // ? �ۭq��ܰT���ء]�䴩�����P�۰������^
    window.showMessageCustom = function({
      title = '',
      message = '',
      buttonText = '�T�w',
      autoClose = false,
      autoCloseDelay = 3000,
      onClose = null
    }) {
      const overlay = document.querySelector('.message-box-overlay');
      const content = overlay.querySelector('.message-box-content');
      const header = content.querySelector('h3');
      const paragraph = content.querySelector('p');
      const button = content.querySelector('button');
  
      header.textContent = title;
      paragraph.textContent = message;
      button.textContent = buttonText;
      overlay.classList.add('visible');
  
      button.onclick = () => {
        overlay.classList.remove('visible');
        if (typeof onClose === 'function') onClose();
      };
  
      if (autoClose) {
        setTimeout(() => {
          overlay.classList.remove('visible');
          if (typeof onClose === 'function') onClose();
        }, autoCloseDelay);
      }
    };
  
    // ? ���J KML �ϼh�禡�]�q��l�����ɦ^�^
    window.loadKmlLayerFromFirestore = async function(kmlId) {
      if (!kmlId) {
        console.log("������ KML ID�A�����J�C");
        window.clearAllKmlLayers();
        return;
      }
      window.clearAllKmlLayers();
      try {
        const doc = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(kmlId).get();
        if (!doc.exists) {
          console.error('KML �ϼh���ɥ���� ID:', kmlId);
          showMessage('���~', '�䤣����w�� KML �ϼh��ơC');
          localStorage.removeItem('lastKmlId');
          return;
        }
        const kmlData = doc.data();
        const featuresSubCollectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(kmlId).collection('features');
        const querySnapshot = await featuresSubCollectionRef.get();
        const loadedFeatures = [];
        if (!querySnapshot.empty) {
          querySnapshot.forEach(featureDoc => {
            const feature = featureDoc.data();
            if (feature.geometry && feature.geometry.coordinates && feature.properties) {
              loadedFeatures.push(feature);
            }
          });
        }
        window.allKmlFeatures = loadedFeatures;
        window.addMarkers(window.allKmlFeatures);
        if (window.allKmlFeatures.length > 0 && markers.getLayers().length > 0 && markers.getBounds().isValid()) {
          map.fitBounds(markers.getBounds());
        }
      } catch (error) {
        console.error("��� KML Features �θ��J KML �ɥX��:", error);
        showMessage('���~', `�L�k���J KML �ϼh: ${error.message}`);
      }
    };
  
    // ? �[�J�M���P��V�禡
    window.clearAllKmlLayers = function() {
      markers.clearLayers();
      navButtons.clearLayers();
      window.allKmlFeatures = [];
    };
  
    // ? �[�J�M���P��V�禡
    window.clearAllKmlLayers = function() {
      markers.clearLayers();
      navButtons.clearLayers();
      window.allKmlFeatures = [];
    };
  
    window.addMarkers = function(featuresToDisplay) {
      markers.clearLayers();
      if (!featuresToDisplay || featuresToDisplay.length === 0) return;
      featuresToDisplay.forEach(f => {
        const name = f.properties.name || '���R�W';
        const coordinates = f.geometry.coordinates;
        if (f.geometry.type === 'Point') {
          const [lon, lat] = coordinates;
          const latlng = L.latLng(lat, lon);
          const labelId = `label-${lat}-${lon}`.replace(/\./g, '_');
          const dotIcon = L.divIcon({
            className: 'custom-dot-icon',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });
          const dot = L.marker(latlng, {
            icon: dotIcon,
            interactive: true
          });
          const label = L.marker(latlng, {
            icon: L.divIcon({
              className: 'marker-label',
              html: `<span id="${labelId}">${name}</span>`
            }),
            interactive: false,
            zIndexOffset: 1000
          });
          dot.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            document.querySelectorAll('.marker-label span.label-active').forEach(el => el.classList.remove('label-active'));
            document.getElementById(labelId)?.classList.add('label-active');
            window.createNavButton(latlng, name);
          });
          markers.addLayer(dot);
          markers.addLayer(label);
        } else if (f.geometry.type === 'LineString') {
          const latlngs = coordinates.map(coord => L.latLng(coord[1], coord[0]));
          const line = L.polyline(latlngs, { color: '#1a73e8', weight: 4, opacity: 0.7 });
          line.bindPopup(`<b>${name}</b>`);
          markers.addLayer(line);
        } else if (f.geometry.type === 'Polygon') {
          const latlngs = coordinates[0].map(coord => L.latLng(coord[1], coord[0]));
          const polygon = L.polygon(latlngs, {
            color: '#1a73e8', fillColor: '#6dd5ed', fillOpacity: 0.3, weight: 2
          });
          polygon.bindPopup(`<b>${name}</b>`);
          markers.addLayer(polygon);
        }
      });
      if (markers.getLayers().length > 0 && markers.getBounds().isValid()) {
        map.fitBounds(markers.getBounds());
      }
    };
  });
  
    // ������ơG�Ыؾɯ���s
    window.createNavButton = function(latlng, name) {
        navButtons.clearLayers();

        // �ϥγq�Ϊ� Google Maps �d�� URL�A�{�N����|�۰��ѧO�ô��Ѷ}�Ҧa�����Ϊ��ﶵ�C
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latlng.lat},${latlng.lng}`;


        const buttonHtml = `
            <div class="nav-button-content" onclick="window.open('${googleMapsUrl}', '_blank'); event.stopPropagation();">
                <img src="https://i0.wp.com/canadasafetycouncil.org/wp-content/uploads/2018/08/offroad.png" alt="�ɯ�" />
            </div>
        `;
        const buttonIcon = L.divIcon({
            className: 'nav-button-icon',
            html: buttonHtml,
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });

        const navMarker = L.marker(latlng, {
            icon: buttonIcon,
            zIndexOffset: 1000,
            interactive: true
        }).addTo(navButtons);

        console.log(`�w�� ${name} �b ${latlng.lat}, ${latlng.lng} �Ыؾɯ���s�C`);
    };

    // �B�z�a���I���ƥ�A���÷j�M���G�M�ɯ���s�P�������Ұ��G
    map.on('click', () => {
      const searchResults = document.getElementById('searchResults');
      const searchContainer = document.getElementById('searchContainer');
      if (searchResults) {
        searchResults.style.display = 'none';
        searchContainer.classList.remove('search-active');
      }
      const searchBox = document.getElementById('searchBox');
      if (searchBox) {
        searchBox.value = '';
      }
    
      // �����Ҧ��ŦⰪ�G����
      document.querySelectorAll('.marker-label span.label-active').forEach(el => {
        el.classList.remove('label-active');
      });
    
      // �M���ɯ���s
      navButtons.clearLayers();
    });
});
