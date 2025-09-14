// Enhanced main.js with filtering, statistics, and quality of life improvements

document.addEventListener('DOMContentLoaded', async () => {
    // DOM element references
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

    // Modal elements
    const textListModal = document.getElementById('text-list-modal');
    const textListArea = document.getElementById('text-list-area');
    const closeTextModalBtn = document.querySelector('.close-modal');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const generateQrCodeBtn = document.getElementById('generate-qr-btn');
    const qrCodeImage = document.getElementById('qr-code-image');
    const fullSizeImageModal = document.getElementById('full-size-image-modal');
    const fullSizeImage = fullSizeImageModal.querySelector('img');

    // State variables
    let allFlyers = {};
    let shoppingList = [];
    let activeStore = null;
    let debounceTimer;
    let filterDebounceTimer;
    let currentFilters = {
        search: '',
        sale_filter: 'all',
        min_price: null,
        max_price: null,
        min_savings: 0,
        sort_by: 'name',
        sort_order: 'asc'
    };

    // Initialize app
    initializeApp();

    async function initializeApp() {
        setupDarkMode();
        setupViewMode();
        setupEventListeners();
        createFilterPanel();
        await fetchShoppingList();
        await fetchFlyers();
        updateLastUpdatedIndicator();

        // Set up periodic updates
        setInterval(updateLastUpdatedIndicator, 60000); // Update every minute
    }

    function setupDarkMode() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.documentElement.classList.add('dark-mode');
        }

        darkModeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            const newDarkModeState = document.documentElement.classList.contains('dark-mode');
            localStorage.setItem('darkMode', newDarkModeState);
        });
    }

    function setupViewMode() {
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
    }

    function setupEventListeners() {
        // Shopping list toggle
        shoppingListToggleBtn.addEventListener('click', toggleShoppingList);
        closeShoppingListBtn.addEventListener('click', toggleShoppingList);

        // Search with debounce
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                currentFilters.search = e.target.value;
                applyFilters();
            }, 300);
        });

        // Update data
        updateDataBtn.addEventListener('click', updateData);

        // Shopping list actions
        clearListBtn.addEventListener('click', clearShoppingList);
        sendListBtn.addEventListener('click', sendShoppingList);

        // Modal events
        closeTextModalBtn.addEventListener('click', () => { textListModal.style.display = 'none'; });
        copyTextBtn.addEventListener('click', copyTextToClipboard);
        generateQrCodeBtn.addEventListener('click', generateAndDisplayQrCode);

        // Click outside modal to close
        window.addEventListener('click', (event) => {
            if (event.target === textListModal) textListModal.style.display = 'none';
        });

        // Product interactions
        tabContent.addEventListener('click', handleProductClick);
        shoppingListUl.addEventListener('click', handleShoppingListClick);
        fullSizeImageModal.addEventListener('click', () => {
            fullSizeImageModal.style.display = 'none';
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
    }

    function handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            searchInput.focus();
        }

        // Ctrl/Cmd + L to toggle shopping list
        if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
            e.preventDefault();
            toggleShoppingList();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            textListModal.style.display = 'none';
            fullSizeImageModal.style.display = 'none';
        }
    }

    function createFilterPanel() {
        const filterPanel = document.createElement('div');
        filterPanel.className = 'filter-panel';
        filterPanel.innerHTML = `
            <div class="filter-toggle">
                <h3><i class="fa-solid fa-filter"></i> Filters & Sorting</h3>
                <div>
                    <button class="stats-toggle" id="stats-toggle">
                        <i class="fa-solid fa-chart-simple"></i> Stats
                    </button>
                    <i class="fa-solid fa-chevron-down" id="filter-chevron"></i>
                </div>
            </div>
            <div class="filter-content" id="filter-content">
                <div class="filter-grid">
                    <div class="filter-group">
                        <label>Sale Status</label>
                        <select id="sale-filter">
                            <option value="all">All Items</option>
                            <option value="on_sale">On Sale Only</option>
                            <option value="not_on_sale">Regular Price Only</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label>Price Range</label>
                        <div class="price-range-inputs">
                            <input type="number" id="min-price" placeholder="Min $" min="0" step="0.01">
                            <span>to</span>
                            <input type="number" id="max-price" placeholder="Max $" min="0" step="0.01">
                        </div>
                    </div>
                    
                    <div class="filter-group">
                        <label>Minimum Savings %</label>
                        <input type="number" id="min-savings" placeholder="0" min="0" max="100" step="5">
                    </div>
                    
                    <div class="filter-group">
                        <label>Sort By</label>
                        <select id="sort-by">
                            <option value="name">Name</option>
                            <option value="price">Price</option>
                            <option value="savings">Savings %</option>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label>Sort Order</label>
                        <select id="sort-order">
                            <option value="asc">Ascending</option>
                            <option value="desc">Descending</option>
                        </select>
                    </div>
                </div>
                
                <div class="filter-actions">
                    <button class="apply-filters" id="apply-filters">Apply Filters</button>
                    <button class="clear-filters" id="clear-filters">Clear All</button>
                </div>
            </div>
        `;

        // Insert after header
        document.body.insertBefore(filterPanel, document.getElementById('main-container'));

        setupFilterEvents(filterPanel);
        createStatsPanel();
    }

    function setupFilterEvents(filterPanel) {
        const filterToggle = filterPanel.querySelector('.filter-toggle');
        const filterContent = filterPanel.querySelector('.filter-content');
        const filterChevron = filterPanel.querySelector('#filter-chevron');
        const applyFiltersBtn = filterPanel.querySelector('#apply-filters');
        const clearFiltersBtn = filterPanel.querySelector('#clear-filters');
        const statsToggle = filterPanel.querySelector('#stats-toggle');

        // Filter inputs
        const saleFilter = filterPanel.querySelector('#sale-filter');
        const minPrice = filterPanel.querySelector('#min-price');
        const maxPrice = filterPanel.querySelector('#max-price');
        const minSavings = filterPanel.querySelector('#min-savings');
        const sortBy = filterPanel.querySelector('#sort-by');
        const sortOrder = filterPanel.querySelector('#sort-order');

        // Toggle filter panel
        filterToggle.addEventListener('click', () => {
            filterContent.classList.toggle('expanded');
            filterChevron.style.transform = filterContent.classList.contains('expanded')
                ? 'rotate(180deg)' : 'rotate(0deg)';
        });

        // Apply filters
        applyFiltersBtn.addEventListener('click', applyFilters);

        // Clear filters
        clearFiltersBtn.addEventListener('click', () => {
            saleFilter.value = 'all';
            minPrice.value = '';
            maxPrice.value = '';
            minSavings.value = '';
            sortBy.value = 'name';
            sortOrder.value = 'asc';
            searchInput.value = '';

            currentFilters = {
                search: '',
                sale_filter: 'all',
                min_price: null,
                max_price: null,
                min_savings: 0,
                sort_by: 'name',
                sort_order: 'asc'
            };

            applyFilters();
        });

        // Auto-apply filters with debounce
        [saleFilter, minPrice, maxPrice, minSavings, sortBy, sortOrder].forEach(input => {
            input.addEventListener('change', () => {
                clearTimeout(filterDebounceTimer);
                filterDebounceTimer = setTimeout(applyFilters, 300);
            });
        });

        // Stats toggle
        statsToggle.addEventListener('click', toggleStats);
    }

    function createStatsPanel() {
        const statsPanel = document.createElement('div');
        statsPanel.className = 'stats-panel';
        statsPanel.id = 'stats-panel';
        statsPanel.innerHTML = `
            <div class="stats-grid" id="stats-grid">
                <!-- Statistics will be populated here -->
            </div>
        `;

        const mainContainer = document.getElementById('main-container');
        mainContainer.insertBefore(statsPanel, mainContainer.firstChild);
    }

    async function toggleStats() {
        const statsPanel = document.getElementById('stats-panel');
        const isVisible = statsPanel.classList.contains('show');

        if (!isVisible) {
            try {
                const response = await fetch('/api/statistics');
                const stats = await response.json();

                const statsGrid = document.getElementById('stats-grid');
                statsGrid.innerHTML = `
                    <div class="stat-item">
                        <div class="stat-value">${stats.total_items}</div>
                        <div class="stat-label">Total Items</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.items_on_sale}</div>
                        <div class="stat-label">Items on Sale</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.average_savings}%</div>
                        <div class="stat-label">Avg Savings</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges.under_5}</div>
                        <div class="stat-label">Under $5</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges['5_to_10']}</div>
                        <div class="stat-label">$5 - $10</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges['10_to_20']}</div>
                        <div class="stat-label">$10 - $20</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges.over_20}</div>
                        <div class="stat-label">Over $20</div>
                    </div>
                `;

                statsPanel.classList.add('show');
            } catch (error) {
                console.error('Failed to fetch statistics:', error);
                showNotification('Failed to load statistics', 'error');
            }
        } else {
            statsPanel.classList.remove('show');
        }
    }

    async function applyFilters() {
        // Update current filters from form inputs
        const saleFilter = document.getElementById('sale-filter');
        const minPrice = document.getElementById('min-price');
        const maxPrice = document.getElementById('max-price');
        const minSavings = document.getElementById('min-savings');
        const sortBy = document.getElementById('sort-by');
        const sortOrder = document.getElementById('sort-order');

        if (saleFilter) currentFilters.sale_filter = saleFilter.value;
        if (minPrice) currentFilters.min_price = minPrice.value ? parseFloat(minPrice.value) : null;
        if (maxPrice) currentFilters.max_price = maxPrice.value ? parseFloat(maxPrice.value) : null;
        if (minSavings) currentFilters.min_savings = minSavings.value ? parseFloat(minSavings.value) : 0;
        if (sortBy) currentFilters.sort_by = sortBy.value;
        if (sortOrder) currentFilters.sort_order = sortOrder.value;

        currentFilters.search = searchInput.value;

        await fetchFlyers();
    }

    async function fetchFlyers() {
        showLoadingState(true);

        try {
            const params = new URLSearchParams();

            // Add all current filters to params
            Object.keys(currentFilters).forEach(key => {
                if (currentFilters[key] !== null && currentFilters[key] !== '') {
                    params.append(key, currentFilters[key]);
                }
            });

            const response = await fetch(`/api/flyers?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            allFlyers = await response.json();
            renderTabs();
            const storeToRender = activeStore || Object.keys(allFlyers)[0];
            renderFlyers(storeToRender);
            showLoadingState(false);

        } catch (error) {
            console.error('Failed to fetch flyers:', error);
            showNotification('Failed to load flyers. Please check your connection and try again.', 'error');
            showLoadingState(false);
        }
    }

    function showLoadingState(loading) {
        if (loading) {
            statusMessage.innerHTML = '<div class="loading-spinner"></div>Loading flyers...';
            statusMessage.style.display = 'block';
            tabContent.classList.add('loading');
        } else {
            statusMessage.style.display = 'none';
            tabContent.classList.remove('loading');
        }
    }

    function renderTabs() {
        let storeTabsContainer = document.querySelector('.store-tabs-container');
        if (!storeTabsContainer) {
            storeTabsContainer = document.createElement('div');
            storeTabsContainer.classList.add('store-tabs-container');
            tabsContainer.prepend(storeTabsContainer);
        }
        storeTabsContainer.innerHTML = '';

        Object.keys(allFlyers).forEach((store, index) => {
            const itemCount = allFlyers[store].length;
            const tabButton = document.createElement('button');
            tabButton.classList.add('tab-button');
            tabButton.innerHTML = `
                ${formatStoreName(store)}
                <span class="store-count">${itemCount}</span>
            `;
            tabButton.dataset.store = store;

            if (store === activeStore || (!activeStore && index === 0)) {
                tabButton.classList.add('active');
                activeStore = store;
            }

            tabButton.addEventListener('click', () => {
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                tabButton.classList.add('active');
                activeStore = store;
                renderFlyers(store);
            });

            storeTabsContainer.appendChild(tabButton);
        });
    }

    function formatStoreName(store) {
        const lowerStore = store.toLowerCase();
        if (lowerStore === 'nofrills') return 'NO FRILLS';
        if (lowerStore === 'foodbasics') return 'FOOD BASICS';
        return store.replace(/_/g, ' ').toUpperCase();
    }

    function renderFlyers(store) {
        tabContent.innerHTML = '';
        const flyerList = document.createElement('ul');
        flyerList.classList.add('flyer-list', 'active');

        const currentViewMode = localStorage.getItem('viewMode') || 'grid';
        if (currentViewMode === 'list') {
            flyerList.classList.add('list-view');
        }

        let items = allFlyers[store] || [];

        if (items.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.innerHTML = `
                <i class="fa-solid fa-search"></i>
                <p>No items found for ${formatStoreName(store)} with current filters.</p>
            `;
            tabContent.appendChild(noResults);
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach(item => {
            item.id = `${store}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
            const flyerItem = document.createElement('li');
            flyerItem.classList.add('flyer-item');

            const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);

            // Create sale badge if item is on sale
            let saleBadge = '';
            if (item.on_sale && item.savings_percentage > 0) {
                saleBadge = `<div class="sale-badge savings-percentage">${item.savings_percentage}% OFF</div>`;
            } else if (item.on_sale) {
                saleBadge = `<div class="sale-badge">SALE</div>`;
            }

            flyerItem.innerHTML = `
                ${saleBadge}
                <div class="image-container">
                    <img src="${item.image_url || ''}" alt="${item.name || ''}" loading="lazy">
                </div>
                <div class="item-info">
                    <div class="item-details-wrapper">
                        <h3>${item.name || ''}</h3>
                        <div class="price-details-container">
                            ${mainPriceHtml}
                            ${strikethroughPriceHtml}
                            ${detailsHtml}
                        </div>
                    </div>
                    <button class="add-to-list-btn" data-id="${item.id}" data-item='${JSON.stringify(item)}'>
                        <i class="fa-solid fa-cart-plus"></i>
                        Add to List
                    </button>
                </div>
            `;
            fragment.appendChild(flyerItem);
        });

        flyerList.appendChild(fragment);
        tabContent.appendChild(flyerList);
    }

    function priceRenderingLogic(item) {
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
            unitText = unitText.replace(/^\/+/, '');
            unitText = unitText.replace(/\bl\b/g, 'L');
            if (unitText.startsWith('$')) {
                detailsHtml = `<p class="item-details-info">${unitText}</p>`;
            } else {
                detailsHtml = `<p class="item-details-info">/${unitText}</p>`;
            }
        }

        return { mainPriceHtml, strikethroughPriceHtml, detailsHtml };
    }

    async function updateLastUpdatedIndicator() {
        try {
            const response = await fetch('/api/last-updated');
            const data = await response.json();

            let indicator = document.querySelector('.last-updated-indicator');
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.className = 'last-updated-indicator';
                document.querySelector('.logo-container').appendChild(indicator);
            }

            if (data.last_updated) {
                const lastUpdated = new Date(data.last_updated);
                const now = new Date();
                const diffMinutes = Math.floor((now - lastUpdated) / (1000 * 60));

                let timeText;
                if (diffMinutes < 1) {
                    timeText = 'Just now';
                } else if (diffMinutes < 60) {
                    timeText = `${diffMinutes}m ago`;
                } else if (diffMinutes < 1440) {
                    timeText = `${Math.floor(diffMinutes / 60)}h ago`;
                } else {
                    timeText = data.human_readable;
                }

                indicator.textContent = `Updated: ${timeText}`;
            } else {
                indicator.textContent = 'Never updated';
            }
        } catch (error) {
            console.error('Failed to fetch last updated time:', error);
        }
    }

    const toggleShoppingList = () => {
        document.body.classList.toggle('shopping-list-open');
    };

    async function fetchShoppingList() {
        try {
            const response = await fetch('/api/shopping-list');
            if (!response.ok) {
                throw new Error('Failed to fetch shopping list');
            }
            shoppingList = await response.json();
            renderShoppingList();
        } catch (error) {
            console.error('Failed to fetch shopping list:', error);
            showNotification('Error loading shopping list', 'error');
        }
    }

    function renderShoppingList() {
        shoppingListUl.innerHTML = '';
        const emptyMessage = document.querySelector('.empty-list-message');

        if (shoppingList.length === 0) {
            if (emptyMessage) emptyMessage.style.display = 'block';
            cartCountSpan.textContent = 0;
            return;
        } else {
            if (emptyMessage) emptyMessage.style.display = 'none';
        }

        let totalItems = 0;
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
            storeHeader.textContent = formatStoreName(store);
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
                        <div class="quantity-control">
                            <button class="qty-btn minus" data-id="${item.id}">-</button>
                            <span>Quantity: ${item.quantity || 1}</span>
                            <button class="qty-btn plus" data-id="${item.id}">+</button>
                        </div>
                    </div>
                    <button class="remove-btn" data-id="${item.id}">&times;</button>
                `;
                shoppingListUl.appendChild(li);
                totalItems += parseInt(item.quantity, 10) || 1;
            });
        }
        cartCountSpan.textContent = totalItems;
    }

    async function updateQuantity(itemId, delta) {
        const itemIndex = shoppingList.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
            let newQty = (parseInt(shoppingList[itemIndex].quantity, 10) || 1) + delta;
            if (newQty < 1) newQty = 1;
            shoppingList[itemIndex].quantity = newQty;

            try {
                const response = await fetch('/api/shopping-list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(shoppingList)
                });

                if (response.ok) {
                    renderShoppingList();
                    showNotification('Quantity updated', 'success');
                }
            } catch (error) {
                console.error('Failed to update quantity:', error);
                showNotification('Failed to update quantity', 'error');
            }
        }
    }

    async function addItemToShoppingList(item) {
        try {
            const existingItemIndex = shoppingList.findIndex(i => i.id === item.id);
            if (existingItemIndex !== -1) {
                updateQuantity(item.id, 1);
                return;
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
                showNotification(`${item.name} added to list`, 'success');
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            console.error('Failed to add item:', error);
            showNotification('Error adding item to list', 'error');
        }
    }

    async function removeItemFromShoppingList(itemId) {
        try {
            const response = await fetch('/api/shopping-list', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: itemId })
            });

            if (response.ok) {
                shoppingList = shoppingList.filter(item => item.id !== itemId);
                renderShoppingList();
                showNotification('Item removed', 'success');
            } else {
                throw new Error('Server error');
            }
        } catch (error) {
            console.error('Failed to remove item:', error);
            showNotification('Error removing item', 'error');
        }
    }

    async function clearShoppingList() {
        if (!window.confirm("Are you sure you want to clear your shopping list?")) return;

        try {
            const response = await fetch('/api/shopping-list/clear', { method: 'POST' });
            if (response.ok) {
                await fetchShoppingList();
                showNotification('Shopping list cleared', 'success');
            }
        } catch (error) {
            console.error('Failed to clear list:', error);
            showNotification('Error clearing list', 'error');
        }
    }

    function sendShoppingList() {
        if (shoppingList.length === 0) {
            showNotification('Your shopping list is empty', 'warning');
            return;
        }

        let textContent = `Your Shopping List (Generated: ${new Date().toLocaleString()})\n\n`;
        const itemsByStore = shoppingList.reduce((acc, item) => {
            const store = item.store || 'Uncategorized';
            if (!acc[store]) acc[store] = [];
            acc[store].push(item);
            return acc;
        }, {});

        let totalItems = 0;
        let totalValue = 0;

        for (const store in itemsByStore) {
            textContent += `--- ${formatStoreName(store)} ---\n`;
            itemsByStore[store].forEach(item => {
                const quantity = parseInt(item.quantity, 10) || 1;
                let itemText = `- (x${quantity}) ${item.name}`;

                const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);
                let priceInfo = [mainPriceHtml, strikethroughPriceHtml, detailsHtml]
                    .map(html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
                    .filter(text => text)
                    .join(' ');

                if (priceInfo) {
                    itemText += ` - ${priceInfo}`;
                }

                if (item.on_sale && item.savings_percentage) {
                    itemText += ` (${item.savings_percentage}% OFF!)`;
                }

                textContent += `${itemText}\n`;
                totalItems += quantity;

                // Try to calculate total value
                if (item.numeric_price) {
                    totalValue += item.numeric_price * quantity;
                }
            });
            textContent += '\n';
        }

        textContent += `SUMMARY:\n`;
        textContent += `Total Items: ${totalItems}\n`;
        if (totalValue > 0) {
            textContent += `Estimated Total: ${totalValue.toFixed(2)}\n`;
        }
        textContent += `\nGenerated by Shopping List App`;

        textListArea.value = textContent;
        textListModal.style.display = 'flex';
        textListArea.style.display = 'block';
        qrCodeContainer.style.display = 'none';
        copyTextBtn.style.display = 'block';
        generateQrCodeBtn.style.display = 'block';
    }

    function copyTextToClipboard() {
        textListArea.select();
        document.execCommand('copy');
        showNotification('Copied to clipboard!', 'success');
    }

    async function generateAndDisplayQrCode() {
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

            showNotification('QR code generated successfully!', 'success');
        } catch (error) {
            console.error('Error generating QR code:', error);
            showNotification('Failed to generate QR code', 'error');
        } finally {
            generateQrCodeBtn.textContent = 'Generate QR Code';
            generateQrCodeBtn.disabled = false;
        }
    }

    async function updateData() {
        updateDataBtn.disabled = true;
        updateDataBtn.innerHTML = '<div class="loading-spinner"></div>Updating...';

        try {
            const response = await fetch('/api/update-data', { method: 'POST' });
            const result = await response.json();

            if (response.ok) {
                showNotification('Data updated successfully!', 'success');
                await fetchFlyers();
                updateLastUpdatedIndicator();
            } else {
                throw new Error(result.message || 'Update failed');
            }
        } catch (error) {
            console.error('Failed to update data:', error);
            showNotification(`Error updating data: ${error.message}`, 'error');
        } finally {
            updateDataBtn.disabled = false;
            updateDataBtn.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>';
        }
    }

    function handleProductClick(e) {
        const btn = e.target.closest('.add-to-list-btn');
        if (btn) {
            try {
                const item = JSON.parse(btn.dataset.item);
                addItemToShoppingList(item);
            } catch (error) {
                console.error('Failed to parse item data:', error);
                showNotification('Error adding item', 'error');
            }
        }

        const img = e.target.closest('.image-container img');
        if (img) {
            fullSizeImage.src = img.src;
            fullSizeImageModal.style.display = 'flex';
        }
    }

    function handleShoppingListClick(e) {
        const removeBtn = e.target.closest('.remove-btn');
        if (removeBtn) {
            removeItemFromShoppingList(removeBtn.dataset.id);
            return;
        }

        const qtyBtn = e.target.closest('.qty-btn');
        if (qtyBtn) {
            const delta = qtyBtn.classList.contains('plus') ? 1 : -1;
            updateQuantity(qtyBtn.dataset.id, delta);
        }
    }

    function showNotification(message, type = 'info') {
        // Create notification element if it doesn't exist
        let notification = document.querySelector('.notification');
        if (!notification) {
            notification = document.createElement('div');
            notification.className = 'notification';
            document.body.appendChild(notification);

            // Add notification styles
            const style = document.createElement('style');
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 6px;
                    color: white;
                    font-weight: 500;
                    z-index: 10000;
                    transform: translateX(400px);
                    transition: transform 0.3s ease;
                    max-width: 300px;
                }
                .notification.success { background-color: var(--accent-color); }
                .notification.error { background-color: var(--danger-color); }
                .notification.warning { background-color: var(--warning-color); color: var(--text-color); }
                .notification.info { background-color: var(--info-color); }
                .notification.show { transform: translateX(0); }
            `;
            document.head.appendChild(style);
        }

        notification.textContent = message;
        notification.className = `notification ${type}`;

        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);

        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Create back to text button for QR modal
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
});