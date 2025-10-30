// ui-interactions.js

document.addEventListener('DOMContentLoaded', () => {
    const editButton = document.getElementById('editButton');
    const authSection = document.getElementById('authSection');
    const controls = document.getElementById('controls');
    const searchBox = document.getElementById('searchBox');
    const searchResults = document.getElementById('searchResults');
    const searchContainer = document.getElementById('searchContainer'); // ����j�M�e��

    authSection.style.display = 'none';
    controls.style.display = 'flex';

    if (editButton && authSection && controls) {
        editButton.addEventListener('click', () => {
            const isAuthSectionVisible = authSection.style.display === 'flex';
            if (isAuthSectionVisible) {
                authSection.style.display = 'none';
                controls.style.display = 'flex';
                editButton.textContent = '�s��';
            } else {
                controls.style.display = 'none';
                authSection.style.display = 'flex';
                editButton.textContent = '����';
            }
        });
    } else {
        console.error('���~: �䤣��s����s�B�{�Ұ϶��α���C');
    }


    // ��ť�j�M�ت���J�ƥ�
    if (searchBox && searchResults && searchContainer) {
        searchBox.addEventListener('input', async (e) => {
            const query = e.target.value.trim().toLowerCase();
            searchResults.innerHTML = '';

            if (query.length > 0) {
                let results = [];
                if (window.allKmlFeatures && window.allKmlFeatures.length > 0) {
                    results = window.allKmlFeatures.filter(feature =>
                        feature.properties && feature.properties.name && typeof feature.properties.name === 'string' && feature.properties.name.toLowerCase().includes(query)
                    );
                }

                // ��j�M���G��ܮɡA�� searchContainer �K�[���D���A���O
                searchContainer.classList.add('search-active');

                searchResults.style.display = 'grid'; // ��ܬ� grid

                if (results.length === 0) {
                    const noResult = document.createElement('div');
                    noResult.className = 'result-item';
                    noResult.textContent = '�S����쵲�G';
                    // ���u�S����쵲�G�v�T�����T��
                    noResult.style.gridColumn = 'span 3';
                    searchResults.appendChild(noResult);
                } else {
                	  // ?? �P�_�W�ٳ̤j���סA�M����� class
                    let maxNameLength = 0;
                    results.forEach(f => {
                      const name = f.properties?.name || '';
                      if (name.length > maxNameLength) maxNameLength = name.length;
                    });
                  
                    searchResults.classList.remove('columns-2', 'columns-3');
                    searchResults.classList.add(maxNameLength > 9 ? 'columns-2' : 'columns-3');

                    results.forEach(f => {
                        const name = f.properties.name || '���R�W';
                        if (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates) {
                            const [lon, lat] = f.geometry.coordinates;
                            const item = document.createElement('div');
                            item.className = 'result-item';
                            item.textContent = name;
                            item.title = name;
                            item.addEventListener('click', () => {
                                const originalLatLng = L.latLng(lat, lon);
                                map.setView(originalLatLng, 18);
                            
                                // ? �M���Ҧ� label ���G
                                document.querySelectorAll('.marker-label span').forEach(el =>
                                    el.classList.remove('label-active')
                                );
                            
                                // ? �M����� label �ð��G
                                const labelId = `label-${lat}-${lon}`.replace(/\./g, '_');
                                const target = document.getElementById(labelId);
                                if (target) {
                                    target.classList.add('label-active');
                                }
                            
                                window.createNavButton(originalLatLng, name);
                                searchResults.style.display = 'none';
                                searchBox.value = '';
                                searchContainer.classList.remove('search-active');
                                console.log(`�I���j�M���G: ${name}�A�Y��ܦa�Ϩð��G label�C`);
                            });                            searchResults.appendChild(item);
                        } else {
                            console.warn("���L�D Point �����εL�y�Ъ� feature �i��j�M:", f);
                        }
                    });
                }
            } else {
                searchResults.style.display = 'none';
                // ��j�M���G���îɡA���� searchContainer �����D���A���O
                searchContainer.classList.remove('search-active');
            }
        });

        // �I���j�M���G�إ~�������÷j�M���G
        document.addEventListener('click', (event) => {
            // �ˬd�I���O�_�b searchResults �����A�Ϊ̦b searchBox �����A�Ϊ̦b searchContainer ����
            if (!searchResults.contains(event.target) && event.target !== searchBox && !searchContainer.contains(event.target)) {
                searchResults.style.display = 'none';
                searchContainer.classList.remove('search-active'); // �������D���A���O
            }
        });

        // ��ť ESC ��H���÷j�M���G
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                searchResults.style.display = 'none';
                searchContainer.classList.remove('search-active'); // �������D���A���O
                searchBox.blur();
            }
        });
    }
});