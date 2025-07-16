// Map Manager Module
// Handles Google Maps integration, markers, and route visualization

// Extend OrderPickingTool with map management methods
Object.assign(OrderPickingTool.prototype, {
    
    initializeMap() {
        if (!window.google) {
            console.log('Google Maps API not loaded yet');
            return;
        }

        console.log('Initializing Google Maps with', this.orders.length, 'orders');

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

        // Initialize Directions Service and Renderers for actual road routes
        // Using separate renderers for different route segments
        if (window.google && window.google.maps.DirectionsService) {
            this.directionsService = new google.maps.DirectionsService();
            
            // Array to store multiple direction renderers for route segments
            this.routeRenderers = [];
            this.currentRouteSegments = [];
            this.activeRouteSegments = new Set(); // Track which segments are visible
            
            console.log('Google Directions API initialized with segment support');
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

        // Process existing orders and add them to the map
        this.processOrdersForMap();
    },

    processOrdersForMap() {
        console.log('Processing orders for map display:', this.orders.length, 'orders');
        console.log('Pincode data cache size:', this.pincodeData.size);
        
        this.orders.forEach(order => {
            console.log(`Processing order ${order.orderId}:`, {
                hasDistance: !!order.distance,
                pincode: order.customerPincode,
                hasCachedCoords: this.pincodeData.has(order.customerPincode)
            });
            
            // If order has distance and coordinates are cached, add to map immediately
            if (order.distance && this.pincodeData.has(order.customerPincode)) {
                console.log(`Adding order ${order.orderId} to map immediately`);
                this.addOrderToMap(order);
            } else if (!order.distance && order.customerPincode) {
                // Start geocoding for orders that don't have distance yet
                console.log(`Starting geocoding for order ${order.orderId} with pincode ${order.customerPincode}`);
                this.autoFillCoordinates(order.customerPincode);
            } else {
                console.log(`Order ${order.orderId} is missing pincode or other required data`);
            }
        });
    },

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
                data.infoWindow.close();
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
    },

    generateInfoWindowContent(order) {
        const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
        const timeRemaining = this.formatTimeRemaining(order.slaDeadline);
        const isUrgent = priorityLevel === 'high-priority' || priorityLevel === 'overdue';
        const statusIcon = this.getStatusIcon(order.status);
        const statusLabel = this.getStatusLabel(order.status);
        
        return `
            <div class="info-window">
                <div class="info-window-header">📦 Order ${order.orderId}</div>
                <div class="info-window-details">
                    <div><strong>📍 Pincode:</strong> ${order.customerPincode}</div>
                    <div><strong>🏢 Zone:</strong> ${order.zone}</div>
                    <div><strong>📏 Distance:</strong> ${order.distance ? `${order.distance} km` : 'Calculating...'}</div>
                    <div><strong>⭐ Priority Score:</strong> ${order.priority}</div>
                    <div><strong>📊 Status:</strong> ${statusIcon} ${statusLabel}</div>
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
    },

    getMarkerColor(priorityLevel) {
        switch (priorityLevel) {
            case 'high-priority':
            case 'overdue':
                return '#dc2626'; // Red
            case 'normal':
                return '#1e40af'; // Blue
            case 'next-day':
                return '#6b7280'; // Gray
            default:
                return '#1e40af';
        }
    },

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
    },

    updateMapMarkers() {
        this.orderMarkers.forEach((data, orderId) => {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
                this.updateOrderMarkerStyle(order);
                data.infoWindow.setContent(this.generateInfoWindowContent(order));
            }
        });
    },

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
    },

    showRouteOnMap(orders) {
        console.log('showRouteOnMap called with orders:', orders);
        console.log('DirectionsService available:', !!this.directionsService);
        console.log('Google Maps available:', !!window.google);
        
        if (!window.google || !window.google.maps) {
            console.error('Google Maps API not loaded');
            this.showNotification('Google Maps API not loaded. Please refresh the page.', 'error');
            return;
        }
        
        if (!this.directionsService) {
            console.log('DirectionsService not initialized, initializing now...');
            this.directionsService = new google.maps.DirectionsService();
        }
        
        if (!orders || !orders.length) {
            console.log('No orders provided for route display');
            return;
        }

        // Clear existing routes
        this.clearExistingRoutes();

        // Calculate route segments and show route controls
        this.calculateRouteSegments(orders);
        this.showRouteControls(orders);
    },

    calculateRouteSegments(orders) {
        this.currentRouteSegments = [];
        
        if (orders.length === 1) {
            // Single order: Store → Order → Store
            const order = orders[0];
            const coords = this.pincodeData.get(order.customerPincode);
            
            if (coords) {
                this.currentRouteSegments = [
                    {
                        id: 'store-to-order',
                        from: 'Store (Raftaar)',
                        to: `${order.orderId} (${order.customerPincode})`,
                        fromCoords: this.storeLocation,
                        toCoords: coords,
                        distance: order.distance,
                        color: '#3b82f6', // Blue
                        order: order
                    },
                    {
                        id: 'order-to-store',
                        from: `${order.orderId} (${order.customerPincode})`,
                        to: 'Store (Raftaar)',
                        fromCoords: coords,
                        toCoords: this.storeLocation,
                        distance: order.distance,
                        color: '#10b981', // Green
                        order: order
                    }
                ];
            }
        } else {
            // Multiple orders: Store → Order1 → Order2 → ... → Store
            this.currentRouteSegments = [];
            
            // Store to first order
            const firstOrder = orders[0];
            const firstCoords = this.pincodeData.get(firstOrder.customerPincode);
            if (firstCoords) {
                this.currentRouteSegments.push({
                    id: 'store-to-first',
                    from: 'Store (Raftaar)',
                    to: `${firstOrder.orderId} (${firstOrder.customerPincode})`,
                    fromCoords: this.storeLocation,
                    toCoords: firstCoords,
                    distance: firstOrder.distance,
                    color: '#3b82f6', // Blue
                    order: firstOrder
                });
            }
            
            // Between orders
            for (let i = 0; i < orders.length - 1; i++) {
                const fromOrder = orders[i];
                const toOrder = orders[i + 1];
                const fromCoords = this.pincodeData.get(fromOrder.customerPincode);
                const toCoords = this.pincodeData.get(toOrder.customerPincode);
                
                if (fromCoords && toCoords) {
                    const distance = this.calculateDistance(
                        fromCoords.lat, fromCoords.lng,
                        toCoords.lat, toCoords.lng
                    );
                    
                    this.currentRouteSegments.push({
                        id: `order-${i}-to-${i + 1}`,
                        from: `${fromOrder.orderId} (${fromOrder.customerPincode})`,
                        to: `${toOrder.orderId} (${toOrder.customerPincode})`,
                        fromCoords: fromCoords,
                        toCoords: toCoords,
                        distance: distance,
                        color: `hsl(${200 + i * 30}, 70%, 50%)`, // Different colors for each segment
                        fromOrder: fromOrder,
                        toOrder: toOrder
                    });
                }
            }
            
            // Last order back to store
            const lastOrder = orders[orders.length - 1];
            const lastCoords = this.pincodeData.get(lastOrder.customerPincode);
            if (lastCoords) {
                const returnDistance = this.calculateDistance(
                    lastCoords.lat, lastCoords.lng,
                    this.storeLocation.lat, this.storeLocation.lng
                );
                
                this.currentRouteSegments.push({
                    id: 'last-to-store',
                    from: `${lastOrder.orderId} (${lastOrder.customerPincode})`,
                    to: 'Store (Raftaar)',
                    fromCoords: lastCoords,
                    toCoords: this.storeLocation,
                    distance: returnDistance,
                    color: '#10b981', // Green
                    order: lastOrder
                });
            }
        }
        
        console.log('Calculated route segments:', this.currentRouteSegments);
    },

    showRouteControls(orders) {
        const controlsPanel = document.getElementById('route-controls');
        const segmentsContainer = document.getElementById('route-segments');
        
        if (!controlsPanel || !segmentsContainer) {
            console.log('Route controls elements not found');
            return;
        }
        
        // Clear existing segments
        segmentsContainer.innerHTML = '';
        
        // Create segment toggle buttons
        this.currentRouteSegments.forEach((segment, index) => {
            const segmentDiv = document.createElement('div');
            segmentDiv.className = 'route-segment';
            segmentDiv.dataset.segmentId = segment.id;
            
            segmentDiv.innerHTML = `
                <div class="route-segment-info">
                    <div class="route-segment-title">${segment.from} → ${segment.to}</div>
                    <div class="route-segment-distance">${segment.distance.toFixed(2)} km</div>
                </div>
                <div class="route-segment-toggle">
                    <button class="route-toggle-btn visible" onclick="orderPickingTool.toggleRouteSegment('${segment.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            `;
            
            segmentsContainer.appendChild(segmentDiv);
        });
        
        // Show the controls panel
        controlsPanel.style.display = 'block';
        
        // Initialize all segments as visible
        this.activeRouteSegments = new Set(this.currentRouteSegments.map(s => s.id));
        this.renderActiveRouteSegments();
    },

    toggleRouteSegment(segmentId) {
        const segmentElement = document.querySelector(`[data-segment-id="${segmentId}"]`);
        const toggleBtn = segmentElement.querySelector('.route-toggle-btn');
        const icon = toggleBtn.querySelector('i');
        
        if (this.activeRouteSegments.has(segmentId)) {
            // Hide this segment
            this.activeRouteSegments.delete(segmentId);
            segmentElement.classList.add('inactive');
            segmentElement.classList.remove('active');
            toggleBtn.classList.remove('visible');
            toggleBtn.classList.add('hidden');
            icon.className = 'fas fa-eye-slash';
        } else {
            // Show this segment
            this.activeRouteSegments.add(segmentId);
            segmentElement.classList.add('active');
            segmentElement.classList.remove('inactive');
            toggleBtn.classList.add('visible');
            toggleBtn.classList.remove('hidden');
            icon.className = 'fas fa-eye';
        }
        
        this.renderActiveRouteSegments();
    },

    showAllRouteSegments() {
        this.activeRouteSegments = new Set(this.currentRouteSegments.map(s => s.id));
        
        // Update UI
        document.querySelectorAll('.route-segment').forEach(element => {
            element.classList.add('active');
            element.classList.remove('inactive');
            const btn = element.querySelector('.route-toggle-btn');
            const icon = btn.querySelector('i');
            btn.classList.add('visible');
            btn.classList.remove('hidden');
            icon.className = 'fas fa-eye';
        });
        
        this.renderActiveRouteSegments();
    },

    hideAllRouteSegments() {
        this.activeRouteSegments.clear();
        
        // Update UI
        document.querySelectorAll('.route-segment').forEach(element => {
            element.classList.add('inactive');
            element.classList.remove('active');
            const btn = element.querySelector('.route-toggle-btn');
            const icon = btn.querySelector('i');
            btn.classList.remove('visible');
            btn.classList.add('hidden');
            icon.className = 'fas fa-eye-slash';
        });
        
        this.renderActiveRouteSegments();
    },

    hideRouteControls() {
        const controlsPanel = document.getElementById('route-controls');
        if (controlsPanel) {
            controlsPanel.style.display = 'none';
        }
        this.clearExistingRoutes();
    },

    renderActiveRouteSegments() {
        // Clear existing route renderers
        this.clearExistingRoutes();
        
        // Render only active segments
        this.currentRouteSegments.forEach(segment => {
            if (this.activeRouteSegments.has(segment.id)) {
                this.renderSingleRouteSegment(segment);
            }
        });
    },

    renderSingleRouteSegment(segment) {
        const renderer = new google.maps.DirectionsRenderer({
            suppressMarkers: true,
            polylineOptions: {
                strokeColor: segment.color,
                strokeOpacity: 0.9,
                strokeWeight: 6,
                zIndex: 50
            }
        });
        
        renderer.setMap(this.map);
        this.routeRenderers.push(renderer);
        
        const request = {
            origin: segment.fromCoords,
            destination: segment.toCoords,
            travelMode: google.maps.TravelMode.DRIVING,
            avoidHighways: false,
            avoidTolls: false
        };
        
        this.directionsService.route(request, (result, status) => {
            if (status === 'OK') {
                renderer.setDirections(result);
                console.log(`Rendered segment: ${segment.from} → ${segment.to}`);
            } else {
                console.error(`Failed to render segment ${segment.id}:`, status);
            }
        });
    },

    showBatchRoute(orders) {
        if (!this.directionsService || orders.length === 0) {
            console.log('Cannot show batch route: DirectionsService not available or no orders');
            return;
        }

        // For batch routes, use the new segmented approach too
        this.calculateRouteSegments(orders);
        this.showRouteControls(orders);
    },

    clearExistingRoutes() {
        // Clear all route renderers
        if (this.routeRenderers) {
            this.routeRenderers.forEach(renderer => {
                renderer.setMap(null);
            });
            this.routeRenderers = [];
        }
        
        // Clear old renderers if they exist
        if (this.goingDirectionsRenderer) {
            this.goingDirectionsRenderer.setDirections({ routes: [] });
        }
        if (this.returnDirectionsRenderer) {
            this.returnDirectionsRenderer.setDirections({ routes: [] });
        }
        if (this.routePolyline) {
            this.routePolyline.setMap(null);
            this.routePolyline = null;
        }
    }
});
