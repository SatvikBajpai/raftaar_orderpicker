// Order Picking Tool - Main JavaScript
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
        
        // Add a test order for debugging
        this.addTestOrder();
        
        this.initializeApp();
        this.bindEvents();
        this.loadStoredData();
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
    }

    async autoFillCoordinates(pincode) {
        if (!pincode || pincode.length !== 6) return;

        try {
            // Check cache first
            if (this.pincodeData.has(pincode)) {
                return;
            }

            // Use Google Geocoding API to get real coordinates
            if (window.google && window.google.maps.Geocoder) {
                const geocoder = new google.maps.Geocoder();
                const request = {
                    address: `${pincode}, India`,
                    componentRestrictions: {
                        country: 'IN'
                    }
                };

                geocoder.geocode(request, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const location = results[0].geometry.location;
                        const coords = {
                            lat: location.lat(),
                            lng: location.lng()
                        };
                        
                        console.log(`Geocoded pincode ${pincode}:`, coords);
                        this.pincodeData.set(pincode, coords);
                        
                        // Update the specific order if it exists
                        const order = this.orders.find(o => o.customerPincode === pincode);
                        if (order && !order.distance) {
                            order.distance = this.calculateDistance(
                                this.storeLocation.lat, this.storeLocation.lng,
                                coords.lat, coords.lng
                            );
                            this.saveOrdersToStorage();
                            this.refreshOrdersDisplay();
                        }
                    } else {
                        console.log('Geocoding failed for pincode:', pincode, 'Status:', status);
                    }
                });
            }
        } catch (error) {
            console.log('Could not fetch coordinates for pincode:', pincode, error);
        }
    }

    // Remove hardcoded getApproximateCoordinates method - now using Google Geocoding API

    addNewOrder() {
        const formData = {
            orderId: document.getElementById('orderId').value,
            orderTime: new Date(document.getElementById('orderTime').value),
            customerPincode: document.getElementById('customerPincode').value
        };

        // Validation
        if (!formData.orderId || !formData.customerPincode) {
            alert('Please fill in all required fields');
            return;
        }

        // Check if order ID already exists
        if (this.orders.find(order => order.orderId === formData.orderId)) {
            alert('Order ID already exists');
            return;
        }

        // Calculate SLA deadline
        const slaDeadline = this.calculateSLADeadline(formData.orderTime);

        // Create order object (distance will be calculated after geocoding)
        const order = {
            ...formData,
            id: Date.now(), // Unique ID
            distance: null, // Will be calculated after geocoding
            slaDeadline: slaDeadline,
            status: 'pending',
            addedAt: new Date(),
            priority: 50 // Default priority, will be recalculated after distance is known
        };

        this.orders.push(order);
        
        // Trigger geocoding for this pincode
        this.autoFillCoordinates(formData.customerPincode).then(() => {
            // After geocoding, calculate distance and update order
            const coords = this.pincodeData.get(formData.customerPincode);
            if (coords) {
                const distance = this.calculateDistance(
                    this.storeLocation.lat, this.storeLocation.lng,
                    coords.lat, coords.lng
                );
                
                // Update the order with distance and recalculated priority
                const orderIndex = this.orders.findIndex(o => o.id === order.id);
                if (orderIndex !== -1) {
                    this.orders[orderIndex].distance = distance;
                    this.orders[orderIndex].priority = this.calculatePriority(
                        formData.orderTime, slaDeadline, distance
                    );
                    
                    this.saveOrdersToStorage();
                    this.refreshOrdersDisplay();
                    this.addOrderToMap(this.orders[orderIndex]);
                }
            }
        });
        
        this.saveOrdersToStorage();
        this.refreshOrdersDisplay();
        this.clearOrderForm();
        
        this.showNotification(`Order ${order.orderId} added! Fetching location data...`, 'success');
    }

    calculateDistance(lat1, lng1, lat2, lng2) {
        // Haversine formula for calculating distance between two points
        const R = 6371; // Earth's radius in kilometers
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = R * c;
        
        return Math.round(distance * 100) / 100; // Round to 2 decimal places
    }

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    }

    calculateSLADeadline(orderTime) {
        const orderHour = orderTime.getHours();
        const orderDate = new Date(orderTime);
        
        if (orderHour < 10) {
            // Orders before 10 AM should be delivered by 12 PM same day
            const deadline = new Date(orderDate);
            deadline.setHours(12, 0, 0, 0);
            return deadline;
        } else if (orderHour < 18) {
            // Orders between 10 AM and 6 PM have 2-hour SLA
            const deadline = new Date(orderTime);
            deadline.setHours(deadline.getHours() + 2);
            return deadline;
        } else {
            // Orders after 6 PM are delivered next day by 12 PM
            const deadline = new Date(orderDate);
            deadline.setDate(deadline.getDate() + 1);
            deadline.setHours(12, 0, 0, 0);
            return deadline;
        }
    }

    calculatePriority(orderTime, slaDeadline, distance) {
        const now = new Date();
        const timeToDeadline = slaDeadline.getTime() - now.getTime();
        const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
        
        // Check if this is a next-day order
        const isNextDay = slaDeadline.getDate() > orderTime.getDate();
        
        if (isNextDay) {
            // Next day orders have lower priority
            return 10;
        }
        
        // Base priority calculation for same-day orders
        let priority = 0;
        
        // Time urgency (higher priority for less time remaining)
        if (hoursToDeadline <= 0.5) {
            priority += 100; // Critical
        } else if (hoursToDeadline <= 1) {
            priority += 80; // High priority
        } else if (hoursToDeadline <= 1.5) {
            priority += 60; // Medium-high priority
        } else {
            priority += 40; // Normal priority
        }
        
        // Distance factor (closer orders get slight priority boost)
        if (distance) {
            priority += Math.max(0, 20 - distance); // Up to 20 points for close orders
        }
        
        return Math.round(priority);
    }

    getPriorityLevel(orderTime, slaDeadline) {
        const now = new Date();
        const timeToDeadline = slaDeadline.getTime() - now.getTime();
        const hoursToDeadline = timeToDeadline / (1000 * 60 * 60);
        
        // Check if this is a next-day order
        const isNextDay = slaDeadline.getDate() > orderTime.getDate();
        
        if (isNextDay) {
            return 'next-day';
        }
        
        if (hoursToDeadline <= 0) {
            return 'overdue';
        } else if (hoursToDeadline <= 1) {
            return 'high-priority';
        } else {
            return 'normal';
        }
    }

    refreshOrdersDisplay() {
        this.updateStatistics();
        this.renderOrdersList();
        this.updateMapMarkers();
    }

    updateStatistics() {
        const stats = {
            highPriority: 0,
            normal: 0,
            nextDay: 0
        };

        this.orders.forEach(order => {
            const level = this.getPriorityLevel(order.orderTime, order.slaDeadline);
            if (level === 'high-priority' || level === 'overdue') {
                stats.highPriority++;
            } else if (level === 'next-day') {
                stats.nextDay++;
            } else {
                stats.normal++;
            }
        });

        document.getElementById('highPriorityCount').textContent = stats.highPriority;
        document.getElementById('normalCount').textContent = stats.normal;
        document.getElementById('nextDayCount').textContent = stats.nextDay;
    }

    renderOrdersList() {
        const container = document.getElementById('ordersList');
        
        if (this.orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No orders in queue. Add an order to get started.</p>
                </div>
            `;
            return;
        }

        // Sort orders by priority (highest first)
        const sortedOrders = [...this.orders].sort((a, b) => b.priority - a.priority);

        container.innerHTML = sortedOrders.map(order => {
            const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
            const timeRemaining = this.formatTimeRemaining(order.slaDeadline);
            const statusClass = this.getStatusClass(order.status);
            const statusIcon = this.getStatusIcon(order.status);
            const statusLabel = this.getStatusLabel(order.status);
            
            return `
                <div class="order-card ${priorityLevel} ${statusClass}" data-order-id="${order.id}">
                    <div class="order-header">
                        <span class="order-id">${order.orderId}</span>
                        <div class="order-actions">
                            <span class="priority-badge ${priorityLevel}">${priorityLevel.replace('-', ' ')}</span>
                            <span class="status-badge ${statusClass}">${statusIcon} ${statusLabel}</span>
                            ${this.renderOrderActionButtons(order)}
                        </div>
                    </div>
                    <div class="order-details">
                        <div><strong>📍 Pincode:</strong> ${order.customerPincode}</div>
                        <div><strong>🕐 Order Time:</strong> ${this.formatTime(order.orderTime)}</div>
                        <div><strong>⏰ SLA Deadline:</strong> ${this.formatTime(order.slaDeadline)}</div>
                        <div><strong>⭐ Priority:</strong> ${order.priority}</div>
                        ${order.status !== 'pending' ? `<div><strong>📊 Status:</strong> ${statusLabel}</div>` : ''}
                    </div>
                    <div class="order-meta">
                        <span class="distance">
                            <i class="fas fa-route"></i> 
                            ${order.distance ? `${order.distance} km` : 'Distance unknown'}
                        </span>
                        <span class="time-remaining ${this.getTimeRemainingClass(order.slaDeadline)}">
                            <i class="fas fa-clock"></i> ${timeRemaining}
                        </span>
                    </div>
                </div>
            `;
        }).join('');
    }

    getStatusClass(status) {
        const statusClasses = {
            'pending': 'status-pending',
            'selected': 'status-selected',
            'out_for_delivery': 'status-out-for-delivery',
            'delivered': 'status-delivered',
            'cancelled': 'status-cancelled'
        };
        return statusClasses[status] || 'status-pending';
    }

    getStatusIcon(status) {
        const statusIcons = {
            'pending': '⏳',
            'selected': '📋',
            'out_for_delivery': '🚚',
            'delivered': '✅',
            'cancelled': '❌'
        };
        return statusIcons[status] || '⏳';
    }

    getStatusLabel(status) {
        const statusLabels = {
            'pending': 'Pending',
            'selected': 'Selected for Delivery',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return statusLabels[status] || 'Pending';
    }

    renderOrderActionButtons(order) {
        switch (order.status) {
            case 'pending':
                return `
                    <button class="btn-action btn-select" onclick="orderPickingTool.markOrderAsSelected('${order.id}')" title="Select for Delivery">
                        <i class="fas fa-hand-pointer"></i>
                    </button>
                    <button class="btn-action btn-remove" onclick="orderPickingTool.removeOrder('${order.id}')" title="Remove Order">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            case 'selected':
                return `
                    <button class="btn-action btn-start-delivery" onclick="orderPickingTool.startDelivery('${order.id}')" title="Start Delivery">
                        <i class="fas fa-truck"></i>
                    </button>
                    <button class="btn-action btn-cancel-selection" onclick="orderPickingTool.cancelSelection('${order.id}')" title="Cancel Selection">
                        <i class="fas fa-undo"></i>
                    </button>
                `;
            case 'out_for_delivery':
                return `
                    <button class="btn-action btn-deliver" onclick="orderPickingTool.markOrderAsDelivered('${order.id}')" title="Mark as Delivered">
                        <i class="fas fa-check"></i>
                    </button>
                    <button class="btn-action btn-cancel-delivery" onclick="orderPickingTool.cancelDelivery('${order.id}')" title="Cancel Delivery">
                        <i class="fas fa-undo"></i>
                    </button>
                `;
            case 'delivered':
                return `
                    <button class="btn-action btn-remove" onclick="orderPickingTool.removeOrder('${order.id}')" title="Remove from List">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
            default:
                return `
                    <button class="btn-action btn-remove" onclick="orderPickingTool.removeOrder('${order.id}')" title="Remove Order">
                        <i class="fas fa-trash"></i>
                    </button>
                `;
        }
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    formatTimeRemaining(deadline) {
        const now = new Date();
        const diff = deadline.getTime() - now.getTime();
        
        if (diff <= 0) {
            return 'OVERDUE';
        }
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours >= 24) {
            const days = Math.floor(hours / 24);
            return `${days} day${days > 1 ? 's' : ''} remaining`;
        } else if (hours > 0) {
            return `${hours}h ${minutes}m remaining`;
        } else {
            return `${minutes}m remaining`;
        }
    }

    getTimeRemainingClass(deadline) {
        const now = new Date();
        const diff = deadline.getTime() - now.getTime();
        const hoursRemaining = diff / (1000 * 60 * 60);
        
        if (hoursRemaining <= 0) {
            return 'urgent';
        } else if (hoursRemaining <= 0.5) {
            return 'urgent';
        } else if (hoursRemaining <= 1) {
            return 'warning';
        } else {
            return 'safe';
        }
    }

    optimizePickingOrder() {
        console.log('optimizePickingOrder called');
        console.log('Orders array:', this.orders);
        
        const pendingOrders = this.orders.filter(order => order.status === 'pending');
        console.log('Pending orders:', pendingOrders);
        
        if (pendingOrders.length === 0) {
            console.log('No pending orders found');
            this.displayOptimizationResult('No pending orders to optimize.');
            return;
        }

        const strategy = document.querySelector('input[name="optimization"]:checked')?.value;
        const enableBatchingElement = document.getElementById('enableBatching');
        const isBatchEnabled = enableBatchingElement?.checked || false;
        
        console.log('Strategy:', strategy);
        console.log('Batch element found:', !!enableBatchingElement);
        console.log('Batch enabled:', isBatchEnabled);
        
        if (isBatchEnabled) {
            console.log('Running batch optimization...');
            
            const maxOrdersElement = document.getElementById('max-orders-per-batch');
            const maxDistanceElement = document.getElementById('max-distance-from-store');
            
            console.log('Max orders element:', maxOrdersElement);
            console.log('Max distance element:', maxDistanceElement);
            
            if (!maxOrdersElement || !maxDistanceElement) {
                console.error('Batch settings elements not found!');
                this.displayOptimizationResult('Batch settings not properly configured.');
                return;
            }
            
            const maxOrders = parseInt(maxOrdersElement.value);
            const maxDistance = parseInt(maxDistanceElement.value);
            
            console.log('Batch settings - maxOrders:', maxOrders, 'maxDistance:', maxDistance);
            
            try {
                const batches = this.optimizeBatch(maxOrders, maxDistance, strategy);
                console.log('Generated batches:', batches);
                this.displayBatchResults(batches);
            } catch (batchError) {
                console.error('Error in batch optimization:', batchError);
                this.displayOptimizationResult('Error during batch optimization: ' + batchError.message);
            }
        } else {
            console.log('Running single order optimization...');
            // Filter out orders that don't have distance calculated
            const validOrders = pendingOrders.filter(order => order.distance);
            
            if (validOrders.length === 0) {
                this.displayOptimizationResult('No valid orders with distance information available');
                return;
            }

            let recommendedOrder;
            let reason;

            if (strategy === 'maximize_orders') {
                recommendedOrder = this.findClosestOrder(validOrders);
                reason = 'Selected closest order to maximize delivery count';
                this.displayOptimizationResult(recommendedOrder, reason);
            } else if (strategy === 'maximize_sla') {
                recommendedOrder = this.findBestSLAOrder(validOrders);
                reason = 'Selected order with best SLA compliance opportunity';
                this.displayOptimizationResult(recommendedOrder, reason);
            }
        }
    }

    findClosestOrder(orders) {
        // Simply return the order with minimum distance
        return orders.reduce((closest, current) => {
            return current.distance < closest.distance ? current : closest;
        });
    }

    findBestSLAOrder(orders) {
        const now = new Date();
        
        // Calculate delivery estimates for each order
        const ordersWithEstimates = orders.map(order => {
            const deliveryTime = this.calculateDeliveryTime(order.distance);
            const estimatedDelivery = new Date(now.getTime() + deliveryTime * 60 * 60 * 1000);
            const willMeetSLA = estimatedDelivery <= order.slaDeadline;
            const timeToDeadline = (order.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            return {
                ...order,
                deliveryTime,
                estimatedDelivery,
                willMeetSLA,
                timeToDeadline,
                slaBuffer: timeToDeadline - deliveryTime // How much buffer time after delivery
            };
        });

        // Filter orders that can meet SLA
        const meetableSLAOrders = ordersWithEstimates.filter(order => order.willMeetSLA);
        
        if (meetableSLAOrders.length === 0) {
            // If no orders can meet SLA, pick the one with least time overrun
            return ordersWithEstimates.reduce((best, current) => {
                const bestOverrun = best.deliveryTime - best.timeToDeadline;
                const currentOverrun = current.deliveryTime - current.timeToDeadline;
                return currentOverrun < bestOverrun ? current : best;
            });
        }

        // Among meetable orders, pick the one with least SLA buffer (most urgent but still meetable)
        return meetableSLAOrders.reduce((best, current) => {
            return current.slaBuffer < best.slaBuffer ? current : best;
        });
    }

    calculateDeliveryTime(distance) {
        // Base delivery time calculation
        const travelTime = distance / this.averageSpeed; // Travel time in hours
        const preparationTime = 0.25; // 15 minutes preparation time
        const deliveryTime = 0.17; // 10 minutes delivery time
        
        return travelTime + preparationTime + deliveryTime;
    }

    displayOptimizationResult(orderOrMessage, reason) {
        const resultPanel = document.getElementById('optimizationResult');
        const orderContainer = document.getElementById('recommendedOrder');
        
        // Handle string messages (like "No orders found")
        if (typeof orderOrMessage === 'string') {
            orderContainer.innerHTML = `
                <div class="no-orders-message">
                    <i class="fas fa-info-circle"></i>
                    <p>${orderOrMessage}</p>
                </div>
            `;
            resultPanel.classList.remove('hidden');
            return;
        }
        
        // Handle order objects
        const order = orderOrMessage;
        const deliveryTime = this.calculateDeliveryTime(order.distance);
        const now = new Date();
        const estimatedDelivery = new Date(now.getTime() + deliveryTime * 60 * 60 * 1000);
        const willMeetSLA = estimatedDelivery <= order.slaDeadline;
        
        orderContainer.innerHTML = `
            <div class="order-info">
                <div><strong>Order ID:</strong> ${order.orderId}</div>
                <div><strong>Pincode:</strong> ${order.customerPincode}</div>
                <div><strong>Distance:</strong> ${order.distance} km</div>
                <div><strong>Priority:</strong> ${order.priority}</div>
                <div><strong>SLA Deadline:</strong> ${this.formatTime(order.slaDeadline)}</div>
                <div><strong>Current Time:</strong> ${this.formatTime(now)}</div>
            </div>
            <div class="delivery-estimate">
                🚛 Estimated Delivery: ${this.formatTime(estimatedDelivery)}<br>
                ⏱️ Total Time: ${this.formatDuration(deliveryTime)}<br>
                ${willMeetSLA ? 
                    '<span style="color: #10b981;">✅ Will Meet SLA</span>' : 
                    '<span style="color: #ef4444;">⚠️ May Miss SLA</span>'
                }
            </div>
            <div class="optimization-reason">
                💡 ${reason}
            </div>
            <div class="order-actions-panel">
                <button class="btn btn-select-order" onclick="orderPickingTool.markOrderAsSelected('${order.id}')">
                    <i class="fas fa-hand-pointer"></i> Select for Delivery
                </button>
                <button class="btn btn-start-delivery" onclick="orderPickingTool.startDelivery('${order.id}')">
                    <i class="fas fa-truck"></i> Start Delivery Now
                </button>
            </div>
        `;
        
        resultPanel.classList.remove('hidden');
        
        // Highlight the recommended order
        this.highlightRecommendedOrder(order.id);
    }

    formatDuration(hours) {
        const totalMinutes = Math.round(hours * 60);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        if (hrs > 0) {
            return `${hrs}h ${mins}m`;
        } else {
            return `${mins}m`;
        }
    }

    hideOptimizationResult() {
        document.getElementById('optimizationResult').classList.add('hidden');
        this.removeHighlights();
        this.clearOrderHighlights(); // Also clear batch highlights and routes
    }

    highlightRecommendedOrder(orderId) {
        // Remove previous highlights
        this.removeHighlights();
        
        // Highlight on map
        const markerData = this.orderMarkers.get(parseInt(orderId));
        if (markerData) {
            markerData.marker.setAnimation(google.maps.Animation.BOUNCE);
            markerData.marker.setZIndex(1000);
        }
        
        // Highlight in list
        const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderCard) {
            orderCard.classList.add('recommended-highlight');
            orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    removeHighlights() {
        // Remove map highlights
        this.orderMarkers.forEach(markerData => {
            markerData.marker.setAnimation(null);
            markerData.marker.setZIndex(null);
        });
        
        // Remove list highlights
        document.querySelectorAll('.recommended-highlight').forEach(card => {
            card.classList.remove('recommended-highlight');
        });
    }

    markOrderAsSelected(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Update order status
            this.orders[orderIndex].status = 'selected';
            this.orders[orderIndex].selectedAt = new Date();
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshOrdersDisplay();
            this.updateOrderMarkerStyle(order);
            
            this.showNotification(`Order ${order.orderId} selected for delivery! 📋`, 'success');
        }
    }

    startDelivery(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Update order status
            this.orders[orderIndex].status = 'out_for_delivery';
            this.orders[orderIndex].deliveryStartedAt = new Date();
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshOrdersDisplay();
            this.updateOrderMarkerStyle(order);
            
            this.showNotification(`Delivery started for order ${order.orderId}! 🚚`, 'success');
        }
    }

    cancelSelection(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Reset to pending status
            this.orders[orderIndex].status = 'pending';
            delete this.orders[orderIndex].selectedAt;
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshOrdersDisplay();
            this.updateOrderMarkerStyle(order);
            
            this.showNotification(`Selection cancelled for order ${order.orderId}`, 'info');
        }
    }

    cancelDelivery(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Reset to selected status
            this.orders[orderIndex].status = 'selected';
            delete this.orders[orderIndex].deliveryStartedAt;
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshOrdersDisplay();
            this.updateOrderMarkerStyle(order);
            
            this.showNotification(`Delivery cancelled for order ${order.orderId}`, 'info');
        }
    }

    updateOrderMarkerStyle(order) {
        const markerData = this.orderMarkers.get(order.id);
        if (markerData && markerData.marker) {
            const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
            let markerColor = this.getMarkerColor(priorityLevel);
            
            // Override color based on status
            switch (order.status) {
                case 'selected':
                    markerColor = '#3b82f6'; // Blue
                    break;
                case 'out_for_delivery':
                    markerColor = '#10b981'; // Green
                    break;
                case 'delivered':
                    markerColor = '#6b7280'; // Gray
                    break;
                default:
                    // Keep original priority color
                    break;
            }
            
            markerData.marker.setIcon(this.createMarkerIcon(markerColor, order.priority));
            markerData.infoWindow.setContent(this.generateInfoWindowContent(order));
        }
    }

    markOrderAsPicked(orderId) {
        // This is now just an alias for marking as delivered
        this.markOrderAsDelivered(orderId);
    }

    markOrderAsDelivered(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Ask for confirmation
            if (confirm(`Mark order ${order.orderId} as delivered?`)) {
                // Update order status to delivered
                this.orders[orderIndex].status = 'delivered';
                this.orders[orderIndex].deliveredAt = new Date();
                
                // Remove from map
                const markerData = this.orderMarkers.get(parseInt(orderId));
                if (markerData) {
                    markerData.marker.setMap(null);
                    this.orderMarkers.delete(parseInt(orderId));
                }
                
                // Remove from active orders display but keep in storage for history
                this.orders.splice(orderIndex, 1);
                
                // Update displays
                this.saveOrdersToStorage();
                this.refreshOrdersDisplay();
                this.hideOptimizationResult();
                
                this.showNotification(`Order ${order.orderId} marked as delivered! 🎉`, 'success');
            }
        }
    }

    removeOrder(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Ask for confirmation
            if (confirm(`Remove order ${order.orderId}? This action cannot be undone.`)) {
                // Remove from orders array
                this.orders.splice(orderIndex, 1);
                
                // Remove from map
                const markerData = this.orderMarkers.get(parseInt(orderId));
                if (markerData) {
                    markerData.marker.setMap(null);
                    this.orderMarkers.delete(parseInt(orderId));
                }
                
                // Update displays
                this.saveOrdersToStorage();
                this.refreshOrdersDisplay();
                this.hideOptimizationResult();
                
                this.showNotification(`Order ${order.orderId} removed from queue`, 'info');
            }
        }
    }

    clearOrderForm() {
        document.getElementById('orderForm').reset();
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        document.getElementById('orderTime').value = localDateTime;
    }

    saveOrdersToStorage() {
        localStorage.setItem('orders', JSON.stringify(this.orders));
    }

    loadStoredData() {
        // Load orders
        const storedOrders = localStorage.getItem('orders');
        if (storedOrders) {
            this.orders = JSON.parse(storedOrders).map(order => ({
                ...order,
                orderTime: new Date(order.orderTime),
                slaDeadline: new Date(order.slaDeadline),
                addedAt: new Date(order.addedAt)
            }));
            this.refreshOrdersDisplay();
            
            // Initialize map after loading orders
            if (window.google) {
                this.initializeMap();
            }
        }
    }

    showNotification(message, type = 'info') {
        // Create a simple notification system
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'info-circle'}"></i>
            ${message}
        `;
        
        // Add notification styles if not already present
        if (!document.querySelector('.notification-styles')) {
            const style = document.createElement('style');
            style.className = 'notification-styles';
            style.innerHTML = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 15px 20px;
                    border-radius: 8px;
                    color: white;
                    font-weight: 600;
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    animation: slideInRight 0.3s ease-out;
                }
                .notification.success {
                    background: linear-gradient(135deg, #1e40af 0%, #dc2626 100%);
                }
                .notification.info {
                    background: linear-gradient(135deg, #1e40af 0%, #dc2626 100%);
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    initializeMap() {
        if (!window.google) {
            console.log('Google Maps API not loaded yet');
            return;
        }

        this.map = new google.maps.Map(document.getElementById('map'), {
            zoom: 12,
            center: this.storeLocation,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            styles: [
                {
                    featureType: "poi",
                    elementType: "labels",
                    stylers: [{ visibility: "off" }]
                }
            ]
        });

        // Initialize Directions Service and Renderer for actual road routes
        // Using the newer Routes API instead of legacy DirectionsService
        if (window.google && window.google.maps.DirectionsService) {
            this.directionsService = new google.maps.DirectionsService();
            this.directionsRenderer = new google.maps.DirectionsRenderer({
                suppressMarkers: true, // We'll use our own custom markers
                polylineOptions: {
                    strokeColor: '#f59e0b',
                    strokeOpacity: 0.8,
                    strokeWeight: 6
                }
            });
            this.directionsRenderer.setMap(this.map);
            console.log('Google Directions API initialized');
        } else {
            console.log('Google Directions API not available yet');
        }

        // Add store marker
        this.storeMarker = new google.maps.Marker({
            position: this.storeLocation,
            map: this.map,
            title: 'Raftaar Store - Distribution Center',
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="#1e40af" stroke="#ffffff" stroke-width="4"/>
                        <path d="M30 35 L70 35 L65 45 L35 45 Z" fill="#ffffff"/>
                        <rect x="35" y="45" width="30" height="20" fill="#ffffff"/>
                        <rect x="45" y="55" width="10" height="10" fill="#1e40af"/>
                        <text x="50" y="80" text-anchor="middle" fill="#ffffff" font-size="8" font-weight="bold">STORE</text>
                    </svg>
                `),
                scaledSize: new google.maps.Size(50, 50),
                anchor: new google.maps.Point(25, 25)
            },
            zIndex: 1000
        });

        const storeInfoWindow = new google.maps.InfoWindow({
            content: `
                <div class="info-window">
                    <div class="info-window-header">🏪 Raftaar Distribution Center</div>
                    <div class="info-window-details">
                        <div><strong>Status:</strong> <span style="color: #16a34a;">🟢 Active</span></div>
                        <div><strong>Location:</strong> Nagpur, Maharashtra</div>
                        <div><strong>Coordinates:</strong> ${this.storeLocation.lat.toFixed(6)}, ${this.storeLocation.lng.toFixed(6)}</div>
                        <div><strong>Active Orders:</strong> <span id="store-order-count">${this.orders.length}</span></div>
                    </div>
                </div>
            `
        });

        this.storeMarker.addListener('click', () => {
            storeInfoWindow.open(this.map, this.storeMarker);
        });

        // Load existing orders on map
        this.orders.forEach(order => {
            this.addOrderToMap(order);
        });
    }

    addOrderToMap(order) {
        console.log('Adding order to map:', order);
        
        if (!this.map) {
            console.log('Map not initialized yet');
            return;
        }
        
        if (!order.distance) {
            console.log('Order has no distance calculated yet');
            return;
        }

        const coords = this.pincodeData.get(order.customerPincode);
        if (!coords) {
            console.log('No coordinates found for pincode:', order.customerPincode);
            return;
        }

        console.log('Creating marker for order:', order.orderId, 'at coordinates:', coords);

        const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
        const markerColor = this.getMarkerColor(priorityLevel);
        
        const marker = new google.maps.Marker({
            position: { lat: coords.lat, lng: coords.lng },
            map: this.map,
            title: `Order ${order.orderId} - ${priorityLevel.replace('-', ' ').toUpperCase()}`,
            icon: this.createMarkerIcon(markerColor, order.priority),
            zIndex: 100 // Ensure markers appear above other elements
        });

        const infoWindow = new google.maps.InfoWindow({
            content: this.generateInfoWindowContent(order)
        });

        marker.addListener('click', () => {
            // Close other info windows
            this.orderMarkers.forEach((data) => {
                if (data.infoWindow) {
                    data.infoWindow.close();
                }
            });
            infoWindow.open(this.map, marker);
        });

        this.orderMarkers.set(order.id, { marker, infoWindow, order });
        console.log('Marker added to orderMarkers map with ID:', order.id);
        console.log('Total markers now:', this.orderMarkers.size);

        // Update info window content every minute
        setInterval(() => {
            infoWindow.setContent(this.generateInfoWindowContent(order));
        }, 60000);
    }

    generateInfoWindowContent(order) {
        const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
        const timeRemaining = this.formatTimeRemaining(order.slaDeadline);
        const isUrgent = priorityLevel === 'high-priority' || priorityLevel === 'overdue';
        
        return `
            <div class="info-window">
                <div class="info-window-header">📦 Order ${order.orderId}</div>
                <div class="info-window-details">
                    <div><strong>📍 Pincode:</strong> ${order.customerPincode}</div>
                    <div><strong>📏 Distance:</strong> ${order.distance ? `${order.distance} km` : 'Calculating...'}</div>
                    <div><strong>⭐ Priority Score:</strong> ${order.priority}</div>
                    <div><strong>🕐 Order Time:</strong> ${this.formatTime(order.orderTime)}</div>
                    <div><strong>⏰ SLA Deadline:</strong> ${this.formatTime(order.slaDeadline)}</div>
                    <div class="sla-timer ${isUrgent ? 'urgent' : ''}">
                        ${isUrgent ? '🚨' : '⏱️'} ${timeRemaining}
                    </div>
                    <div style="margin-top: 8px; font-size: 12px; color: #666;">
                        Click to track this order
                    </div>
                </div>
            </div>
        `;
    }

    getMarkerColor(priorityLevel) {
        switch (priorityLevel) {
            case 'high-priority':
            case 'overdue':
                return '#dc2626'; // Red
            case 'normal':
                return '#1e40af'; // Blue
            case 'next-day':
                return '#64748b'; // Gray
            default:
                return '#1e40af';
        }
    }

    createMarkerIcon(color, priority) {
        const svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
                <path d="M20 5 C12 5 5 12 5 20 C5 32 20 45 20 45 S35 32 35 20 C35 12 28 5 20 5 Z" 
                      fill="${color}" stroke="#ffffff" stroke-width="2"/>
                <circle cx="20" cy="20" r="8" fill="#ffffff"/>
                <text x="20" y="25" text-anchor="middle" fill="${color}" font-size="12" font-weight="bold">${priority}</text>
            </svg>
        `;
        
        return {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svgContent),
            scaledSize: new google.maps.Size(40, 50),
            anchor: new google.maps.Point(20, 45)
        };
    }

    updateMapMarkers() {
        this.orderMarkers.forEach((data, orderId) => {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
                const markerColor = this.getMarkerColor(priorityLevel);
                
                // Update marker color and animation
                data.marker.setIcon(this.createMarkerIcon(markerColor, order.priority));
                
                // Add animation for urgent orders
                if (priorityLevel === 'high-priority' || priorityLevel === 'overdue') {
                    data.marker.setAnimation(google.maps.Animation.BOUNCE);
                } else {
                    data.marker.setAnimation(null);
                }
                
                // Update info window content
                data.infoWindow.setContent(this.generateInfoWindowContent(order));
            }
        });
    }
    
    // Batch optimization method
    optimizeBatch(maxOrdersPerBatch, maxDistanceFromStore, strategy = 'maximize_orders') {
        console.log('optimizeBatch called with:', { maxOrdersPerBatch, maxDistanceFromStore, strategy });
        
        try {
            if (this.orders.length === 0) {
                console.log('No orders available');
                return [];
            }
            
            const availableOrders = this.orders.filter(order => order.status === 'pending');
            console.log('Available orders for batching:', availableOrders);
            
            if (availableOrders.length === 0) {
                console.log('No pending orders available');
                return [];
            }

            // Ensure all orders have coordinates
            const ordersWithCoords = availableOrders.map(order => {
                const coords = this.pincodeData.get(order.customerPincode);
                return {
                    ...order,
                    lat: coords ? coords.lat : null,
                    lng: coords ? coords.lng : null
                };
            }).filter(order => order.lat && order.lng && order.distance <= maxDistanceFromStore);

            console.log('Orders with coordinates and within distance:', ordersWithCoords);

            if (ordersWithCoords.length === 0) {
                console.log('No orders found with valid coordinates within distance limit');
                return [];
            }

            // Create batches - for now, simple approach
            const batches = [];
            let currentBatch = [];
            
            // Sort orders by strategy
            let sortedOrders;
            if (strategy === 'maximize_sla') {
                sortedOrders = ordersWithCoords.sort((a, b) => {
                    const aMinutes = this.getSLAMinutesLeft(a);
                    const bMinutes = this.getSLAMinutesLeft(b);
                    return aMinutes - bMinutes; // Most urgent first
                });
            } else {
                sortedOrders = ordersWithCoords.sort((a, b) => a.distance - b.distance); // Closest first
            }
            
            for (const order of sortedOrders) {
                if (currentBatch.length < maxOrdersPerBatch) {
                    currentBatch.push(order);
                } else {
                    batches.push([...currentBatch]);
                    currentBatch = [order];
                }
            }
            
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }
            
            console.log('Generated batches:', batches);
            return batches;
            
        } catch (error) {
            console.error('Error in optimizeBatch:', error);
            throw error;
        }
    }
    
    // Optimize route within a single batch
    optimizeRouteWithinBatch(batchOrders, strategy = 'maximize_orders') {
        if (batchOrders.length <= 1) return batchOrders;
        
        const route = [];
        const remaining = [...batchOrders];
        
        // Start with the order that makes most sense based on strategy
        let current;
        if (strategy === 'maximize_sla') {
            // Start with most urgent SLA order
            current = remaining.reduce((mostUrgent, order) => 
                order.slaMinutesLeft < mostUrgent.slaMinutesLeft ? order : mostUrgent
            );
        } else {
            // Start with the order closest to store
            current = remaining.reduce((closest, order) => 
                order.distanceFromStore < closest.distanceFromStore ? order : closest
            );
        }
        
        route.push(current);
        remaining.splice(remaining.indexOf(current), 1);
        
        // Build route using nearest neighbor approach
        while (remaining.length > 0) {
            const next = remaining.reduce((nearest, order) => {
                const distanceToCurrent = this.calculateDistance(
                    current.lat, current.lng, order.lat, order.lng
                );
                const distanceToNearest = this.calculateDistance(
                    current.lat, current.lng, nearest.lat, nearest.lng
                );
                return distanceToCurrent < distanceToNearest ? order : nearest;
            });
            
            route.push(next);
            remaining.splice(remaining.indexOf(next), 1);
            current = next;
        }
        
        return route;
    }
    
    // Calculate batch metrics
    calculateBatchMetrics(batch) {
        if (batch.length === 0) return { totalDistance: 0, estimatedTime: 0, slaRisk: 0 };
        
        try {
            // Ensure all orders have required properties
            const validOrders = batch.filter(order => order.lat && order.lng && order.distance);
            if (validOrders.length === 0) {
                return { totalDistance: 0, estimatedTime: 0, slaRisk: 0 };
            }
            
            let totalDistance = validOrders[0].distance || 0; // Distance from store to first order
            
            // Add distances between consecutive orders
            for (let i = 0; i < validOrders.length - 1; i++) {
                const dist = this.calculateDistance(
                    validOrders[i].lat, validOrders[i].lng,
                    validOrders[i + 1].lat, validOrders[i + 1].lng
                );
                totalDistance += dist;
            }
            
            // Add return distance to store
            const lastOrder = validOrders[validOrders.length - 1];
            const returnDistance = this.calculateDistance(
                lastOrder.lat, lastOrder.lng,
                this.storeLocation.lat, this.storeLocation.lng
            );
            totalDistance += returnDistance;
            
            const estimatedTime = (totalDistance / 25) * 60; // minutes at 25 km/h
            
            // Calculate SLA risk (orders that might breach SLA)
            const ordersAtRisk = validOrders.filter(order => {
                const slaMinutes = this.getSLAMinutesLeft(order);
                return slaMinutes < estimatedTime;
            }).length;
            const slaRisk = validOrders.length > 0 ? (ordersAtRisk / validOrders.length) * 100 : 0;
            
            return {
                totalDistance: Math.round(totalDistance * 100) / 100,
                estimatedTime: Math.round(estimatedTime),
                slaRisk: Math.round(slaRisk)
            };
        } catch (error) {
            console.error('Error calculating batch metrics:', error);
            return { totalDistance: 0, estimatedTime: 0, slaRisk: 0 };
        }
    }
    
    // Get SLA minutes left for an order
    getSLAMinutesLeft(order) {
        // Use existing slaDeadline if available, otherwise calculate it
        const slaDeadline = order.slaDeadline || this.calculateSLADeadline(order.orderTime);
        const now = new Date();
        return Math.max(0, Math.round((slaDeadline - now) / (1000 * 60)));
    }

    displayBatchResults(batches) {
        console.log('displayBatchResults called with:', batches);
        
        if (batches.length === 0) {
            console.log('No batches to display');
            this.displayOptimizationResult('No suitable batches found with current settings.');
            return;
        }

        // Clear existing highlights
        this.clearOrderHighlights();
        
        // Find the best batch (considering total distance and SLA risk)
        const bestBatch = batches.reduce((best, current) => {
            const bestMetrics = this.calculateBatchMetrics(best);
            const currentMetrics = this.calculateBatchMetrics(current);
            
            // Score based on fewer orders at risk and shorter distance
            const bestScore = bestMetrics.slaRisk + (bestMetrics.totalDistance / 10);
            const currentScore = currentMetrics.slaRisk + (currentMetrics.totalDistance / 10);
            
            return currentScore < bestScore ? current : best;
        });

        const bestMetrics = this.calculateBatchMetrics(bestBatch);

        // Build result HTML
        let resultHTML = `
            <div class="batch-summary">
                <div class="batch-summary-item">
                    <div class="batch-summary-value">${bestBatch.length}</div>
                    <div class="batch-summary-label">ORDERS</div>
                </div>
                <div class="batch-summary-item">
                    <div class="batch-summary-value">${bestMetrics.totalDistance}km</div>
                    <div class="batch-summary-label">TOTAL ROUTE</div>
                </div>
                <div class="batch-summary-item">
                    <div class="batch-summary-value">${bestMetrics.estimatedTime}min</div>
                    <div class="batch-summary-label">EST. TIME</div>
                </div>
            </div>
            
            <div class="route-highlight">
                📍 Start at Store → Follow sequence below → 🏠 Return to Store
            </div>
            
            <div class="batch-orders">`;

        bestBatch.forEach((order, index) => {
            const slaMinutesLeft = this.getSLAMinutesLeft(order);
            const slaStatus = slaMinutesLeft < bestMetrics.estimatedTime ? '⚠️ At Risk' : '✅ Safe';
            const customerName = order.customerName || `Customer ${order.customerPincode}`;
            const distance = order.distance || 0;
            
            resultHTML += `
                <div class="batch-order-item">
                    <div class="batch-order-details">
                        <div class="batch-order-id">${order.orderId} - ${customerName}</div>
                        <div class="batch-order-meta">
                            ${distance.toFixed(1)}km from store • SLA: ${slaMinutesLeft}min left ${slaStatus}
                        </div>
                    </div>
                    <div class="batch-sequence">${index + 1}</div>
                </div>`;
        });

        resultHTML += `</div>`;

        if (batches.length > 1) {
            resultHTML += `<div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 6px; font-size: 12px;">
                💡 Found ${batches.length} possible batches. Showing the most efficient route.
            </div>`;
        }

        // Display in result panel
        const resultPanel = document.getElementById('optimizationResult');
        if (!resultPanel) {
            console.error('Could not find optimization result panel element');
            return;
        }
        
        resultPanel.innerHTML = resultHTML;
        resultPanel.className = 'optimization-result batch-result';
        resultPanel.style.display = 'block';

        // Highlight orders on the map and in the queue
        this.highlightBatchOrders(bestBatch);
        
        // Show route on map
        this.showRouteOnMap(bestBatch);
    }

    highlightBatchOrders(batch) {
        batch.forEach((order, index) => {
            const orderElement = document.querySelector(`[data-order-id="${order.id}"]`);
            if (orderElement) {
                orderElement.classList.add('batch-highlight');
                orderElement.setAttribute('data-batch-sequence', index + 1);
            }
        });
    }

    clearOrderHighlights() {
        document.querySelectorAll('.order-card').forEach(card => {
            card.classList.remove('recommended-highlight', 'batch-highlight');
            card.removeAttribute('data-batch-sequence');
        });
        
        // Clear all routes from map
        this.clearExistingRoutes();
        
        // Reset all order markers to their original state
        this.orderMarkers.forEach((markerData, orderId) => {
            const order = this.orders.find(o => o.id === orderId);
            if (order && markerData.marker) {
                // Reset to original marker icon
                const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
                const markerColor = this.getMarkerColor(priorityLevel);
                markerData.marker.setIcon(this.createMarkerIcon(markerColor, order.priority));
                markerData.marker.setAnimation(null);
            }
        });
    }

    async showRouteOnMap(batch) {
        console.log('=== SHOW ROUTE ON MAP DEBUG (Routes API) ===');
        console.log('Batch:', batch);
        console.log('Map exists:', !!this.map);
        
        if (!this.map || batch.length === 0) {
            console.log('Cannot show route: no map or empty batch');
            return;
        }

        // Clear existing routes
        this.clearExistingRoutes();

        // Build waypoints
        const waypoints = [];
        const validOrders = [];

        console.log('Building waypoints...');
        for (const order of batch) {
            console.log(`Processing order ${order.orderId} with pincode ${order.customerPincode}`);
            const coords = this.pincodeData.get(order.customerPincode);
            console.log('Coordinates for this order:', coords);
            
            if (coords && coords.lat && coords.lng) {
                waypoints.push({
                    location: {
                        latLng: {
                            latitude: coords.lat,
                            longitude: coords.lng
                        }
                    }
                });
                validOrders.push({ ...order, ...coords });
                console.log(`Added waypoint ${waypoints.length}:`, coords);
            } else {
                console.log(`No valid coordinates for order ${order.orderId}`);
            }
        }

        console.log('Total waypoints created:', waypoints.length);

        if (waypoints.length === 0) {
            console.log('No valid waypoints - using fallback');
            this.showStraightLineRoute(batch);
            return;
        }

        try {
            // Use the new Routes API via REST
            const routeData = await this.calculateRouteWithRoutesAPI(waypoints);
            console.log('Routes API response:', routeData);
            
            if (routeData && routeData.routes && routeData.routes.length > 0) {
                // Display the route using the polyline
                this.displayRouteFromRoutesAPI(routeData.routes[0]);
                
                // Update markers and results
                this.updateMarkersWithOptimizedRoute(validOrders);
                this.updateBatchResultsWithRoutesAPIData(routeData.routes[0], validOrders);
                
                console.log('Route successfully displayed using Routes API');
            } else {
                console.log('No routes returned from Routes API, using fallback');
                this.showStraightLineRoute(batch);
            }
            
        } catch (error) {
            console.error('Routes API error:', error);
            
            // Try fallback with legacy Directions API
            console.log('Attempting fallback to legacy Directions API...');
            this.showRouteWithLegacyAPI(batch, validOrders, waypoints);
        }
    }

    // New method using Google Routes API (REST)
    async calculateRouteWithRoutesAPI(waypoints) {
        const origin = {
            location: {
                latLng: {
                    latitude: this.storeLocation.lat,
                    longitude: this.storeLocation.lng
                }
            }
        };

        const destination = origin; // Return to store

        const requestData = {
            origin: origin,
            destination: destination,
            intermediates: waypoints,
            travelMode: 'DRIVE',
            routingPreference: 'TRAFFIC_AWARE',
            computeAlternativeRoutes: false,
            routeModifiers: {
                avoidTolls: false,
                avoidHighways: false,
                avoidFerries: false
            },
            languageCode: 'en-US',
            units: 'METRIC'
        };

        console.log('Routes API request:', requestData);

        const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': 'AIzaSyDr-DYch4S-JeL-sTlbixPKSjgOJiHLe8A',
                'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline'
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`Routes API error: ${response.status} ${response.statusText}`);
        }

        return await response.json();
    }

    // Display route from Routes API response
    displayRouteFromRoutesAPI(route) {
        if (!route.polyline || !route.polyline.encodedPolyline) {
            console.error('No polyline data in route');
            return;
        }

        console.log('Displaying route from Routes API...');

        // Decode the polyline
        const decodedPath = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
        
        // Create and display the polyline
        this.routePolyline = new google.maps.Polyline({
            path: decodedPath,
            geodesic: true,
            strokeColor: '#f59e0b',
            strokeOpacity: 0.9,
            strokeWeight: 6,
            zIndex: 50 // Lower than markers
        });

        this.routePolyline.setMap(this.map);
        
        // Ensure all order markers are visible and on top
        console.log('Ensuring all markers are visible...');
        this.orderMarkers.forEach((markerData, orderId) => {
            if (markerData.marker) {
                markerData.marker.setVisible(true);
                markerData.marker.setMap(this.map);
                markerData.marker.setZIndex(100); // Above the route
                console.log(`Marker ${orderId} made visible and positioned above route`);
            }
        });
        
        // Fit map to show entire route with some padding
        const bounds = new google.maps.LatLngBounds();
        decodedPath.forEach(point => bounds.extend(point));
        
        // Add store location to bounds
        bounds.extend(new google.maps.LatLng(this.storeLocation.lat, this.storeLocation.lng));
        
        this.map.fitBounds(bounds, { padding: 50 });

        console.log('Route polyline displayed on map with', decodedPath.length, 'points');
    }

    // Update results with Routes API data
    updateBatchResultsWithRoutesAPIData(route, orders) {
        const totalDistanceKm = route.distanceMeters ? (route.distanceMeters / 1000) : 0;
        const totalDurationMin = route.duration ? (parseFloat(route.duration.replace('s', '')) / 60) : 0;
        
        // Update the summary in the results panel
        const resultPanel = document.getElementById('optimizationResult');
        if (resultPanel) {
            const summaryItems = resultPanel.querySelectorAll('.batch-summary-item .batch-summary-value');
            if (summaryItems.length >= 3) {
                summaryItems[1].textContent = `${totalDistanceKm.toFixed(1)}km`;
                summaryItems[2].textContent = `${Math.round(totalDurationMin)}min`;
            }
            
            const routeInfo = resultPanel.querySelector('.route-highlight');
            if (routeInfo) {
                routeInfo.innerHTML = `
                    🗺️ <strong>Google Routes API:</strong> ${totalDistanceKm.toFixed(1)}km • ${Math.round(totalDurationMin)} minutes driving time
                    <br>📍 Start at Store → Follow optimized route → 🏠 Return to Store
                `;
            }
        }
        
        console.log('Updated batch results with Routes API data:', {
            distance: totalDistanceKm.toFixed(1) + ' km',
            duration: Math.round(totalDurationMin) + ' minutes'
        });
    }

    // Fallback method using legacy Directions API
    showRouteWithLegacyAPI(batch, validOrders, waypoints) {
        console.log('Using legacy Directions API as fallback...');
        
        if (!window.google || !window.google.maps.DirectionsService) {
            console.log('Legacy Directions API not available, using straight line fallback');
            this.showStraightLineRoute(batch);
            return;
        }

        // Initialize directions service if not already done
        if (!this.directionsService) {
            this.directionsService = new google.maps.DirectionsService();
        }

        this.directionsRenderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            preserveViewport: false,
            polylineOptions: {
                strokeColor: '#f59e0b',
                strokeOpacity: 0.9,
                strokeWeight: 6
            }
        });
        this.directionsRenderer.setMap(this.map);

        // Convert waypoints for legacy API
        const legacyWaypoints = waypoints.map(wp => ({
            location: new google.maps.LatLng(
                wp.location.latLng.latitude,
                wp.location.latLng.longitude
            ),
            stopover: true
        }));

        const directionsRequest = {
            origin: new google.maps.LatLng(this.storeLocation.lat, this.storeLocation.lng),
            destination: new google.maps.LatLng(this.storeLocation.lat, this.storeLocation.lng),
            waypoints: legacyWaypoints,
            optimizeWaypoints: true,
            travelMode: google.maps.TravelMode.DRIVING,
            unitSystem: google.maps.UnitSystem.METRIC
        };

        console.log('Legacy Directions API request:', directionsRequest);

        this.directionsService.route(directionsRequest, (result, status) => {
            console.log('Legacy Directions API response status:', status);
            
            if (status === 'OK' || status === google.maps.DirectionsStatus.OK) {
                console.log('SUCCESS: Legacy directions received!');
                this.directionsRenderer.setDirections(result);
                this.updateMarkersWithOptimizedRoute(validOrders);
                this.updateBatchResultsWithRouteData(result, validOrders);
            } else {
                console.error('Legacy Directions API also failed:', status);
                this.showStraightLineRoute(batch);
                this.showNotification('Unable to calculate driving route. Showing straight-line path.', 'info');
            }
        });
    }

    // Clear existing routes from map
    clearExistingRoutes() {
        console.log('Clearing existing routes...');
        
        if (this.directionsRenderer) {
            this.directionsRenderer.setMap(null);
            this.directionsRenderer = null;
            console.log('Directions renderer cleared');
        }
        
        if (this.routePolyline) {
            this.routePolyline.setMap(null);
            this.routePolyline = null;
            console.log('Route polyline cleared');
        }
        
        // Ensure all order markers remain visible
        this.orderMarkers.forEach((markerData, orderId) => {
            if (markerData.marker) {
                markerData.marker.setVisible(true);
                markerData.marker.setMap(this.map);
                console.log(`Ensured marker ${orderId} is visible`);
            }
        });
    }

    // Fallback method for straight line routes if Directions API fails
    showStraightLineRoute(batch) {
        console.log('Falling back to straight line route');
        
        // Clear existing route
        if (this.routePolyline) {
            this.routePolyline.setMap(null);
        }

        // Create route path with proper coordinates
        const routePath = [
            this.storeLocation, // Start at store
            ...batch.map(order => {
                const coords = this.pincodeData.get(order.customerPincode);
                return coords || { lat: order.lat, lng: order.lng };
            }),
            this.storeLocation // Return to store
        ];

        // Create polyline
        this.routePolyline = new google.maps.Polyline({
            path: routePath,
            geodesic: true,
            strokeColor: '#dc2626',
            strokeOpacity: 0.8,
            strokeWeight: 4,
            strokePattern: [10, 5] // Dashed line to indicate it's not actual roads
        });

        this.routePolyline.setMap(this.map);
        
        // Update markers with sequence
        this.updateMarkersWithOptimizedRoute(batch);
    }

    // Update markers with route sequence numbers
    updateMarkersWithOptimizedRoute(ordersSequence) {
        console.log('Updating markers with optimized route:', ordersSequence);
        
        ordersSequence.forEach((order, index) => {
            console.log(`Looking for marker for order ${order.id}`);
            const markerData = this.orderMarkers.get(order.id);
            if (markerData && markerData.marker) {
                console.log(`Found marker for order ${order.id}, updating with sequence ${index + 1}`);
                
                // Update marker icon to show sequence with enhanced visibility
                const seqSvg = `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 0C11 0 4 7 4 16c0 9 16 34 16 34s16-25 16-34C36 7 29 0 20 0z" fill="#f59e0b" stroke="#ffffff" stroke-width="3"/>
                    <circle cx="20" cy="16" r="12" fill="white"/>
                    <text x="20" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#f59e0b">${index + 1}</text>
                </svg>`;
                
                markerData.marker.setIcon({
                    url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(seqSvg),
                    scaledSize: new google.maps.Size(40, 50),
                    anchor: new google.maps.Point(20, 50)
                });
                
                // Ensure marker is visible and on top
                markerData.marker.setZIndex(1000 + index);
                markerData.marker.setVisible(true);
                
                // Brief animation to draw attention
                markerData.marker.setAnimation(google.maps.Animation.BOUNCE);
                setTimeout(() => {
                    if (markerData.marker) {
                        markerData.marker.setAnimation(null);
                    }
                }, 1500);
                
                console.log(`Marker ${order.id} updated and made visible`);
            } else {
                console.log(`No marker found for order ${order.id}`);
                console.log('Available marker IDs:', Array.from(this.orderMarkers.keys()));
                
                // Try to create marker if it doesn't exist
                const coords = this.pincodeData.get(order.customerPincode);
                if (coords) {
                    console.log(`Creating missing marker for order ${order.id}`);
                    this.addOrderToMap({ ...order, ...coords });
                    
                    // Update the newly created marker
                    setTimeout(() => {
                        const newMarkerData = this.orderMarkers.get(order.id);
                        if (newMarkerData && newMarkerData.marker) {
                            const seqSvg = `<svg width="40" height="50" viewBox="0 0 40 50" xmlns="http://www.w3.org/2000/svg">
                                <path d="M20 0C11 0 4 7 4 16c0 9 16 34 16 34s16-25 16-34C36 7 29 0 20 0z" fill="#f59e0b" stroke="#ffffff" stroke-width="3"/>
                                <circle cx="20" cy="16" r="12" fill="white"/>
                                <text x="20" y="22" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#f59e0b">${index + 1}</text>
                            </svg>`;
                            
                            newMarkerData.marker.setIcon({
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(seqSvg),
                                scaledSize: new google.maps.Size(40, 50),
                                anchor: new google.maps.Point(20, 50)
                            });
                            newMarkerData.marker.setZIndex(1000 + index);
                        }
                    }, 100);
                }
            }
        });
        
        console.log('Finished updating all markers');
    }

    // Update batch results panel with actual route data from Google
    updateBatchResultsWithRouteData(directionsResult, orders) {
        const route = directionsResult.routes[0];
        const totalDistanceKm = route.legs.reduce((total, leg) => total + leg.distance.value, 0) / 1000;
        const totalDurationMin = route.legs.reduce((total, leg) => total + leg.duration.value, 0) / 60;
        
        // Update the summary in the results panel
        const resultPanel = document.getElementById('optimizationResult');
        if (resultPanel) {
            const summaryItems = resultPanel.querySelectorAll('.batch-summary-item .batch-summary-value');
            if (summaryItems.length >= 3) {
                summaryItems[1].textContent = `${totalDistanceKm.toFixed(1)}km`; // Update distance
                summaryItems[2].textContent = `${Math.round(totalDurationMin)}min`; // Update time
            }
            
            // Add route info
            const routeInfo = resultPanel.querySelector('.route-highlight');
            if (routeInfo) {
                routeInfo.innerHTML = `
                    🗺️ <strong>Optimized Road Route:</strong> ${totalDistanceKm.toFixed(1)}km • ${Math.round(totalDurationMin)} minutes driving time
                    <br>📍 Start at Store → Follow Google Maps route → 🏠 Return to Store
                `;
            }
        }
        
        console.log('Updated batch results with Google route data:', {
            distance: totalDistanceKm,
            duration: totalDurationMin
        });
    }
    
    addTestOrder() {
        // Add a test order for debugging - using real geocoding only
        const testOrder = {
            id: Date.now(),
            orderId: 'TEST-001',
            customerName: 'Test Customer',
            customerPincode: '440001', // Nagpur Civil Lines - will be geocoded
            orderTime: new Date(),
            status: 'pending',
            distance: null,
            priority: 50
        };
        
        testOrder.slaDeadline = this.calculateSLADeadline(testOrder.orderTime);
        this.orders.push(testOrder);
        
        console.log('Test order added (will be geocoded):', testOrder);
        
        // Use real geocoding - no hardcoded coordinates
        this.autoFillCoordinates(testOrder.customerPincode);
    }
}

