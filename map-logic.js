// map-logic.js�]��X�O�� KML �ϼh�\�� + �ϰv���s + ���G�Ŧr + v1.3 ����\��^

let map;
let markers = L.featureGroup();
let navButtons = L.featureGroup();

// �Ω�O�ЩҦ��a�ϤW KML Point Features ���ƾڡA�ѷj�M�ϥ�
window.allKmlFeatures = [];
let currentKmlId = null; // ��e���J�� KML ID

// �O��ثe���J���ϼh
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

  // �a�Ϫťհ��I���ɡA�M���Ŧr���G�P�ɯ�
  map.on('click', () => {
    document.querySelectorAll('.marker-label span.label-active').forEach(el => el.classList.remove('label-active'));
    navButtons.clearLayers();
  });

  // ? �Y���O�йϼh�A���J KML�]�������w�q�禡�^
  const lastKmlId = localStorage.getItem('lastKmlId');
  if (lastKmlId) {
    console.log(`���b�٭�W���}�Ҫ� KML �ϼh�G${lastKmlId}`);
    currentKmlId = lastKmlId;
    window.loadKmlLayerFromFirestore(lastKmlId);
  }
});
