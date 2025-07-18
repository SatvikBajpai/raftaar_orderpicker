// Storage Manager Module
// Handles data persistence, loading, and caching

// Extend OrderPickingTool with storage management methods
Object.assign(OrderPickingTool.prototype, {
    
    saveOrdersToStorage() {
        localStorage.setItem('orders', JSON.stringify(this.orders));
        
        // Also save rider data
        localStorage.setItem('riders', JSON.stringify(this.riders));
        
        // Also save pincode coordinates cache
        const pincodeDataArray = Array.from(this.pincodeData.entries());
        localStorage.setItem('pincodeData', JSON.stringify(pincodeDataArray));
    },

    loadStoredData() {
        // Load orders
        const storedOrders = localStorage.getItem('orders');
        if (storedOrders) {
            this.orders = JSON.parse(storedOrders).map(order => ({
                ...order,
                orderTime: new Date(order.orderTime),
                slaDeadline: new Date(order.slaDeadline),
                addedAt: new Date(order.addedAt),
                selectedAt: order.selectedAt ? new Date(order.selectedAt) : undefined,
                deliveryStartedAt: order.deliveryStartedAt ? new Date(order.deliveryStartedAt) : undefined,
                deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined
            }));
            
            // Load pincode coordinates cache
            const storedPincodeData = localStorage.getItem('pincodeData');
            if (storedPincodeData) {
                const pincodeDataArray = JSON.parse(storedPincodeData);
                this.pincodeData = new Map(pincodeDataArray);
                console.log('Loaded pincode data cache:', this.pincodeData.size, 'entries');
                
                // Recalculate distances for orders that might not have them
                this.recalculateMissingDistances();
            }
            
            // Load rider data
            const storedRiders = localStorage.getItem('riders');
            if (storedRiders) {
                const loadedRiders = JSON.parse(storedRiders);
                // Merge with existing riders, preserving any new riders that might have been added
                Object.keys(loadedRiders).forEach(riderId => {
                    if (this.riders[riderId]) {
                        // Preserve the rider structure but load saved status
                        this.riders[riderId] = {
                            ...this.riders[riderId],
                            ...loadedRiders[riderId],
                            expectedFreeTime: loadedRiders[riderId].expectedFreeTime ? 
                                new Date(loadedRiders[riderId].expectedFreeTime) : null
                        };
                    }
                });
                console.log('Loaded rider data for', Object.keys(loadedRiders).length, 'riders');
            }
            
            this.refreshOrdersDisplay();
            
            // Initialize map after loading orders if Google Maps is ready
            if (window.google && window.google.maps) {
                console.log('Google Maps available, initializing map with stored data');
                this.initializeMap();
            } else {
                console.log('Google Maps not yet available, will initialize map when ready');
                // Set a flag so we know data is loaded
                this.dataLoaded = true;
            }
        }
    },

    // Recalculate distances for orders that don't have them but have cached coordinates
    recalculateMissingDistances() {
        let updated = false;
        
        this.orders.forEach(order => {
            if (!order.distance && order.customerPincode && this.pincodeData.has(order.customerPincode)) {
                const coords = this.pincodeData.get(order.customerPincode);
                const distance = this.calculateDistance(
                    this.storeLocation.lat, this.storeLocation.lng,
                    coords.lat, coords.lng
                );
                
                order.distance = distance;
                order.priority = this.calculatePriority(
                    order.orderTime, order.slaDeadline, distance
                );
                
                console.log(`Recalculated distance for order ${order.orderId}: ${distance}km`);
                updated = true;
            }
        });
        
        if (updated) {
            console.log('Updated orders with missing distances from cache');
            this.saveOrdersToStorage();
        }
    },

    // Clear all stored data (useful for testing or reset)
    clearStoredData() {
        if (confirm('This will clear all stored orders and data. Are you sure?')) {
            localStorage.removeItem('orders');
            localStorage.removeItem('pincodeData');
            this.orders = [];
            this.pincodeData = new Map();
            this.orderMarkers.clear();
            this.refreshOrdersDisplay();
            this.refreshDeliveryDisplay();
            if (this.map) {
                // Clear map markers
                this.orderMarkers.forEach(markerData => {
                    markerData.marker.setMap(null);
                });
                this.orderMarkers.clear();
            }
            this.showNotification('All data cleared successfully', 'info');
        }
    },

    // Export data for backup
    exportData() {
        const exportData = {
            orders: this.orders,
            pincodeData: Array.from(this.pincodeData.entries()),
            exportDate: new Date().toISOString(),
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `raftaar-orders-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('Data exported successfully', 'success');
    },

    // Import data from backup
    importData(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importData = JSON.parse(e.target.result);
                
                if (importData.orders && importData.pincodeData) {
                    if (confirm('This will replace all current data. Continue?')) {
                        // Import orders
                        this.orders = importData.orders.map(order => ({
                            ...order,
                            orderTime: new Date(order.orderTime),
                            slaDeadline: new Date(order.slaDeadline),
                            addedAt: new Date(order.addedAt),
                            selectedAt: order.selectedAt ? new Date(order.selectedAt) : undefined,
                            deliveryStartedAt: order.deliveryStartedAt ? new Date(order.deliveryStartedAt) : undefined,
                            deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined
                        }));
                        
                        // Import pincode data
                        this.pincodeData = new Map(importData.pincodeData);
                        
                        // Save and refresh
                        this.saveOrdersToStorage();
                        this.refreshOrdersDisplay();
                        this.refreshDeliveryDisplay();
                        
                        // Reinitialize map
                        if (this.map) {
                            this.processOrdersForMap();
                        }
                        
                        this.showNotification(`Imported ${this.orders.length} orders successfully`, 'success');
                    }
                } else {
                    throw new Error('Invalid file format');
                }
            } catch (error) {
                console.error('Import error:', error);
                this.showNotification('Failed to import data. Please check file format.', 'error');
            }
        };
        reader.readAsText(file);
    }
});
