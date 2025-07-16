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
            attribution: 'c <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 25,
            maxNativeZoom: 20
        })
    };

    // ���ձq localStorage ���o�W����ܪ��ϼh�W��
       const lastLayerName = localStorage.getItem('lastBaseLayer');
       
       if (lastLayerName && baseLayers[lastLayerName]) {
         baseLayers[lastLayerName].addTo(map);
         console.log(`�w�٭�W���ϥΪ��ϼh�G${lastLayerName}`);
       } else {
         localStorage.removeItem('lastBaseLayer');
         console.warn(`�䤣��O�йϼh "${lastLayerName}"�A�w�M���O���C`);
       
         // ? �w�]���J Google ��D��
         baseLayers['Google ��D��'].addTo(map);
       }

    // �N�Y�񱱨�K�[��a�Ϫ��k�W��
    L.control.zoom({ position: 'topright' }).addTo(map);

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
    

    // �N�۩w�q�w�챱��K�[��a�Ϫ��k�W��
    new LocateMeControl({ position: 'topright' }).addTo(map);

    // �N�򥻹ϼh����K�[��a�Ϫ��k�W��
    const layerControl = L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);

    // ��ť�򥻹ϼh�ܧ�ƥ�A�æb�ܧ��۰����ùϼh����O
    map.on('baselayerchange', function (e) {
        console.log("�򥻹ϼh�w�ܧ�:", e.name);
        localStorage.setItem('lastBaseLayer', e.name);
        const controlContainer = layerControl.getContainer();
        if (controlContainer && controlContainer.classList.contains('leaflet-control-layers-expanded')) {
            // ���� 'leaflet-control-layers-expanded' ���O�Ӧ��_����O
            controlContainer.classList.remove('leaflet-control-layers-expanded');
            console.log("�ϼh����O�w�۰ʦ��_�C");
        }
    });

    // �N markers �M navButtons �K�[��a��
    markers.addTo(map);
    navButtons.addTo(map);

    // ������ơG�K�[�аO��a�� (�{�b�䴩 Point, LineString, Polygon)
    window.addMarkers = function(featuresToDisplay) {
        markers.clearLayers(); // �M���{���аO

        if (!featuresToDisplay || featuresToDisplay.length === 0) {
            console.log("�S�� features �i��ܡC");
            window.showMessage('���Jĵ��', 'KML �ϼh���J���������o�{���Ħa�Ϥ����C');
            return;
        }
        console.log(`���b�N ${featuresToDisplay.length} �� features �K�[��a�ϡC`);
        featuresToDisplay.forEach(f => {
            const name = f.properties.name || '���R�W';
            const coordinates = f.geometry.coordinates;
            let layer;

            if (!coordinates) {
                console.warn(`���L�ʤ֮y�Ъ� feature: ${name} (����: ${f.geometry.type || '����'})`);
                return;
            }

            if (f.geometry.type === 'Point') {
              const [lon, lat] = coordinates;
              const latlng = L.latLng(lat, lon);
              const labelLatLng = latlng;
            
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
            
              const label = L.marker(labelLatLng, {
               icon: L.divIcon({
                 className: 'marker-label',
                 html: `<span id="${labelId}">${name}</span>`,
                 iconSize: [null, null],
                 iconAnchor: [0, 0]
               }),
               interactive: false,
               zIndexOffset: 1000
             });            
             
              dot.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
            
                // �M���Ҧ����G��r
                document.querySelectorAll('.marker-label span.label-active').forEach(el => {
                  el.classList.remove('label-active');
                });
                document.getElementById(labelId)?.classList.add('label-active');
            
                // �M�ΰ��G���e label
                const target = document.getElementById(labelId);
                if (target) {
                  target.classList.add('label-active');
                }
            
                // ��ܾɯ���s
                window.createNavButton(latlng, name);
              });
            
              markers.addLayer(dot);
              markers.addLayer(label);
              console.log(`�K�[ Point: ${name} (Lat: ${latlng.lat}, Lng: ${latlng.lng})`);

            } else if (f.geometry.type === 'LineString') {
                // �N [lon, lat] �}�C�ഫ�� L.LatLng �}�C�H�Ω� LineString
                const latlngs = coordinates.map(coord => L.latLng(coord[1], coord[0]));
                layer = L.polyline(latlngs, {
                    color: '#1a73e8', // �Ŧ�
                    weight: 4,
                    opacity: 0.7
                });
                layer.bindPopup(`<b>${name}</b>`); // ���u�K�[�u�X������ܦW��
                markers.addLayer(layer);
                console.log(`�K�[ LineString: ${name} (${coordinates.length} �I)`);

            } else if (f.geometry.type === 'Polygon') {
                // ��� Polygon�A�y�ЬO [ [[lon,lat],[lon,lat],...]] �Ω�~��
                // �åB�i��]�t�����CL.polygon ����@�� LatLng �}�C���}�C�C
                const latlngs = coordinates[0].map(coord => L.latLng(coord[1], coord[0]));
                layer = L.polygon(latlngs, {
                    color: '#1a73e8', // �Ŧ����
                    fillColor: '#6dd5ed', // �L�Ŧ��R
                    fillOpacity: 0.3,
                    weight: 2
                });
                layer.bindPopup(`<b>${name}</b>`); // ���h��βK�[�u�X������ܦW��
                markers.addLayer(layer);
                console.log(`�K�[ Polygon: ${name} (${coordinates[0].length} �I)`);

            } else {
                console.warn(`���L���䴩���X������: ${f.geometry.type} (�W��: ${name})`);
            }
        });

        // �վ�a�ϵ����H�]�t�Ҧ��K�[���аO�M�X��ϧ�
        if (markers.getLayers().length > 0 && markers.getBounds().isValid()) {
            map.fitBounds(markers.getBounds());
            console.log("�a�ϵ��Ϥw�վ�H�]�t�Ҧ����J���a�z�n���C");
        } else if (featuresToDisplay.length > 0) {
            // �p�G�� features ���S���@�ӳQ�K�[��a�� (�Ҧp�A�Ҧ����O���䴩������)
            console.warn("KML features �w���J�A���a�ϤW�S���i��ܪ��X�������C���ˬd����x��x�H����ԲӸ�T�C");
        }
    };

    // ������ơG�q Firestore ���J KML �ϼh (�O�d�쪩 logic�A�Ȭ��F�� auth-kml-management.js ���)
    // ��ڪ� KML features �B�z�|�z�L window.addMarkers ����
    window.loadKmlLayerFromFirestore = async function(kmlId) {
        if (!kmlId) {
            console.log("������ KML ID�A�����J�C");
            window.clearAllKmlLayers();
            return;
        }

        // �����{�� KML �ϼh�M�Ҧ��аO (�]�A�ɯ���s)
        window.clearAllKmlLayers();

        try {
            // �q Firestore ��� KML ��󪺤��ƾ�
            const doc = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(kmlId).get();
            if (!doc.exists) {
                console.error('KML �ϼh���ɥ���� ID:', kmlId);
                showMessage('���~', '�䤣����w�� KML �ϼh��ơC');
                return;
            }
            const kmlData = doc.data();

            console.log(`���b���J KML Features�A�ϼh�W��: ${kmlData.name || kmlId}`);

            // �q kmlLayers/{kmlId}/features �l���X������Ҧ� GeoJSON features
            const featuresSubCollectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(kmlId).collection('features');
            const querySnapshot = await featuresSubCollectionRef.get();

            const loadedFeatures = [];
            if (querySnapshot.empty) {
                console.log(`KML �ϼh "${kmlData.name}" �� features �l���X���šC`);
            } else {
                querySnapshot.forEach(featureDoc => {
                    const feature = featureDoc.data();
                    // �T�O feature �]�t geometry �M properties
                    if (feature.geometry && feature.geometry.coordinates && feature.properties) {
                        loadedFeatures.push(feature);
                    } else {
                        console.warn('���b���L�Ӧ� Firestore ���L�� feature:', feature);
                    }
                });
            }

            window.allKmlFeatures = loadedFeatures; // ��s�����j�M�ƾ�
            window.addMarkers(window.allKmlFeatures); // �N�Ҧ��a�z�n���K�[��a��

            // �p�G���a�z�n���A�]�w�a�ϵ����H�]�t�Ҧ��n��
            if (window.allKmlFeatures.length > 0 && markers.getLayers().length > 0 && markers.getBounds().isValid()) {
                 map.fitBounds(markers.getBounds());
            } else {
                 console.warn("�a�z�n���s�b�A������ɹ��a�ϵ��Ϥ��A�ΡA�Φa�ϤW�S���ϼh�i�A�X�C");
            }
            
            // *** �s�W�G�b���\���J KML �h��A�N�� ID �s�x���u�v��v�h ***
            localStorage.setItem('pinnedKmlLayerId', kmlId);
            console.log(`KML �ϼh ${kmlId} �w�Q�v��C`);

        } catch (error) {
            console.error("��� KML Features �θ��J KML �ɥX��:", error);
            // ���F���U�ոաA�o�̥i�H��ܧ�ԲӪ����~�T���A�Ҧp�w���W�h���������~
            showMessage('���~', `�L�k���J KML �ϼh: ${error.message}�C�нT�{ Firebase �w���W�h�w���T�]�w�A���\Ū�� /artifacts/{appId}/public/data/kmlLayers�C`);
        }
    };

    // ������ơG�M���Ҧ� KML �ϼh�B�аO�M�ɯ���s
    window.clearAllKmlLayers = function() {
        markers.clearLayers();
        navButtons.clearLayers();
        window.allKmlFeatures = [];
        console.log("�Ҧ� KML �ϼh�B�аO�M�ɯ���s�w�M���C");
        // *** �s�W�G��Ҧ��ϼh�Q�M���ɡA�]�M���v�諸 KML ID ***
        localStorage.removeItem('pinnedKmlLayerId');
        console.log("�v�諸 KML �ϼh�w�����v��C");
    };

    // ������ơG�Ыؾɯ���s
    window.createNavButton = function(latlng, name) {
        navButtons.clearLayers();

        // �ϥγq�Ϊ� Google Maps �d�� URL�A�{�N����|�۰��ѧO�ô��Ѷ}�Ҧa�����Ϊ��ﶵ�C
        const googleMapsUrl = `http://maps.google.com/maps?q=${latlng.lat},${latlng.lng}`;


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

    // *** �s�W�G�b��l�Ʈ��ˬd�O�_���v�諸 KML �ϼh�ø��J�� ***
    const pinnedKmlId = localStorage.getItem('pinnedKmlLayerId');
    if (pinnedKmlId) {
        console.log(`������v�諸 KML �ϼh ID�G${pinnedKmlId}�A���b�۰ʸ��J�C`);
        window.loadKmlLayerFromFirestore(pinnedKmlId);
    } else {
        console.log("�S���v�諸 KML �ϼh�C");
    }
});