// map-logic.js（整合記憶 KML 圖層功能 + 圖釘按鈕 + 高亮藍字 + v1.3 完整功能）

let map;
let markers = L.featureGroup();
let navButtons = L.featureGroup();

// 用於記憶所有地圖上 KML Point Features 的數據，供搜尋使用
window.allKmlFeatures = [];
let currentKmlId = null; // 當前載入的 KML ID

// 記住目前載入的圖層
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

  // 地圖空白區點擊時，清除藍字高亮與導航
  map.on('click', () => {
    document.querySelectorAll('.marker-label span.label-active').forEach(el => el.classList.remove('label-active'));
    navButtons.clearLayers();
  });

  // ? 若有記憶圖層，載入 KML（必須先定義函式）
  const lastKmlId = localStorage.getItem('lastKmlId');
  if (lastKmlId) {
    console.log(`正在還原上次開啟的 KML 圖層：${lastKmlId}`);
    currentKmlId = lastKmlId;
    window.loadKmlLayerFromFirestore(lastKmlId);
  }
});