// Global function for Google Maps API callback
function initMap() {
    if (window.orderPickingTool) {
        window.orderPickingTool.initializeMap();
    } else {
        // Store the callback for later execution
        window.mapInitCallback = true;
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing OrderPickingTool');
    window.orderPickingTool = new OrderPickingTool();
    console.log('OrderPickingTool initialized:', window.orderPickingTool);
    
    // Initialize map if Google Maps API is already loaded
    if (window.google && window.mapInitCallback) {
        window.orderPickingTool.initializeMap();
    }
    
    // Auto-refresh orders display every minute to update time remaining and map markers
    setInterval(() => {
        window.orderPickingTool.refreshOrdersDisplay();
    }, 60000);
    
    // Batch settings toggle functionality
    const batchSettings = document.querySelector('.batch-settings');
    const enableBatchingCheckbox = document.getElementById('enableBatching');
    
    function toggleBatchSettings() {
        const isBatchEnabled = enableBatchingCheckbox.checked;
        if (batchSettings) {
            batchSettings.style.display = isBatchEnabled ? 'block' : 'none';
        }
    }
    
    // Initial check
    toggleBatchSettings();
    
    // Add event listener to checkbox
    if (enableBatchingCheckbox) {
        enableBatchingCheckbox.addEventListener('change', toggleBatchSettings);
    }
});
