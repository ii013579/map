// map-logic.js（整合記憶 KML 圖層功能 + 圖釘按鈕 + 高亮藍字 + v1.3 完整功能 + 定位控制）

let map;
let markers = L.featureGroup();
let navButtons = L.featureGroup();

window.allKmlFeatures = [];
let currentKmlId = null;

window.pinCurrentKmlLayer = function () {
  if (currentKmlId) {
    localStorage.setItem('lastKmlId', currentKmlId);
    window.showMessageCustom({
      title: '已釘選',
      message: '已記住目前的圖層。',
      autoClose: true
    });
  } else {
    window.showMessageCustom({
      title: '未選擇圖層',
      message: '請先選擇一個圖層再釘選。'
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
    'Google 街道圖': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps', maxZoom: 25, maxNativeZoom: 20
    }),
    'Google 衛星圖': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps', maxZoom: 25, maxNativeZoom: 20
    }),
    'Google 地形圖': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
      attribution: 'Google Maps', maxZoom: 25, maxNativeZoom: 20
    }),
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 25, maxNativeZoom: 20
    })
  };

  const lastLayerName = localStorage.getItem('lastBaseLayer');
  if (lastLayerName && baseLayers[lastLayerName]) {
    baseLayers[lastLayerName].addTo(map);
    console.log(`已還原上次使用的圖層：${lastLayerName}`);
  } else {
    baseLayers['Google 街道圖'].addTo(map);
    localStorage.removeItem('lastBaseLayer');
    console.warn(`找不到記憶圖層 "${lastLayerName}"，已清除記錄。`);
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

  // ? 加回定位控制
  const LocateMeControl = L.Control.extend({
    _userLocationMarker: null,
    _userLocationCircle: null,
    onAdd: function(map) {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-locate-me');
      const button = L.DomUtil.create('a', '', container);
      button.href = "#";
      button.title = "顯示我的位置";
      button.setAttribute("role", "button");
      button.setAttribute("aria-label", "顯示我的位置");
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
        title: '定位中',
        message: '正在獲取您的位置...',
        buttonText: '取消',
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
        title: '定位成功',
        message: `您的位置已定位，誤差約 ${radius.toFixed(0)} 公尺。`,
        buttonText: '確定',
        autoClose: true,
        autoCloseDelay: 3000
      });
    },
    _onLocationError: function(e) {
      this._clearLocationMarkers();
      window.showMessageCustom({
        title: '定位失敗',
        message: `無法獲取您的位置: ${e.message}`,
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

  window.showMessageCustom = function({ title = '', message = '', buttonText = '確定', autoClose = false, autoCloseDelay = 3000, onClose = null }) {
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
    console.log(`正在還原上次開啟的 KML 圖層：${lastKmlId}`);
    currentKmlId = lastKmlId;
    window.loadKmlLayerFromFirestore(lastKmlId);
  }
});
