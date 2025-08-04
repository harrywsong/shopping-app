// E:\codingprojects\shopping\static\js\main.js
document.addEventListener('DOMContentLoaded', () => {
    const updateBtn = document.getElementById('update-data-btn');
    const statusMessage = document.getElementById('status-message');
    const galleriaList = document.getElementById('galleria-list');
    const tntList = document.getElementById('tnt-supermarket-list');
    const foodbasicsList = document.getElementById('foodbasics-list');
    const nofrillsList = document.getElementById('nofrills-list');
    const shoppingList = document.getElementById('shopping-list');
    const tabButtons = document.querySelectorAll('.tab-button');

    // Function to handle tab switching
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            document.querySelector('.tab-button.active').classList.remove('active');
            button.classList.add('active');

            document.querySelector('.flyer-list.active').classList.remove('active');
            const targetListId = button.getAttribute('data-store') + '-list';
            document.getElementById(targetListId).classList.add('active');
        });
    });

    const fetchFlyerData = async () => {
        try {
            const response = await fetch('/api/flyers');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            renderFlyers(data);
        } catch (error) {
            console.error('Error fetching flyer data:', error);
        }
    };

    const fetchShoppingList = async () => {
        try {
            const response = await fetch('/api/shopping-list');
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            renderShoppingList(data);
        } catch (error) {
            console.error('Error fetching shopping list:', error);
        }
    };

    const renderFlyers = (data) => {
        // A helper function to render items for a specific list
        const renderList = (listElement, items, storeName) => {
            listElement.innerHTML = '';
            if (!items || items.length === 0) {
                listElement.innerHTML = '<p>No items found.</p>';
                return;
            }
            items.forEach(item => {
                const li = document.createElement('li');
                li.classList.add('flyer-item');

                const originalPriceHtml = item.original_price && item.original_price !== 'N/A'
                    ? `<p class="original-price">Original: <span class="strikethrough">${item.original_price} ${item.unit !== 'N/A' ? item.unit : ''}</span></p>`
                    : '';

                // Conditionally add the amount for Food Basics items
                const amountHtml = (storeName === 'foodbasics' && item.amount && item.amount !== 'N/A')
                    ? `<p class="item-amount">${item.amount}</p>`
                    : '';

                li.innerHTML = `
                    <img src="${item.image_url || 'https://via.placeholder.com/100?text=No+Image'}" alt="${item.name || item.item}" width="100">
                    <div class="item-details">
                        <p class="item-name">${item.name || item.item}</p>
                        ${amountHtml}
                        ${originalPriceHtml}
                        <p class="item-price">${item.price} <span class="price-unit">${item.unit !== 'N/A' ? item.unit : ''}</span></p>
                    </div>
                    <button class="add-to-list-btn" data-item='${JSON.stringify(item)}'>Add to List</button>
                `;
                listElement.appendChild(li);
            });
        };

        // Render items for each store, passing the store name
        renderList(galleriaList, data.galleria, 'galleria');
        renderList(tntList, data.tnt_supermarket, 'tnt_supermarket');
        renderList(foodbasicsList, data.foodbasics, 'foodbasics');
        renderList(nofrillsList, data.nofrills, 'nofrills');
    };

    const renderShoppingList = (items) => {
        shoppingList.innerHTML = ''; // Clear the current list
        if (items.length === 0) {
            shoppingList.innerHTML = '<p>Your shopping list is empty.</p>';
            return;
        }

        // Group items by store
        const groupedItems = items.reduce((acc, item) => {
            const store = item.store;
            if (!acc[store]) {
                acc[store] = [];
            }
            acc[store].push(item);
            return acc;
        }, {});

        // Render each store group
        for (const storeName in groupedItems) {
            let formattedStoreName = storeName.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            if (storeName === 'tnt_supermarket') {
                formattedStoreName = 'T&T Supermarket';
            }

            const storeHeading = document.createElement('h3');
            storeHeading.textContent = formattedStoreName;
            shoppingList.appendChild(storeHeading);

            const storeList = document.createElement('ul');
            storeList.classList.add('store-group-list');

            groupedItems[storeName].forEach(item => {
                const originalPriceHtml = item.original_price && item.original_price !== 'N/A'
                    ? `<p class="original-price">Original: <span class="strikethrough">${item.original_price} ${item.unit !== 'N/A' ? item.unit : ''}</span></p>`
                    : '';

                const li = document.createElement('li');
                li.classList.add('shopping-list-item');
                li.innerHTML = `
                    <img src="${item.image_url || 'https://via.placeholder.com/50?text=No+Image'}" alt="${item.name}" width="50">
                    <div class="item-details">
                        <p>${item.quantity}x - ${item.name || item.item}</p>
                        ${originalPriceHtml}
                        <p class="item-price">${item.price} <span class="price-unit">${item.unit !== 'N/A' ? item.unit : ''}</span></p>
                    </div>
                    <div class="item-actions">
                        <button class="remove-item-btn" data-item-name="${item.name}">Remove</button>
                    </div>
                `;
                storeList.appendChild(li);
            });
            shoppingList.appendChild(storeList);
        }

        // Add event listeners to the new remove buttons using event delegation
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-item-btn')) {
                const itemName = event.target.getAttribute('data-item-name');
                removeShoppingListItem(itemName);
            }
        });
    };

    const addItemToShoppingList = async (item) => {
        try {
            await fetch('/api/shopping-list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            await fetchShoppingList(); // Refresh the shopping list
        } catch (error) {
            console.error('Error adding item to shopping list:', error);
        }
    };

    const removeShoppingListItem = async (itemName) => {
        console.log(`Attempting to remove item: ${itemName}`);
        try {
            const response = await fetch('/api/shopping-list', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: itemName })
            });

            if (response.ok) {
                console.log('Item removed successfully from the server.');
                await fetchShoppingList(); // Refresh the shopping list
            } else {
                console.error('Failed to remove item from the server.');
            }
        } catch (error) {
            console.error('Error removing item from shopping list:', error);
        }
    };

    updateBtn.addEventListener('click', async () => {
        statusMessage.textContent = 'Updating flyer data... This may take a moment.';
        statusMessage.style.color = 'blue';

        try {
            const response = await fetch('/api/update-data', { method: 'POST' });
            const result = await response.json();

            if (response.ok) {
                statusMessage.textContent = result.message;
                statusMessage.style.color = 'green';

                setTimeout(() => {
                    fetchFlyerData();
                    statusMessage.textContent = 'Flyer data updated.';
                }, 15000); // 15 seconds
            } else {
                statusMessage.textContent = `Error: ${result.error}`;
                statusMessage.style.color = 'red';
            }
        } catch (error) {
            statusMessage.textContent = `An unexpected error occurred: ${error}`;
            statusMessage.style.color = 'red';
        }
    });

    // Use event delegation for "Add to List" buttons
    document.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-to-list-btn')) {
            const itemData = JSON.parse(event.target.getAttribute('data-item'));
            addItemToShoppingList(itemData);
        }
    });

document.getElementById('send-list-btn').addEventListener('click', async () => {
    try {
        const response = await fetch('/generate_qr');
        if (response.ok) {
            const blob = await response.blob();
            const qrUrl = URL.createObjectURL(blob);

            const img = document.createElement('img');
            img.src = qrUrl;
            img.alt = 'Shopping List QR Code';
            img.style.width = '200px';

            const container = document.getElementById('qr-container');
            container.innerHTML = '';
            container.appendChild(img);
        } else {
            alert('Failed to generate QR code.');
        }
    } catch (err) {
        console.error('Error generating QR code:', err);
        alert('Error generating QR code.');
    }
});


    // Initial load of flyer and shopping list data
    fetchFlyerData();
    fetchShoppingList();
});