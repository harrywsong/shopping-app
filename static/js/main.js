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

    let allFlyers = {};
    let shoppingList = [];
    let activeStore = null;

    // Dark Mode Toggle
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    if (isDarkMode) {
        document.documentElement.classList.add('dark-mode');
    }

    darkModeToggle.addEventListener('click', () => {
        document.documentElement.classList.toggle('dark-mode');
        const newDarkModeState = document.documentElement.classList.contains('dark-mode');
        localStorage.setItem('darkMode', newDarkModeState);
    });

    // View Mode Toggles
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

    // Shopping List Sidebar Toggle
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

// E:\codingprojects\shopping\static\js\main.js

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

        let priceHtml = '';
        let originalPriceHtml = '';
        let unit = (item.unit && item.unit !== 'N/A') ? ` ${item.unit}` : '';

        // Check if a sale price exists (if price and original_price are different)
        const isOnSale = (item.price && item.original_price && item.price !== item.original_price);

        if (item.price && item.price !== 'N/A') {
            priceHtml = `<p class="item-price">${item.price}${unit}</p>`;
            if (isOnSale) {
                originalPriceHtml = `<p class="original-price">${item.original_price}${unit}</p>`;
            }
        } else if (item.original_price && item.original_price !== 'N/A') {
            priceHtml = `<p class="regular-price-list">${item.original_price}${unit}</p>`;
        }

        flyerItem.innerHTML = `
            <div class="image-container">
                <img src="${item.image_url || ''}" alt="${item.name || ''}" loading="lazy">
            </div>
            <div class="item-info">
                <div>
                    <h3>${item.name || ''}</h3>
                </div>
                <div class="price-and-button-container">
                    ${priceHtml}
                    ${originalPriceHtml}
                    ${store === 'nofrills' && item.details ? `<p class="item-details-info">${item.details}</p>` : ''}
                    <button class="add-to-list-btn" data-id="${item.id}" data-item='${JSON.stringify(item)}'>
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"></path>
                            <line x1="3" x2="21" y1="6" y2="6"></line>
                            <path d="M16 10a4 4 0 0 1-8 0"></path>
                        </svg>
                        Add to List
                    </button>
                </div>
            </div>
        `;
        flyerList.appendChild(flyerItem);
    });
    tabContent.appendChild(flyerList);
};const fetchShoppingList = async () => {
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

                // Revised Price Logic for Shopping List
                let priceHtml = '';
                let originalPriceHtml = '';
                let unit = (item.unit && item.unit !== 'N/A') ? ` ${item.unit}` : '';

                if (item.price && item.price !== 'N/A') {
                    priceHtml = `<span class="sale-price">${item.price}${unit}</span>`;
                    if (item.original_price && item.original_price !== 'N/A' && item.original_price !== item.price) {
                        originalPriceHtml = `<p class="original-price-strikethrough">${item.original_price}${unit}</p>`;
                    }
                } else if (item.original_price && item.original_price !== 'N/A') {
                    priceHtml = `<span class="regular-price">${item.original_price}${unit}</span>`;
                }

                li.innerHTML = `
                    <div class="item-image-container">
                        <img src="${item.image_url || ''}" alt="${item.name || ''}" class="item-image">
                    </div>
                    <div class="item-details">
                        <h4>${item.name || ''}</h4>
                        <div class="price-info">
                            ${priceHtml}
                            ${originalPriceHtml}
                        </div>
                        ${store === 'nofrills' && item.details ? `<p class="item-details-info">${item.details}</p>` : ''}
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
        console.log('addItemToShoppingList called with:', item);
        try {
            const existingItemIndex = shoppingList.findIndex(i => i.id === item.id);

            if (existingItemIndex !== -1) {
                const currentQuantity = parseInt(shoppingList[existingItemIndex].quantity, 10) || 0;
                shoppingList[existingItemIndex].quantity = currentQuantity + 1;
                console.log('Item already in list. Quantity incremented.');
            } else {
                item.quantity = 1;
                shoppingList.push(item);
                console.log('New item added to list.');
            }

            const response = await fetch('/api/shopping-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(shoppingList)
            });

            if (response.ok) {
                const updatedList = await response.json();
                shoppingList = updatedList;
                renderShoppingList();
                console.log('Shopping list updated successfully.');
            } else {
                const errorData = await response.json();
                console.error('Server failed to update shopping list:', errorData);
                alert(`Error: ${errorData.message || 'Server failed to update shopping list.'}`);
            }
        } catch (error) {
            console.error('Failed to add item:', error);
            alert('An unexpected error occurred. Please check the console for details.');
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
                const errorData = await response.json();
                console.error('Server failed to remove item:', errorData);
                alert(`Error: ${errorData.message || 'Server failed to remove item.'}`);
            }
        } catch (error) {
            console.error('Failed to remove item:', error);
            alert('An unexpected error occurred. Please check the console for details.');
        }
    };

    const clearShoppingList = async () => {
        if (window.confirm("Are you sure you want to clear your shopping list? This action cannot be undone.")) {
            try {
                const response = await fetch('/api/shopping-list/clear', {
                    method: 'POST'
                });
                if (response.ok) {
                    fetchShoppingList();
                }
            } catch (error) {
            console.error('Failed to clear list:', error);
            }
        }
    };

const sendShoppingList = async () => {
    if (shoppingList.length === 0) {
        alert('Your shopping list is empty. Please add items before sending.');
        return;
    }

    const textUrl = '192.168.1.139:1972/api/shopping-list-text';
    let textContent = `Your Shopping List\nURL: ${textUrl}\n\n`;

    if (shoppingList.length === 0) {
        textContent += "Your shopping list is empty.";
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
            textContent += `--- ${store.replace(/_/g, ' ').toUpperCase()} ---\n`;
            itemsByStore[store].forEach(item => {
                const unitDisplay = (item.unit && item.unit !== 'N/A') ? `${item.unit}` : '';
                let priceInfo = '';
                if (item.price && item.price !== 'N/A') {
                    priceInfo = `${item.price}${unitDisplay ? ' ' + unitDisplay : ''}`;
                    if (item.original_price && item.original_price !== 'N/A' && item.original_price !== item.price) {
                        // The change is in the line below.
                        // I've replaced ' / ' with ' ' to avoid the double slash.
                        priceInfo += ` (was ${item.original_price}${unitDisplay ? ' ' + unitDisplay : ''})`;
                    }
                } else if (item.original_price && item.original_price !== 'N/A') {
                    priceInfo = `${item.original_price}${unitDisplay ? ' ' + unitDisplay : ''}`;
                }

                textContent += `- (x${item.quantity || 1}) ${item.name} - ${priceInfo}`;
                if (item.store === 'nofrills' && item.details) {
                    textContent += ` - ${item.details}`;
                }
                textContent += `\n`;
            });
            textContent += '\n';
        }
    }

    textListArea.value = textContent;
    textListModal.style.display = 'flex';
};
    closeTextModalBtn.addEventListener('click', () => {
        textListModal.style.display = 'none';
    });

    copyTextBtn.addEventListener('click', () => {
        textListArea.select();
        document.execCommand('copy');
        alert('Shopping list copied to clipboard!');
    });

    window.addEventListener('click', (event) => {
        if (event.target === textListModal) {
            textListModal.style.display = 'none';
        }
    });

    const updateData = async () => {
        updateDataBtn.disabled = true;
        updateDataBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                         <path d="M21.5 2v6h-6"/><path d="M21.5 6H17a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h4.5v-6h-4.5"/><path d="M2.5 22v-6h6"/><path d="M2.5 18H7a1 1 0 0 1 1-1v-6a1 1 0 0 1-1-1H2.5v6h4.5"/>
                                         <path d="M12 11h.01"/><path d="M12 15h.01"/><path d="M12 19h.01"/>
                                      </svg>  Updating...`;
        try {
            const response = await fetch('/api/update-data', {
                method: 'POST',
            });
            if (response.ok) {
                const result = await response.json();
                alert(result.message);
                fetchFlyers();
            } else {
                const error = await response.json();
                alert(`Error: ${error.message}`);
            }
        } catch (error) {
            console.error('Failed to update data:', error);
            alert('An unexpected error occurred while updating data.');
        } finally {
            updateDataBtn.disabled = false;
            updateDataBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                         <path d="M21.5 2v6h-6"/><path d="M21.5 6H17a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h4.5v-6h-4.5"/><path d="M2.5 22v-6h6"/><path d="M2.5 18H7a1 1 0 0 1 1-1v-6a1 1 0 0 1-1-1H2.5v6h4.5"/>
                                         <path d="M12 11h.01"/><path d="M12 15h.01"/><path d="M12 19h.01"/>
                                      </svg> Update`;
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
                const itemData = btn.dataset.item;
                if (itemData) {
                    const item = JSON.parse(itemData);
                    // 🚀 The item's ID is now correctly set here to be stable.
                    addItemToShoppingList(item);
                } else {
                    console.error('Item data attribute is missing.');
                }
            } catch (error) {
                console.error('Failed to parse item data:', error);
            }
        }
    });

    shoppingListUl.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-btn');
        if (btn) {
            const itemId = btn.dataset.id;
            removeItemFromShoppingList(itemId);
        }
    });

    await fetchShoppingList();
    fetchFlyers();
});