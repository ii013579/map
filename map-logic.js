// map-logic.js

let map;
let markers = L.featureGroup(); // 用於儲存所有標記以便管理
let navButtons = L.featureGroup(); // 用於儲存導航按鈕

// 新增一個全局變數，用於儲存所有地圖上 KML Point Features 的數據，供搜尋使用
window.allKmlFeatures = [];

document.addEventListener('DOMContentLoaded', () => {
    // 初始化地圖
    map = L.map('map', {
      attributionControl: true,
      zoomControl: false,
      maxZoom: 25,
      minZoom: 5
    }).setView([23.6, 120.9], 8);

    // 定義基本圖層
    const baseLayers = {
        'Google 街道圖': L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20
        }),
        'Google 衛星圖': L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
            attribution: 'Google Maps',
            maxZoom: 25,
            maxNativeZoom: 20

        }),
        'Google 地形圖': L.tileLayer('https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
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

      // 從 localStorage 載入記憶圖層（若有），否則載入預設
      const lastLayerName = localStorage.getItem('lastBaseLayer');
      if (lastLayerName && baseLayers[lastLayerName]) {
        baseLayers[lastLayerName].addTo(map);
        console.log(`已還原上次使用的圖層：${lastLayerName}`);
      } else {
        baseLayers['Google 街道圖'].addTo(map);
        console.log('已載入預設底圖：Google 街道圖');
      }
     
      // 自定義定位控制項
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
  
              // 為地理定位成功/失敗事件添加監聽器
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
  
              // 開始定位用戶位置
              map.locate({
                  setView: true,
                  maxZoom: 16,
                  enableHighAccuracy: true,
                  watch: false
              });
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
                  color: '#1a73e8',
                  fillColor: '#1a73e8',
                  fillOpacity: 0.15,
                  weight: 2
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
              window.showMessage('定位失敗', `無法獲取您的位置: ${e.message}`);
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
        buttonText = '確定',
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
      
        // 移除舊的 onclick
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
      
  
    // 地圖控制項
    L.control.zoom({ position: 'topright' }).addTo(map);
    const layerControl = L.control.layers(baseLayers, null, { position: 'topright' }).addTo(map);
  
    map.on('baselayerchange', function (e) {
      console.log("基本圖層已變更:", e.name);
      localStorage.setItem('lastBaseLayer', e.name);
  
      const controlContainer = layerControl.getContainer();
      if (controlContainer && controlContainer.classList.contains('leaflet-control-layers-expanded')) {
        controlContainer.classList.remove('leaflet-control-layers-expanded');
        console.log("圖層控制面板已自動收起。");
      }
    });
  
    markers.addTo(map);
    navButtons.addTo(map);
  
    // ? 還原記憶的 KML 圖層
    const lastKmlId = localStorage.getItem('lastKmlId');
    if (lastKmlId && typeof window.loadKmlLayerFromFirestore === 'function') {
      console.log(`正在還原上次開啟的 KML 圖層：${lastKmlId}`);
      window.loadKmlLayerFromFirestore(lastKmlId);
    }
    
        // 調整地圖視角以包含所有添加的標記和幾何圖形
        if (markers.getLayers().length > 0 && markers.getBounds().isValid()) {
            map.fitBounds(markers.getBounds());
            console.log("地圖視圖已調整以包含所有載入的地理要素。");
        } else if (featuresToDisplay.length > 0) {
            // 如果有 features 但沒有一個被添加到地圖 (例如，所有都是不支援的類型)
            console.warn("KML features 已載入，但地圖上沒有可顯示的幾何類型。請檢查控制台日誌以獲取詳細資訊。");
        }
    };

    // 全局函數：從 Firestore 載入 KML 圖層 (保留原版 logic，僅為了讓 auth-kml-management.js 找到)
    // 實際的 KML features 處理會透過 window.addMarkers 完成
    window.loadKmlLayerFromFirestore = async function(kmlId) {
        if (!kmlId) {
            console.log("未提供 KML ID，不載入。");
            window.clearAllKmlLayers();
            return;
        }

        // 移除現有 KML 圖層和所有標記 (包括導航按鈕)
        window.clearAllKmlLayers();

        try {
            // 從 Firestore 獲取 KML 文件的元數據
            const doc = await db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(kmlId).get();
            if (!doc.exists) {
                console.error('KML 圖層文檔未找到 ID:', kmlId);
                showMessage('錯誤', '找不到指定的 KML 圖層資料。');
                return;
            }
            const kmlData = doc.data();

            console.log(`正在載入 KML Features，圖層名稱: ${kmlData.name || kmlId}`);

            // 從 kmlLayers/{kmlId}/features 子集合中獲取所有 GeoJSON features
            const featuresSubCollectionRef = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('kmlLayers').doc(kmlId).collection('features');
            const querySnapshot = await featuresSubCollectionRef.get();

            const loadedFeatures = [];
            if (querySnapshot.empty) {
                console.log(`KML 圖層 "${kmlData.name}" 的 features 子集合為空。`);
            } else {
                querySnapshot.forEach(featureDoc => {
                    const feature = featureDoc.data();
                    // 確保 feature 包含 geometry 和 properties
                    if (feature.geometry && feature.geometry.coordinates && feature.properties) {
                        loadedFeatures.push(feature);
                    } else {
                        console.warn('正在跳過來自 Firestore 的無效 feature:', feature);
                    }
                });
            }

            window.allKmlFeatures = loadedFeatures; // 更新全局搜尋數據
            window.addMarkers(window.allKmlFeatures); // 將所有地理要素添加到地圖

            // 如果有地理要素，設定地圖視角以包含所有要素
            if (window.allKmlFeatures.length > 0 && markers.getLayers().length > 0 && markers.getBounds().isValid()) {
                 map.fitBounds(markers.getBounds());
            } else {
                 console.warn("地理要素存在，但其邊界對於地圖視圖不適用，或地圖上沒有圖層可適合。");
            }

        } catch (error) {
            console.error("獲取 KML Features 或載入 KML 時出錯:", error);
            // 為了幫助調試，這裡可以顯示更詳細的錯誤訊息，例如安全規則相關的錯誤
            showMessage('錯誤', `無法載入 KML 圖層: ${error.message}。請確認 Firebase 安全規則已正確設定，允許讀取 /artifacts/{appId}/public/data/kmlLayers。`);
        }
    };

    // 全局函數：清除所有 KML 圖層、標記和導航按鈕
    window.clearAllKmlLayers = function() {
        markers.clearLayers();
        navButtons.clearLayers();
        window.allKmlFeatures = [];
        console.log("所有 KML 圖層、標記和導航按鈕已清除。");
    };

    // 全局函數：創建導航按鈕
    window.createNavButton = function(latlng, name) {
        navButtons.clearLayers();

        // 使用通用的 Google Maps 查詢 URL，現代手機會自動識別並提供開啟地圖應用的選項。
        const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${latlng.lat},${latlng.lng}`;


        const buttonHtml = `
            <div class="nav-button-content" onclick="window.open('${googleMapsUrl}', '_blank'); event.stopPropagation();">
                <img src="https://i0.wp.com/canadasafetycouncil.org/wp-content/uploads/2018/08/offroad.png" alt="導航" />
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

        console.log(`已為 ${name} 在 ${latlng.lat}, ${latlng.lng} 創建導航按鈕。`);
    };

    // 處理地圖點擊事件，隱藏搜尋結果和導航按鈕與取消標籤高亮
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
    
      // 取消所有藍色高亮標籤
      document.querySelectorAll('.marker-label span.label-active').forEach(el => {
        el.classList.remove('label-active');
      });
    
      // 清除導航按鈕
      navButtons.clearLayers();
    });
});
