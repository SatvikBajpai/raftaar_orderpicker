// Order Picking Tool - Main Application Class
class OrderPickingTool {
    constructor() {
        this.orders = [];
        this.storeLocation = {
            lat: 21.142639, // Raftaar store location
            lng: 79.090385
        };
        this.pincodeData = new Map(); // Cache for pincode to coordinates mapping
        this.map = null;
        this.storeMarker = null;
        this.orderMarkers = new Map(); // Track order markers
        this.optimizationMode = 'maximize_sla'; // Default mode
        this.averageSpeed = 25; // km/h average delivery speed
        this.routePolyline = null; // For storing the route polyline on the map
        this.directionsService = null; // Google Routes Service (newer API)
        this.directionsRenderer = null; // Google Directions Renderer
        this.goingDirectionsRenderer = null; // Blue renderer for outbound journey
        this.returnDirectionsRenderer = null; // Green renderer for return journey
        this.dataLoaded = false; // Flag to track if data is loaded
        
        // Rider management
        this.riders = {
            'A': { name: 'Rider A', status: 'available', currentOrder: null },
            'B': { name: 'Rider B', status: 'available', currentOrder: null },
            'C': { name: 'Rider C', status: 'available', currentOrder: null },
            'D': { name: 'Rider D', status: 'available', currentOrder: null },
            'E': { name: 'Rider E', status: 'available', currentOrder: null }
        };
        this.pendingRiderAssignment = null; // For modal workflow
        
        this.initializeApp();
        this.bindEvents();
        this.loadStoredData();
        this.startRiderStatusUpdater();
    }

    startRiderStatusUpdater() {
        // Update rider status every minute to keep timers current
        setInterval(() => {
            // Check all riders for 15-minute availability rule
            this.checkRiderAvailability();
            
            const modal = document.getElementById('riderAssignmentModal');
            if (modal && modal.style.display !== 'none') {
                this.updateRiderStatus();
            }
        }, 60000); // Update every minute
    }

    checkRiderAvailability() {
        const now = new Date();
        let updateNeeded = false;
        
        Object.keys(this.riders).forEach(riderId => {
            const rider = this.riders[riderId];
            
            // Check if busy rider should be made available (less than 15 minutes remaining)
            if (rider.status === 'busy' && rider.expectedFreeTime) {
                const timeDiff = rider.expectedFreeTime.getTime() - now.getTime();
                const minutesRemaining = Math.floor(timeDiff / (1000 * 60));
                
                // If less than 15 minutes remaining, make rider available
                if (minutesRemaining < 15) {
                    rider.status = 'available';
                    rider.currentOrder = null;
                    rider.expectedFreeTime = null;
                    updateNeeded = true;
                    
                    // Also update any orders assigned to this rider to mark them as delivered
                    this.orders.forEach(order => {
                        if (order.assignedRider === riderId && order.status === 'out_for_delivery') {
                            order.status = 'delivered';
                            order.deliveredAt = new Date();
                            delete order.expectedReturnTime;
                            this.updateOrderMarkerStyle(order);
                        }
                    });
                    
                    console.log(`Rider ${riderId} automatically made available (less than 15 minutes remaining)`);
                }
            }
        });
        
        if (updateNeeded) {
            this.saveOrdersToStorage();
            this.refreshAllDisplays();
        }
    }

    initializeApp() {
        // Set current date and time as default for order time input
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        document.getElementById('orderTime').value = localDateTime;
    }

    bindEvents() {
        console.log('Binding events...');
        
        // Order form submission
        document.getElementById('orderForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addNewOrder();
        });

        // Panel controls
        document.getElementById('refreshOrders').addEventListener('click', () => {
            this.refreshOrdersDisplay();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.getAttribute('data-tab'));
            });
        });

        // Add click handler for order cards to show route
        document.addEventListener('click', (e) => {
            const orderCard = e.target.closest('.order-card');
            if (orderCard && !e.target.closest('button')) {
                const orderId = orderCard.getAttribute('data-order-id');
                const order = this.orders.find(o => o.id === parseInt(orderId));
                if (order && this.pincodeData.has(order.customerPincode)) {
                    this.showRouteOnMap([order]);
                    this.showNotification(`Showing route to ${order.orderId}`, 'info');
                }
            }
        });

        const optimizeButton = document.getElementById('optimizeOrders');
        console.log('Optimize button found:', optimizeButton);
        
        optimizeButton.addEventListener('click', () => {
            console.log('Optimize button clicked');
            console.log('Batch checkbox element:', document.getElementById('enableBatching'));
            console.log('Batch enabled value:', document.getElementById('enableBatching')?.checked);
            
            try {
                this.optimizePickingOrder();
            } catch (error) {
                console.error('Error in optimizePickingOrder:', error);
                alert('Error occurred: ' + error.message);
            }
        });

        // Auto-fill coordinates when pincode is entered
        document.getElementById('customerPincode').addEventListener('blur', (e) => {
            this.autoFillCoordinates(e.target.value);
        });

        // Optimization mode selection
        document.querySelectorAll('input[name="optimization"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.optimizationMode = e.target.value;
                this.hideOptimizationResult();
            });
        });

        // Batch optimization toggle
        const batchToggle = document.getElementById('enableBatching');
        if (batchToggle) {
            batchToggle.addEventListener('change', (e) => {
                const batchSettings = document.getElementById('batchSettings');
                const optimizeButtonText = document.getElementById('optimizeButtonText');
                
                if (e.target.checked) {
                    batchSettings.style.display = 'block';
                    optimizeButtonText.textContent = 'Optimize Zone Batch';
                } else {
                    batchSettings.style.display = 'none';
                    optimizeButtonText.textContent = 'Get Next Order';
                }
                
                this.hideOptimizationResult();
            });
        }

        // Rider selection change
        const riderSelect = document.getElementById('riderSelect');
        if (riderSelect) {
            riderSelect.addEventListener('change', () => {
                this.updateRiderStatus();
            });
        }
    }

    // Tab switching functionality
    switchTab(tabName) {
        // Hide all tab contents
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        
        // Remove active class from all tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        // Show selected tab content
        const targetTab = document.getElementById(`${tabName}-tab`);
        if (targetTab) {
            targetTab.classList.add('active');
        }
        
        // Activate clicked tab button
        const targetBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (targetBtn) {
            targetBtn.classList.add('active');
        }
        
        // Update displays based on active tab
        if (tabName === 'queue') {
            this.refreshOrdersDisplay();
        } else if (tabName === 'delivery') {
            this.refreshDeliveryDisplay();
        }
    }

    // Method to show order on map when clicked
    showOrderOnMap(orderId) {
        const order = this.orders.find(o => o.id === parseInt(orderId));
        if (order) {
            // Center map on order location
            if (this.pincodeData.has(order.customerPincode)) {
                const coords = this.pincodeData.get(order.customerPincode);
                if (this.map) {
                    this.map.setCenter(coords);
                    this.map.setZoom(15);
                }
                
                // Show route to this order
                this.showRouteOnMap([order]);
                this.showNotification(`Showing route to ${order.orderId}`, 'info');
            }
        }
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.orderPickingTool = new OrderPickingTool();
});

// Google Maps callback
window.initMap = function() {
    console.log('Google Maps API loaded');
    if (window.orderPickingTool) {
        window.orderPickingTool.initializeMap();
    } else {
        // If orderPickingTool isn't ready yet, wait for it
        const checkTool = setInterval(() => {
            if (window.orderPickingTool) {
                clearInterval(checkTool);
                window.orderPickingTool.initializeMap();
            }
        }, 100);
    }
};
