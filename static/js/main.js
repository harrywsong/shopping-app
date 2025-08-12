// E:\codingprojects\shopping\static\js\main.js

document.addEventListener('DOMContentLoaded', async () => {
    const searchInput = document.getElementById('search-input');
    const tabsContainer = document.querySelector('.tabs');
    const tabContent = document.querySelector('.tab-content');
    const statusMessage = document.getElementById('status-message');
    const shoppingListToggleBtn = document.getElementById('shopping-list-toggle');
    const closeShoppingListBtn = document.getElementById('close-shopping-list');
    const shoppingListUl = document.getElementById('shopping-list');
    const clearListBtn = document.getElementById('clear-list-btn');
    const sendListBtn = document.getElementById('send-list-btn');
    const updateDataBtn = document.getElementById('update-data-btn');
    const cartCountSpan = document.getElementById('cart-count');
    const darkModeToggle = document.getElementById('dark-mode-toggle');
    const gridViewBtn = document.getElementById('grid-view-btn');
    const listViewBtn = document.getElementById('list-view-btn');
    const textListModal = document.getElementById('text-list-modal');
    const textListArea = document.getElementById('text-list-area');
    const closeTextModalBtn = document.querySelector('.close-modal');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const generateQrCodeBtn = document.getElementById('generate-qr-btn');
    const qrCodeImage = document.getElementById('qr-code-image');
    const fullSizeImageModal = document.createElement('div');
    fullSizeImageModal.id = 'full-size-image-modal';
    fullSizeImageModal.classList.add('hidden');
    const fullSizeImage = document.createElement('img');
    fullSizeImageModal.appendChild(fullSizeImage);
    document.body.appendChild(fullSizeImageModal);
    let hoverTimer = null;
    let allFlyers = {};
    let shoppingList = [];
    let activeStore = null;

    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.documentElement.classList.add('dark-mode');
    }

    darkModeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        const newDarkModeState = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem('darkMode', newDarkModeState);
    });

    const currentViewMode = localStorage.getItem('viewMode') || 'grid';
    if (currentViewMode === 'list') {
        gridViewBtn.classList.remove('active');
        listViewBtn.classList.add('active');
    }

    gridViewBtn.addEventListener('click', () => {
        localStorage.setItem('viewMode', 'grid');
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
        const activeList = document.querySelector('.flyer-list.active');
        if (activeList) {
            activeList.classList.remove('list-view');
        }
    });

    listViewBtn.addEventListener('click', () => {
        localStorage.setItem('viewMode', 'list');
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
        const activeList = document.querySelector('.flyer-list.active');
        if (activeList) {
            activeList.classList.add('list-view');
        }
    });

    const toggleShoppingList = () => {
        document.body.classList.toggle('shopping-list-open');
    };

    shoppingListToggleBtn.addEventListener('click', toggleShoppingList);
    closeShoppingListBtn.addEventListener('click', toggleShoppingList);

    const fetchFlyers = async (query = '') => {
        statusMessage.textContent = 'Loading flyers...';
        statusMessage.style.display = 'block';
        try {
            const response = await fetch(`/api/flyers?search=${query}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            allFlyers = await response.json();
            renderTabs();
            const storeToRender = activeStore || Object.keys(allFlyers)[0];
            renderFlyers(storeToRender, query);
            statusMessage.style.display = 'none';
        } catch (error) {
            console.error('Failed to fetch flyers:', error);
            statusMessage.textContent = 'Failed to load flyers. Please try again later.';
        }
    };

    const renderTabs = () => {
        let storeTabsContainer = document.querySelector('.store-tabs-container');
        if (!storeTabsContainer) {
            storeTabsContainer = document.createElement('div');
            storeTabsContainer.classList.add('store-tabs-container');
            tabsContainer.prepend(storeTabsContainer);
        }
        storeTabsContainer.innerHTML = '';

        Object.keys(allFlyers).forEach((store, index) => {
            const tabButton = document.createElement('button');
            tabButton.classList.add('tab-button');
            tabButton.textContent = store.replace(/_/g, ' ').toUpperCase();
            tabButton.dataset.store = store;
            if (store === activeStore || (!activeStore && index === 0)) {
                tabButton.classList.add('active');
                activeStore = store;
            }
            tabButton.addEventListener('click', () => {
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                tabButton.classList.add('active');
                activeStore = store;
                renderFlyers(store, searchInput.value);
            });
            storeTabsContainer.appendChild(tabButton);
        });
    };

    const priceRenderingLogic = (item) => {
        let mainPriceHtml = '';
        let strikethroughPriceHtml = '';
        let detailsHtml = '';

        const hasSalePrice = item.price && item.price !== 'N/A';
        const hasOriginalPrice = item.original_price && item.original_price !== 'N/A';
        const isOnSale = hasSalePrice && hasOriginalPrice && item.price !== item.original_price;

        if (isOnSale) {
            mainPriceHtml = `<p class="main-price sale-price">${item.price}</p>`;
            strikethroughPriceHtml = `<p class="original-price-strikethrough">${item.original_price}</p>`;
        } else if (hasSalePrice) {
            mainPriceHtml = `<p class="main-price regular-price">${item.price}</p>`;
        } else if (hasOriginalPrice) {
            mainPriceHtml = `<p class="main-price regular-price">${item.original_price}</p>`;
        }

        if (item.unit && item.unit !== 'N/A') {
            let unitText = item.unit.split(',')[0].trim();

            // First, remove any leading slashes that might exist in the data
            unitText = unitText.replace(/^\/+/, '');

            // Now, add a slash back only if the text doesn't start with a '$'
            if (unitText.startsWith('$')) {
                detailsHtml = `<p class="item-details-info">${unitText}</p>`;
            } else {
                detailsHtml = `<p class="item-details-info">/${unitText}</p>`;
            }
        }

        return { mainPriceHtml, strikethroughPriceHtml, detailsHtml };
    };

    const renderFlyers = (store, query) => {
        tabContent.innerHTML = '';
        const flyerList = document.createElement('ul');
        flyerList.classList.add('flyer-list', 'active');
        const currentViewMode = localStorage.getItem('viewMode') || 'grid';
        if (currentViewMode === 'list') {
            flyerList.classList.add('list-view');
        }

        let items = allFlyers[store] || [];
        if (query) {
            items = items.filter(item => item.name && item.name.toLowerCase().includes(query.toLowerCase()));
        }

        if (items.length === 0) {
            statusMessage.textContent = `No flyers available for ${store.replace(/_/g, ' ').toUpperCase()}.`;
            statusMessage.style.display = 'block';
            return;
        } else {
            statusMessage.style.display = 'none';
        }

        items.forEach(item => {
            item.id = `${store}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            const flyerItem = document.createElement('li');
            flyerItem.classList.add('flyer-item');

            const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);

            flyerItem.innerHTML = `
                <div class="image-container">
                    <img src="${item.image_url || ''}" alt="${item.name || ''}" loading="lazy">
                </div>
                <div class="item-info">
                    <h3>${item.name || ''}</h3>
                    <div class="price-details-container">
                        ${mainPriceHtml}
                        ${strikethroughPriceHtml}
                        ${detailsHtml}
                    </div>
                    <button class="add-to-list-btn" data-id="${item.id}" data-item='${JSON.stringify(item)}'>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                            <line x1="3" x2="21" y1="6" y2="6"></line>
                            <path d="M16 10a4 4 0 0 1-8 0"></path>
                        </svg>
                        Add to List
                    </button>
                </div>
            `;
            const imageContainer = flyerItem.querySelector('.image-container');
            imageContainer.addEventListener('mouseenter', () => {
                const imageUrl = item.image_url;
                if (!imageUrl) return;
                hoverTimer = setTimeout(() => {
                    fullSizeImage.src = imageUrl;
                    fullSizeImageModal.classList.remove('hidden');
                }, 1000);
            });
            imageContainer.addEventListener('mouseleave', () => {
                clearTimeout(hoverTimer);
                fullSizeImageModal.classList.add('hidden');
            });
            flyerList.appendChild(flyerItem);
        });
        tabContent.appendChild(flyerList);
    };

    const fetchShoppingList = async () => {
        try {
            const response = await fetch('/api/shopping-list');
            shoppingList = await response.json();
            renderShoppingList();
        } catch (error) {
            console.error('Failed to fetch shopping list:', error);
        }
    };

    const renderShoppingList = () => {
        shoppingListUl.innerHTML = '';
        let totalItems = 0;
        if (shoppingList.length === 0) {
            shoppingListUl.innerHTML = '<li class="empty-list-message">Your shopping list is empty.</li>';
        } else {
            const itemsByStore = shoppingList.reduce((acc, item) => {
                const store = item.store || 'Uncategorized';
                if (!acc[store]) {
                    acc[store] = [];
                }
                acc[store].push(item);
                return acc;
            }, {});

            for (const store in itemsByStore) {
                const storeHeader = document.createElement('h5');
                storeHeader.classList.add('store-header');
                storeHeader.textContent = store.replace(/_/g, ' ').toUpperCase();
                shoppingListUl.appendChild(storeHeader);

                itemsByStore[store].forEach(item => {
                    const li = document.createElement('li');
                    li.classList.add('shopping-list-item');

                    const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);

                    li.innerHTML = `
                        <div class="item-image-container">
                            <img src="${item.image_url || ''}" alt="${item.name || ''}" class="item-image">
                        </div>
                        <div class="item-details">
                            <h4>${item.name || ''}</h4>
                            <div class="price-info">
                                ${mainPriceHtml}
                                ${strikethroughPriceHtml}
                                ${detailsHtml}
                            </div>
                            <p>Quantity: ${item.quantity || 1}</p>
                        </div>
                        <button class="remove-btn" data-id="${item.id}">&times;</button>
                    `;
                    shoppingListUl.appendChild(li);
                    totalItems += parseInt(item.quantity, 10) || 0;
                });
            }
        }
        cartCountSpan.textContent = totalItems;
    };

    const addItemToShoppingList = async (item) => {
        try {
            const existingItemIndex = shoppingList.findIndex(i => i.id === item.id);
            if (existingItemIndex !== -1) {
                const currentQuantity = parseInt(shoppingList[existingItemIndex].quantity, 10) || 0;
                shoppingList[existingItemIndex].quantity = currentQuantity + 1;
            } else {
                item.quantity = 1;
                shoppingList.push(item);
            }
            const response = await fetch('/api/shopping-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shoppingList)
            });
            if (response.ok) {
                shoppingList = await response.json();
                renderShoppingList();
            } else {
                alert('Error: Server failed to update shopping list.');
            }
        } catch (error) {
            console.error('Failed to add item:', error);
        }
    };

    const removeItemFromShoppingList = async (itemId) => {
        try {
            const response = await fetch('/api/shopping-list', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: itemId })
            });
            if (response.ok) {
                shoppingList = shoppingList.filter(item => item.id !== itemId);
                renderShoppingList();
            } else {
                alert('Error: Server failed to remove item.');
            }
        } catch (error) {
            console.error('Failed to remove item:', error);
        }
    };

    const clearShoppingList = async () => {
        if (window.confirm("Are you sure you want to clear your shopping list?")) {
            try {
                const response = await fetch('/api/shopping-list/clear', { method: 'POST' });
                if (response.ok) {
                    fetchShoppingList();
                }
            } catch (error) {
                console.error('Failed to clear list:', error);
            }
        }
    };

    const sendShoppingList = () => {
        if (shoppingList.length === 0) {
            alert('Your shopping list is empty.');
            return;
        }
        let textContent = `Your Shopping List\n\n`;
        const itemsByStore = shoppingList.reduce((acc, item) => {
            const store = item.store || 'Uncategorized';
            if (!acc[store]) acc[store] = [];
            acc[store].push(item);
            return acc;
        }, {});
        for (const store in itemsByStore) {
            textContent += `--- ${store.replace(/_/g, ' ').toUpperCase()} ---\n`;
            itemsByStore[store].forEach(item => {
                let itemText = `- (x${item.quantity || 1}) ${item.name}`;
                const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);
                let priceInfo = [mainPriceHtml, strikethroughPriceHtml, detailsHtml]
                    .map(html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
                    .filter(text => text)
                    .join(' ');
                if (priceInfo) {
                    itemText += ` - ${priceInfo}`;
                }
                textContent += `${itemText}\n`;
            });
            textContent += '\n';
        }
        textListArea.value = textContent;
        textListModal.style.display = 'flex';
        textListArea.style.display = 'block';
        qrCodeContainer.style.display = 'none';
        copyTextBtn.style.display = 'block';
        generateQrCodeBtn.style.display = 'block';
    };

    const generateAndDisplayQrCode = async () => {
        generateQrCodeBtn.textContent = 'Generating...';
        generateQrCodeBtn.disabled = true;
        try {
            const response = await fetch('/api/generate-qr-for-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listContent: textListArea.value })
            });
            if (!response.ok) throw new Error('Failed to generate QR code.');
            const result = await response.json();
            textListArea.style.display = 'none';
            copyTextBtn.style.display = 'none';
            generateQrCodeBtn.style.display = 'none';
            qrCodeImage.src = result.qrCode;
            qrCodeContainer.style.display = 'block';
            const backBtn = document.querySelector('.back-to-text-btn');
            if (backBtn) backBtn.style.display = 'block';
        } catch (error) {
            console.error('Error generating QR code:', error);
            alert('Failed to generate QR code.');
        } finally {
            generateQrCodeBtn.textContent = 'Generate QR Code';
            generateQrCodeBtn.disabled = false;
        }
    };

    closeTextModalBtn.addEventListener('click', () => { textListModal.style.display = 'none'; });
    copyTextBtn.addEventListener('click', () => {
        textListArea.select();
        document.execCommand('copy');
        alert('Copied to clipboard!');
    });

    const backToTextBtn = document.createElement('button');
    backToTextBtn.textContent = 'Back to Text';
    backToTextBtn.className = 'back-to-text-btn';
    backToTextBtn.style.display = 'none';
    backToTextBtn.onclick = () => {
        textListArea.style.display = 'block';
        copyTextBtn.style.display = 'block';
        generateQrCodeBtn.style.display = 'block';
        qrCodeContainer.style.display = 'none';
        backToTextBtn.style.display = 'none';
    };
    qrCodeContainer.appendChild(backToTextBtn);
    if (generateQrCodeBtn) generateQrCodeBtn.addEventListener('click', generateAndDisplayQrCode);
    window.addEventListener('click', (event) => { if (event.target === textListModal) textListModal.style.display = 'none'; });

    const updateData = async () => {
        updateDataBtn.disabled = true;
        updateDataBtn.textContent = 'Updating...';
        try {
            const response = await fetch('/api/update-data', { method: 'POST' });
            const result = await response.json();
            alert(result.message);
            if (response.ok) fetchFlyers();
        } catch (error) {
            console.error('Failed to update data:', error);
            alert('An unexpected error occurred.');
        } finally {
            updateDataBtn.disabled = false;
            updateDataBtn.textContent = 'Update Data';
        }
    };

    searchInput.addEventListener('input', (e) => fetchFlyers(e.target.value));
    updateDataBtn.addEventListener('click', updateData);
    clearListBtn.addEventListener('click', clearShoppingList);
    sendListBtn.addEventListener('click', sendShoppingList);

    tabContent.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-list-btn');
        if (btn) {
            try {
                const item = JSON.parse(btn.dataset.item);
                addItemToShoppingList(item);
            } catch (error) {
                console.error('Failed to parse item data:', error);
            }
        }
    });

    shoppingListUl.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (btn) {
            removeItemFromShoppingList(btn.dataset.id);
        }
    });

    await fetchShoppingList();
    fetchFlyers();
});