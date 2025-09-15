// Enhanced main.js with filtering, statistics, dynamic sale badges, and quality of life improvements

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
    const fullSizeImage = fullSizeImageModal ? fullSizeImageModal.querySelector('img') : null;

    // Add Statistics and Filters buttons to the view-toggle container
    const viewToggleContainer = document.querySelector('.view-toggle');
    if (viewToggleContainer) {
        const statsButton = document.createElement('button');
        statsButton.id = 'stats-toggle';
        statsButton.className = 'stats-toggle';
        statsButton.innerHTML = `<i class="fa-solid fa-chart-simple"></i> Statistics`;
        viewToggleContainer.appendChild(statsButton);

        const filtersButton = document.createElement('button');
        filtersButton.id = 'filter-toggle-btn';
        filtersButton.className = 'filter-toggle-btn';
        filtersButton.innerHTML = `<i class="fa-solid fa-sliders"></i> Filters`;
        viewToggleContainer.appendChild(filtersButton);
    }

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
        sort_by: 'savings',
        sort_order: 'desc'
    };

    // Helper function to determine sale badge color tier
    function getSaleBadgeTier(savingsPercentage) {
        if (savingsPercentage >= 50) return 'extreme';
        if (savingsPercentage >= 30) return 'high';
        if (savingsPercentage >= 15) return 'medium';
        if (savingsPercentage >= 5) return 'low';
        return 'low'; // fallback
    }

    // Function declarations (moved before setupEventListeners to avoid hoisting issues)
    const toggleShoppingList = () => {
        console.log('Toggle shopping list called'); // Debug log
        const body = document.body;
        const sidebar = document.getElementById('shopping-list-sidebar');

        if (body && sidebar) {
            body.classList.toggle('shopping-list-open');
            console.log('Shopping list toggled:', body.classList.contains('shopping-list-open')); // Debug log
        } else {
            console.error('Body or sidebar element not found');
        }
    };

    // ADD MISSING setActiveStore FUNCTION
    function setActiveStore(store) {
        // Update active store
        activeStore = store;

        // Update tab button states
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(btn => btn.classList.remove('active'));

        // Find and activate the clicked tab
        const clickedTab = Array.from(tabButtons).find(btn =>
            btn.textContent.includes(formatStoreName(store).split(' ')[0])
        );
        if (clickedTab) {
            clickedTab.classList.add('active');
        }

        // Render flyers for the new active store
        renderFlyers(store);
    }

    function handleProductClick(e) {
        const btn = e.target.closest('.add-to-list-btn');
        if (btn) {
            try {
                const item = JSON.parse(btn.dataset.item);
                addItemToShoppingList(item);

                // Add visual feedback
                btn.style.transform = 'scale(0.95)';
                setTimeout(() => {
                    btn.style.transform = '';
                }, 150);
            } catch (error) {
                console.error('Failed to parse item data:', error);
                showNotification('Error adding item', 'error');
            }
        }

        const img = e.target.closest('.image-container img');
        if (img && fullSizeImageModal && fullSizeImage) {
            fullSizeImage.src = img.src;
            fullSizeImageModal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
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

        // Ctrl/Cmd + D to toggle dark mode
        if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            e.preventDefault();
            darkModeToggle.click();
        }

        // Escape to close modals
        if (e.key === 'Escape') {
            textListModal.style.display = 'none';
            if (fullSizeImageModal && fullSizeImageModal.style.display === 'flex') {
                fullSizeImageModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        }
    }

    // Initialize app
    initializeApp();

    async function initializeApp() {
        setupDarkMode();
        setupViewMode();
        createFilterPanel();
        createStatsPanel();
        setupEventListeners();
        await fetchShoppingList();
        await fetchFlyers();
        updateLastUpdatedIndicator();

        // Set up periodic updates
        setInterval(updateLastUpdatedIndicator, 3600000); // Update every hour

        // Add loading animation to initial load
        document.body.classList.add('loaded');
    }

    // ADD MISSING createFilterPanel FUNCTION
    function createFilterPanel() {
        // Check if filter panel already exists
        let filterPanel = document.getElementById('filter-panel');
        if (filterPanel) return;

        filterPanel = document.createElement('div');
        filterPanel.className = 'filter-panel';
        filterPanel.id = 'filter-panel';
        filterPanel.innerHTML = `
            <div class="filter-content" id="filter-content">
                <div class="filter-grid">
                    <div class="filter-group">
                        <label for="sale-filter">Sale Status</label>
                        <select id="sale-filter">
                            <option value="all">All Items</option>
                            <option value="sale">On Sale Only</option>
                            <option value="regular">Regular Price Only</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="min-price">Min Price ($)</label>
                        <input type="number" id="min-price" min="0" step="0.01" placeholder="0.00">
                    </div>
                    <div class="filter-group">
                        <label for="max-price">Max Price ($)</label>
                        <input type="number" id="max-price" min="0" step="0.01" placeholder="No limit">
                    </div>
                    <div class="filter-group">
                        <label for="min-savings">Min Savings (%)</label>
                        <input type="number" id="min-savings" min="0" max="100" value="0" placeholder="0">
                    </div>
                    <div class="filter-group">
                        <label for="sort-by">Sort By</label>
                        <select id="sort-by">
                            <option value="savings">Savings %</option>
                            <option value="price">Price</option>
                            <option value="name">Product Name</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label for="sort-order">Sort Order</label>
                        <select id="sort-order">
                            <option value="desc">High to Low</option>
                            <option value="asc">Low to High</option>
                        </select>
                    </div>
                </div>
                <div class="filter-actions">
                    <button class="apply-filters" onclick="applyFilters()">Apply Filters</button>
                    <button class="clear-filters" onclick="clearFilters()">Clear All</button>
                </div>
            </div>
        `;

        // Insert after header
        const header = document.querySelector('header');
        header.insertAdjacentElement('afterend', filterPanel);

        // Add event listeners for filter inputs
        const filterInputs = filterPanel.querySelectorAll('select, input');
        filterInputs.forEach(input => {
            input.addEventListener('change', () => {
                clearTimeout(filterDebounceTimer);
                filterDebounceTimer = setTimeout(applyFilters, 300);
            });
        });
    }

    // ADD clearFilters FUNCTION
    function clearFilters() {
        // Reset all filter inputs
        document.getElementById('sale-filter').value = 'all';
        document.getElementById('min-price').value = '';
        document.getElementById('max-price').value = '';
        document.getElementById('min-savings').value = '0';
        document.getElementById('sort-by').value = 'savings';
        document.getElementById('sort-order').value = 'desc';

        // Reset search input
        searchInput.value = '';

        // Apply cleared filters
        applyFilters();
    }

    function setupDarkMode() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (isDarkMode) {
            document.documentElement.classList.add('dark-mode');
            updateDarkModeIcon(true);
        }

        darkModeToggle.addEventListener('click', () => {
            document.documentElement.classList.toggle('dark-mode');
            const newDarkModeState = document.documentElement.classList.contains('dark-mode');
            localStorage.setItem('darkMode', newDarkModeState);
            updateDarkModeIcon(newDarkModeState);
        });
    }

    function updateDarkModeIcon(isDark) {
        const icon = darkModeToggle.querySelector('i');
        icon.className = isDark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
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
                activeList.classList.add('grid-view-transition');
                setTimeout(() => activeList.classList.remove('grid-view-transition'), 300);
            }
        });

        listViewBtn.addEventListener('click', () => {
            localStorage.setItem('viewMode', 'list');
            listViewBtn.classList.add('active');
            gridViewBtn.classList.remove('active');
            const activeList = document.querySelector('.flyer-list.active');
            if (activeList) {
                activeList.classList.add('list-view');
                activeList.classList.add('list-view-transition');
                setTimeout(() => activeList.classList.remove('list-view-transition'), 300);
            }
        });
    }

    function setupEventListeners() {
        // Shopping list toggle - Make sure these elements exist
        const shoppingListToggleBtn = document.getElementById('shopping-list-toggle');
        const closeShoppingListBtn = document.getElementById('close-shopping-list');

        if (shoppingListToggleBtn) {
            shoppingListToggleBtn.addEventListener('click', toggleShoppingList);
        } else {
            console.error('Shopping list toggle button not found');
        }

        if (closeShoppingListBtn) {
            closeShoppingListBtn.addEventListener('click', toggleShoppingList);
        } else {
            console.error('Close shopping list button not found');
        }

        // Search with debounce and enhanced feedback
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const searchIcon = document.querySelector('.search-icon');
                if (searchIcon) {
                    searchIcon.className = 'fa-solid fa-spinner fa-spin search-icon';
                }

                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    currentFilters.search = e.target.value;
                    applyFilters();
                    if (searchIcon) {
                        searchIcon.className = 'fa-solid fa-magnifying-glass search-icon';
                    }
                }, 300);
            });
        }

        // Update data with enhanced feedback
        if (updateDataBtn) {
            updateDataBtn.addEventListener('click', updateData);
        }

        // Shopping list actions
        if (clearListBtn) {
            clearListBtn.addEventListener('click', clearShoppingList);
        }
        if (sendListBtn) {
            sendListBtn.addEventListener('click', sendShoppingList);
        }

        // Modal events
        if (closeTextModalBtn) {
            closeTextModalBtn.addEventListener('click', () => {
                textListModal.style.display = 'none';
                document.body.style.overflow = '';
            });
        }
        if (copyTextBtn) copyTextBtn.addEventListener('click', copyTextToClipboard);
        if (generateQrCodeBtn) generateQrCodeBtn.addEventListener('click', generateAndDisplayQrCode);

        // Click outside modal to close
        window.addEventListener('click', (event) => {
            if (textListModal && event.target === textListModal) {
                textListModal.style.display = 'none';
                document.body.style.overflow = '';
            }
            if (fullSizeImageModal && event.target === fullSizeImageModal) {
                fullSizeImageModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });

        // Product interactions
        if (tabContent) {
            tabContent.addEventListener('click', handleProductClick);
        }
        if (shoppingListUl) {
            shoppingListUl.addEventListener('click', handleShoppingListClick);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);

        // Enhanced scroll behavior for tabs
        const storeTabsContainer = document.querySelector('.store-tabs-container');
        if (storeTabsContainer) {
            storeTabsContainer.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    storeTabsContainer.scrollLeft += e.deltaY;
                }
            });
        }

        // Close image modal event
        if (fullSizeImageModal) {
            const closeImageModal = fullSizeImageModal.querySelector('.close-image-modal');
            if (closeImageModal) {
                closeImageModal.addEventListener('click', () => {
                    fullSizeImageModal.style.display = 'none';
                    document.body.style.overflow = '';
                });
            }
        }

        // Stats toggle event
        const statsToggle = document.getElementById('stats-toggle');
        if (statsToggle) {
            statsToggle.addEventListener('click', toggleStats);
        }

        // Filter toggle event - Use event delegation to handle dynamically created elements
        document.addEventListener('click', function(e) {
            // Handle filter toggle button
            if (e.target.matches('#filter-toggle-btn') || e.target.closest('#filter-toggle-btn')) {
                e.preventDefault();
                const filterContent = document.getElementById('filter-content');
                const filterToggleBtn = document.getElementById('filter-toggle-btn');

                if (filterContent && filterToggleBtn) {
                    const isExpanded = filterContent.classList.contains('expanded');
                    filterContent.classList.toggle('expanded');
                    const icon = filterToggleBtn.querySelector('i');
                    if (icon) {
                        icon.className = !isExpanded ? 'fa-solid fa-sliders-up' : 'fa-solid fa-sliders';
                    }
                    filterToggleBtn.setAttribute('aria-expanded', !isExpanded);
                }
            }
        });
    }


    function setupFilterToggle() {
    // Use event delegation since the button might be created after this runs
        document.addEventListener('click', function(e) {
            if (e.target.matches('#filter-toggle-btn') || e.target.closest('#filter-toggle-btn')) {
                const filterContent = document.getElementById('filter-content');
                const filterToggleBtn = document.getElementById('filter-toggle-btn');

                if (filterContent && filterToggleBtn) {
                    const isExpanded = filterContent.classList.contains('expanded');
                    filterContent.classList.toggle('expanded');
                    const icon = filterToggleBtn.querySelector('i');
                    if (icon) {
                        icon.className = !isExpanded ? 'fa-solid fa-sliders-up' : 'fa-solid fa-sliders';
                    }
                    filterToggleBtn.setAttribute('aria-expanded', !isExpanded);
                }
            }
        });
    }

    function createStatsPanel() {
        // FIX: Ensure this only creates once (idempotent)
        let statsPanel = document.getElementById('stats-panel');
        if (statsPanel) return;  // Already exists

        statsPanel = document.createElement('div');
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
        let statsPanel = document.getElementById('stats-panel');  // FIX: Re-fetch in case
        const statsGrid = document.getElementById('stats-grid');

        // FIX: Defensive check - create if missing, then proceed
        if (!statsPanel) {
            createStatsPanel();
            statsPanel = document.getElementById('stats-panel');
            if (!statsPanel) {
                showNotification('Failed to initialize stats panel', 'error');
                return;
            }
        }

        const isVisible = statsPanel.classList.contains('show');  // Now safe

        if (!isVisible) {
            try {
                const response = await fetch('/api/statistics');
                const stats = await response.json();

                // FIX: Fallback if allFlyers is empty or API fails
                const fallbackStores = Object.keys(allFlyers).length || 0;

                statsGrid.innerHTML = `
                    <div class="stat-item">
                        <div class="stat-value">${stats.total_items || 0}</div>
                        <div class="stat-label">Total Items</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.items_on_sale || 0}</div>
                        <div class="stat-label">Items on Sale</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.average_savings || 0}%</div>
                        <div class="stat-label">Avg Savings</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges?.under_5 || 0}</div>
                        <div class="stat-label">Under $5</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges?.['5_to_10'] || 0}</div>
                        <div class="stat-label">$5 - $10</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges?.['10_to_20'] || 0}</div>
                        <div class="stat-label">$10 - $20</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${stats.price_ranges?.over_20 || 0}</div>
                        <div class="stat-label">Over $20</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-value">${fallbackStores}</div>
                        <div class="stat-label">Stores</div>
                    </div>
                `;

                statsPanel.classList.add('show');

                // Animate stat values counting up
                animateStatValues(statsGrid);

            } catch (error) {
                console.error('Failed to fetch statistics:', error);
                showNotification('Failed to load statistics', 'error');
                // FIX: Show a fallback empty state
                statsGrid.innerHTML = '<p>No stats available yet.</p>';
                statsPanel.classList.add('show');
            }
        } else {
            statsPanel.classList.remove('show');
        }
    }

    function animateStatValues(statsGrid) {
        const statValues = statsGrid.querySelectorAll('.stat-value');
        statValues.forEach(statValue => {
            const finalValue = statValue.textContent;
            const numericValue = parseInt(finalValue.replace(/[^0-9]/g, ''));

            if (!isNaN(numericValue)) {
                let currentValue = 0;
                const increment = Math.ceil(numericValue / 20);

                const counter = setInterval(() => {
                    currentValue += increment;
                    if (currentValue >= numericValue) {
                        statValue.textContent = finalValue;
                        clearInterval(counter);
                    } else {
                        statValue.textContent = currentValue + finalValue.replace(/[0-9]/g, '');
                    }
                }, 50);
            }
        });
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
        // Use the existing store tabs container from HTML
        const storeTabsContainer = document.querySelector('.store-tabs-container');

        // If for some reason it doesn't exist, create it (fallback)
        if (!storeTabsContainer) {
            console.error('Store tabs container not found in HTML');
            return;
        }

        // Clear existing content
        storeTabsContainer.innerHTML = '';

        Object.keys(allFlyers).forEach((store, index) => {
            const itemCount = allFlyers[store].length;
            const tabButton = document.createElement('button');
            tabButton.classList.add('tab-button');
            tabButton.innerHTML = `
                <span>${formatStoreName(store)}</span>
                <span class="store-count">${itemCount}</span>
            `;
            tabButton.addEventListener('click', () => {
                setActiveStore(store);
            });
            if (index === 0) {
                tabButton.classList.add('active');
                activeStore = store;
            }
            storeTabsContainer.appendChild(tabButton);
        });
    }

    function formatStoreName(store) {
        const lowerStore = store.toLowerCase();
        if (lowerStore === 'nofrills') return 'NO FRILLS';
        if (lowerStore === 'foodbasics') return 'FOOD BASICS';
        if (lowerStore === 'tnt_supermarket') return 'T&T SUPERMARKET';
        return store.replace(/_/g, ' ').toUpperCase();
    }

    function renderFlyers(store) {
        tabContent.innerHTML = '';
        const flyerList = document.createElement('ul');
        flyerList.classList.add('flyer-list', 'active');
        flyerList.setAttribute('role', 'list');

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
                <small>Try adjusting your search terms or filters.</small>
            `;
            tabContent.appendChild(noResults);
            return;
        }

        const fragment = document.createDocumentFragment();
        items.forEach((item, index) => {
            item.id = `${store}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;
            const flyerItem = document.createElement('li');
            flyerItem.classList.add('flyer-item');
            flyerItem.setAttribute('role', 'listitem');

            const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);

            // Create enhanced sale badge with dynamic colors OR not on sale indicator
            let saleBadge = '';
            if (item.on_sale && item.savings_percentage > 0) {
                const tier = getSaleBadgeTier(item.savings_percentage);
                const tierIcons = {
                    low: 'fa-tag',
                    medium: 'fa-star',
                    high: 'fa-fire',
                    extreme: 'fa-bolt'
                };
                saleBadge = `<div class="sale-badge" data-savings="${tier}">
                    <i class="fa-solid ${tierIcons[tier]}"></i>
                    ${item.savings_percentage}% OFF
                </div>`;
            } else if (item.on_sale) {
                saleBadge = `<div class="sale-badge" data-savings="low">
                    <i class="fa-solid fa-tag"></i>
                    SALE
                </div>`;
            } else {
                // Not on sale indicator
                saleBadge = `<div class="sale-badge" data-savings="none">
                    <i class="fa-solid fa-times-circle"></i>
                    NOT ON SALE
                </div>`;
            }

            // Updated HTML structure for proper list view support
            flyerItem.innerHTML = `
                ${saleBadge}
                <div class="image-container">
                    <img src="${item.image_url || ''}" alt="${item.name || ''}" loading="lazy" onerror="this.style.display='none'">
                </div>
                <div class="item-info">
                    <h3>${item.name || ''}</h3>
                    <div class="price-details-container">
                        ${mainPriceHtml}
                        ${strikethroughPriceHtml}
                        ${detailsHtml}
                    </div>
                    <button class="add-to-list-btn" data-id="${item.id}" data-item='${JSON.stringify(item)}' aria-label="Add ${item.name} to shopping list">
                        <i class="fa-solid fa-cart-plus"></i>
                        Add to List
                    </button>
                </div>
            `;
            fragment.appendChild(flyerItem);
        });

        flyerList.appendChild(fragment);
        tabContent.appendChild(flyerList);

        // Add staggered animation for items
        const flyerItems = flyerList.querySelectorAll('.flyer-item');
        flyerItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            setTimeout(() => {
                item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 50);
        });
    }

    function priceRenderingLogic(item) {
        let mainPriceHtml = '';
        let strikethroughPriceHtml = '';
        let detailsHtml = '';

        const hasSalePrice = item.price && item.price !== 'N/A';
        const hasOriginalPrice = item.original_price && item.original_price !== 'N/A';

        // Use item.on_sale flag for consistency
        if (item.on_sale && hasSalePrice) {
            mainPriceHtml = `<p class="main-price sale-price">${item.price}</p>`;
            // Only show a strikethrough price if it's different from the sale price
            if (hasOriginalPrice && item.price !== item.original_price) {
                strikethroughPriceHtml = `<p class="original-price-strikethrough">${item.original_price}</p>`;
            }
        } else {
            // Logic for regular-priced items - make price red when not on sale
            const priceToShow = hasSalePrice ? item.price : (hasOriginalPrice ? item.original_price : '');
            if (priceToShow) {
                mainPriceHtml = `<p class="main-price no-sale-price">${priceToShow}</p>`;
            }
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

                indicator.innerHTML = `<i class="fa-solid fa-clock"></i> Updated: ${timeText}`;
            } else {
                indicator.innerHTML = '<i class="fa-solid fa-question"></i> Never updated';
            }
        } catch (error) {
            console.error('Failed to fetch last updated time:', error);
        }
    }

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
            cartCountSpan.style.display = 'none';
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
            storeHeader.style.cssText = `
                margin: 20px 0 10px 0;
                padding: 12px 16px;
                background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
                color: white;
                border-radius: var(--border-radius);
                font-size: 0.9rem;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.05em;
            `;
            shoppingListUl.appendChild(storeHeader);

            itemsByStore[store].forEach(item => {
                const li = document.createElement('li');
                li.classList.add('shopping-list-item');

                const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);

                li.innerHTML = `
                    <div class="item-image-container">
                        <img src="${item.image_url || ''}" alt="${item.name || ''}" class="item-image" onerror="this.style.display='none'">
                    </div>
                    <div class="item-details">
                        <h4>${item.name || ''}</h4>
                        <div class="price-info">
                            ${mainPriceHtml}
                            ${strikethroughPriceHtml}
                            ${detailsHtml}
                        </div>
                        <div class="quantity-control">
                            <button class="qty-btn minus" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                            <span>Qty: ${item.quantity || 1}</span>
                            <button class="qty-btn plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
                        </div>
                    </div>
                    <button class="remove-btn" data-id="${item.id}" aria-label="Remove ${item.name} from list">&times;</button>
                `;
                shoppingListUl.appendChild(li);
                totalItems += parseInt(item.quantity, 10) || 1;
            });
        }

        cartCountSpan.textContent = totalItems;
        cartCountSpan.style.display = totalItems > 0 ? 'flex' : 'none';

        // Animate cart count update
        if (totalItems > 0) {
            cartCountSpan.style.animation = 'bounce-in 0.3s ease-out';
            setTimeout(() => {
                cartCountSpan.style.animation = '';
            }, 300);
        }
    }

    async function updateQuantity(itemId, delta) {
        const itemIndex = shoppingList.findIndex(i => i.id === itemId);
        if (itemIndex !== -1) {
            let newQty = (parseInt(shoppingList[itemIndex].quantity, 10) || 1) + delta;
            if (newQty < 1) newQty = 1;
            if (newQty > 99) newQty = 99; // Set reasonable limit

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
                } else {
                    throw new Error('Server error');
                }
            } catch (error) {
                console.error('Failed to update quantity:', error);
                showNotification('Failed to update quantity', 'error');
                // Revert the change
                shoppingList[itemIndex].quantity = (newQty - delta);
            }
        }
    }

    async function addItemToShoppingList(item) {
        try {
            const existingItemIndex = shoppingList.findIndex(i => i.id === item.id);
            if (existingItemIndex !== -1) {
                await updateQuantity(item.id, 1);
                return;
            } else {
                item.quantity = 1;
                item.store = activeStore; // Add store information
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
            // Remove item if it was added optimistically
            const index = shoppingList.findIndex(i => i.id === item.id);
            if (index > -1) shoppingList.splice(index, 1);
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

        let textContent = `🛒 Your Shopping List (Generated: ${new Date().toLocaleString()})\n\n`;
        const itemsByStore = shoppingList.reduce((acc, item) => {
            const store = item.store || 'Uncategorized';
            if (!acc[store]) acc[store] = [];
            acc[store].push(item);
            return acc;
        }, {});

        let totalItems = 0;
        let totalValue = 0;

        for (const store in itemsByStore) {
            textContent += `🏪 ${formatStoreName(store)}\n`;
            textContent += '─'.repeat(30) + '\n';

            itemsByStore[store].forEach(item => {
                const quantity = parseInt(item.quantity, 10) || 1;
                let itemText = `• (×${quantity}) ${item.name}`;

                const { mainPriceHtml, strikethroughPriceHtml, detailsHtml } = priceRenderingLogic(item);
                let priceInfo = [mainPriceHtml, strikethroughPriceHtml, detailsHtml]
                    .map(html => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
                    .filter(text => text)
                    .join(' ');

                if (priceInfo) {
                    itemText += ` - ${priceInfo}`;
                }

                if (item.on_sale && item.savings_percentage) {
                    itemText += ` 🔥 (${item.savings_percentage}% OFF!)`;
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

        textContent += '📊 SUMMARY\n';
        textContent += '─'.repeat(30) + '\n';
        textContent += `Total Items: ${totalItems}\n`;
        if (totalValue > 0) {
            textContent += `Estimated Total: ${totalValue.toFixed(2)}\n`;
        }
        textContent += `\n✨ Generated by Shopping List App`;

        textListArea.value = textContent;
        textListModal.style.display = 'flex';
        textListArea.style.display = 'block';
        qrCodeContainer.style.display = 'none';
        copyTextBtn.style.display = 'block';
        generateQrCodeBtn.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }

    async function copyTextToClipboard() {
        try {
            await navigator.clipboard.writeText(textListArea.value);
            showNotification('Copied to clipboard!', 'success');

            // Visual feedback
            copyTextBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            setTimeout(() => {
                copyTextBtn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy to Clipboard';
            }, 2000);

        } catch (error) {
            console.error('Failed to copy text:', error);
            showNotification('Failed to copy. Please select and copy manually.', 'error');
        }
    }

    async function generateAndDisplayQrCode() {
        const originalText = generateQrCodeBtn.innerHTML;
        generateQrCodeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
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
            generateQrCodeBtn.innerHTML = originalText;
            generateQrCodeBtn.disabled = false;
        }
    }

    async function updateData() {
        const originalText = updateDataBtn.innerHTML;
        updateDataBtn.disabled = true;
        updateDataBtn.innerHTML = '<div class="loading-spinner"></div>';

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
            updateDataBtn.innerHTML = originalText;
        }
    }

    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fa-solid ${getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fa-solid fa-times"></i>
            </button>
        `;

        // Add notification styles if they don't exist
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .notification {
                    position: fixed;
                    top: 100px;
                    right: 20px;
                    padding: 16px 20px;
                    border-radius: var(--border-radius-lg);
                    color: white;
                    font-weight: 600;
                    z-index: 10000;
                    transform: translateX(400px);
                    transition: transform var(--transition-slow);
                    max-width: 350px;
                    backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    box-shadow: var(--box-shadow-xl);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }
                .notification.success { 
                    background: linear-gradient(135deg, var(--success-color), var(--success-hover));
                }
                .notification.error { 
                    background: linear-gradient(135deg, var(--danger-color), var(--danger-hover));
                }
                .notification.warning { 
                    background: linear-gradient(135deg, var(--warning-color), var(--warning-hover));
                    color: var(--text-color);
                }
                .notification.info { 
                    background: linear-gradient(135deg, var(--info-color), var(--info-hover));
                }
                .notification.show { transform: translateX(0); }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex: 1;
                }
                .notification-content i {
                    font-size: 1.25rem;
                    opacity: 0.9;
                }
                .notification-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    color: inherit;
                    cursor: pointer;
                    padding: 8px;
                    border-radius: var(--border-radius);
                    transition: background var(--transition-fast);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .notification-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                }
                @media (max-width: 768px) {
                    .notification {
                        top: 90px;
                        right: 16px;
                        left: 16px;
                        max-width: none;
                        transform: translateY(-100px);
                    }
                    .notification.show { transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Show notification with animation
        requestAnimationFrame(() => {
            notification.classList.add('show');
        });

        // Auto-hide notification after 4 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 4000);
    }

    function getNotificationIcon(type) {
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        return icons[type] || icons.info;
    }

    // Create back to text button for QR modal
    const backToTextBtn = document.createElement('button');
    backToTextBtn.textContent = '← Back to Text';
    backToTextBtn.className = 'back-to-text-btn';
    backToTextBtn.style.display = 'none';
    backToTextBtn.style.cssText = `
        margin-top: 20px;
        padding: 12px 24px;
        background: var(--secondary-color);
        color: white;
        border: none;
        border-radius: var(--border-radius);
        cursor: pointer;
        font-weight: 600;
        transition: all var(--transition-normal);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    `;
    backToTextBtn.onclick = () => {
        textListArea.style.display = 'block';
        copyTextBtn.style.display = 'block';
        generateQrCodeBtn.style.display = 'block';
        qrCodeContainer.style.display = 'none';
        backToTextBtn.style.display = 'none';
    };
    if (qrCodeContainer) {
        qrCodeContainer.appendChild(backToTextBtn);
    }

    // Enhanced keyboard navigation
    document.addEventListener('keydown', (e) => {
        // Tab navigation enhancement
        if (e.key === 'Tab') {
            const focusableElements = document.querySelectorAll(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            );
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];

            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });

    // Performance optimization: Intersection Observer for lazy loading
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        }, {
            rootMargin: '50px'
        });

        // Apply to images when they're rendered
        const observeImages = () => {
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });
        };

        // Call initially and set up mutation observer for dynamic content
        observeImages();

        const mutationObserver = new MutationObserver(observeImages);
        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Add smooth scrolling behavior
    document.documentElement.style.scrollBehavior = 'smooth';

    // Service Worker registration for offline support
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', async () => {
            try {
                const registration = await navigator.serviceWorker.register('/sw.js');
                console.log('ServiceWorker registered successfully:', registration.scope);
            } catch (error) {
                console.log('ServiceWorker registration failed:', error);
            }
        });
    }

    // Add loading class to body when fully loaded
    window.addEventListener('load', () => {
        document.body.classList.add('loaded');
    });

    // Handle online/offline states
    window.addEventListener('online', () => {
        showNotification('Connection restored', 'success');
    });

    window.addEventListener('offline', () => {
        showNotification('You are offline. Some features may not work.', 'warning');
    });

    // Add performance monitoring
    if ('performance' in window) {
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                console.log('Page Load Time:', Math.round(perfData.loadEventEnd - perfData.loadEventStart), 'ms');
            }, 0);
        });
    }

    // Make functions globally available for inline onclick handlers
    window.applyFilters = applyFilters;
    window.clearFilters = clearFilters;
});