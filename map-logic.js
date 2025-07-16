// map-logic.js�]��X�O�� KML �ϼh�\�� + �ϰv���s + ���G�Ŧr + v1.3 ����\�� + �w�챱��^

let map;
let markers = L.featureGroup();
let navButtons = L.featureGroup();

window.allKmlFeatures = [];
let currentKmlId = null;

window.pinCurrentKmlLayer = function () {
  if (currentKmlId) {
    localStorage.setItem('lastKmlId', currentKmlId);
    window.showMessageCustom({
      title: '�w�v��',
      message: '�w�O��ثe���ϼh�C',
      autoClose: true
    });
  } else {
    window.showMessageCustom({
      title: '����ܹϼh',
      message: '�Х���ܤ@�ӹϼh�A�v��C'
    });
  }
};

document.addEventListener('DOMContentLoaded', () => {
  map = L.map('map', {
    attributionControl: true,
    zoomControl: false,
    maxZoom: 25,
    minZoom: 5
  }).setView([23.6, 120.9], 8);

  const baseLayers = {
    'Google ��D��': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps', maxZoom: 25, maxNativeZoom: 20
    }),
    'Google �ìP��': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps', maxZoom: 25, maxNativeZoom: 20
    }),
    'Google �a�ι�': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps', maxZoom: 25, maxNativeZoom: 20
    }),
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 25, maxNativeZoom: 20
    })
  };

  const lastLayerName = localStorage.getItem('lastBaseLayer');
  if (lastLayerName && baseLayers[lastLayerName]) {
    baseLayers[lastLayerName].addTo(map);
    console.log(`�w�٭�W���ϥΪ��ϼh�G${lastLayerName}`);
  } else {
    baseLayers['Google ��D��'].addTo(map);
    localStorage.removeItem('lastBaseLayer');
    console.warn(`�䤣��O�йϼh "${lastLayerName}"�A�w�M���O���C`);
  }

  L.control.zoom({ position: 'topright' }).addTo(map);
  const layerControl = L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

  map.on('baselayerchange', (e) => {
    localStorage.setItem('lastBaseLayer', e.name);
    const controlContainer = layerControl.getContainer();
    if (controlContainer && controlContainer.classList.contains('leaflet-control-layers-expanded')) {
      controlContainer.classList.remove('leaflet-control-layers-expanded');
    }
  });

  markers.addTo(map);
  navButtons.addTo(map);

  // ? �[�^�w�챱��
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
      map.locate({ setView: true, maxZoom: 16, enableHighAccuracy: true, watch: false });
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
        color: '#1a73e8', fillColor: '#1a73e8', fillOpacity: 0.15, weight: 2
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
      window.showMessageCustom({
        title: '�w�쥢��',
        message: `�L�k����z����m: ${e.message}`,
        autoClose: true
      });
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
  new LocateMeControl({ position: 'topright' }).addTo(map);

  window.showMessageCustom = function({ title = '', message = '', buttonText = '�T�w', autoClose = false, autoCloseDelay = 3000, onClose = null }) {
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

  map.on('click', () => {
    document.querySelectorAll('.marker-label span.label-active').forEach(el => el.classList.remove('label-active'));
    navButtons.clearLayers();
  });

  const lastKmlId = localStorage.getItem('lastKmlId');
  if (lastKmlId) {
    console.log(`���b�٭�W���}�Ҫ� KML �ϼh�G${lastKmlId}`);
    currentKmlId = lastKmlId;
    window.loadKmlLayerFromFirestore(lastKmlId);
  }
});
