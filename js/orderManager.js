// Order Management Module
// Handles order creation, validation, and lifecycle management

// Extend OrderPickingTool with order management methods
Object.assign(OrderPickingTool.prototype, {
    
    async autoFillCoordinates(pincode) {
        if (!pincode || pincode.length !== 6) return;

        try {
            // Check cache first and process existing coordinates if available
            if (this.pincodeData.has(pincode)) {
                console.log(`Using cached coordinates for pincode ${pincode}`);
                const coords = this.pincodeData.get(pincode);
                
                // Check if there are any orders with this pincode that don't have distance calculated
                const ordersToUpdate = this.orders.filter(o => 
                    o.customerPincode === pincode && !o.distance
                );
                
                if (ordersToUpdate.length > 0) {
                    console.log(`Found ${ordersToUpdate.length} orders with pincode ${pincode} that need distance calculation`);
                    
                    ordersToUpdate.forEach(order => {
                        const distance = this.calculateDistance(
                            this.storeLocation.lat, this.storeLocation.lng,
                            coords.lat, coords.lng
                        );
                        
                        // Update order with distance and priority
                        order.distance = distance;
                        order.priority = this.calculatePriority(
                            order.orderTime, order.slaDeadline, distance
                        );
                        
                        console.log(`Updated order ${order.orderId} with distance ${distance}km from cache`);
                        
                        // Create map marker for this order
                        this.addOrderToMap(order);
                    });
                    
                    // Save and refresh display after updating all orders
                    this.saveOrdersToStorage();
                    this.refreshOrdersDisplay();
                }
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
                        
                        // Update ALL orders with this pincode that don't have distance
                        const ordersToUpdate = this.orders.filter(o => 
                            o.customerPincode === pincode && !o.distance
                        );
                        
                        console.log(`Found ${ordersToUpdate.length} orders to update with new geocoded data`);
                        
                        ordersToUpdate.forEach(order => {
                            const distance = this.calculateDistance(
                                this.storeLocation.lat, this.storeLocation.lng,
                                coords.lat, coords.lng
                            );
                            
                            // Update order with distance and priority
                            order.distance = distance;
                            order.priority = this.calculatePriority(
                                order.orderTime, order.slaDeadline, distance
                            );
                            
                            console.log(`Updated order ${order.orderId} with distance ${distance}km from geocoding`);
                            
                            // Create map marker for this order
                            this.addOrderToMap(order);
                        });
                        
                        if (ordersToUpdate.length > 0) {
                            // Save and refresh display after updating all orders
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
    },

    addNewOrder() {
        const formData = {
            orderId: document.getElementById('orderId').value,
            orderTime: new Date(document.getElementById('orderTime').value),
            customerPincode: document.getElementById('customerPincode').value,
            zone: document.getElementById('orderZone').value
        };

        // Validation
        if (!formData.orderId || !formData.customerPincode || !formData.zone) {
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

        // Check if we have cached coordinates for this pincode
        let distance = null;
        let priority = 50; // Default priority
        
        if (this.pincodeData.has(formData.customerPincode)) {
            console.log(`Using cached coordinates for new order with pincode ${formData.customerPincode}`);
            const coords = this.pincodeData.get(formData.customerPincode);
            distance = this.calculateDistance(
                this.storeLocation.lat, this.storeLocation.lng,
                coords.lat, coords.lng
            );
            priority = this.calculatePriority(formData.orderTime, slaDeadline, distance);
            console.log(`New order ${formData.orderId} calculated distance from cache: ${distance}km`);
        }

        // Create order object
        const order = {
            ...formData,
            id: Date.now(), // Unique ID
            distance: distance, // Will be distance if cached, null otherwise
            slaDeadline: slaDeadline,
            status: 'pending',
            addedAt: new Date(),
            priority: priority // Will be calculated if distance available, default otherwise
        };

        // Add order immediately to show in list
        this.orders.push(order);
        this.saveOrdersToStorage();
        this.refreshOrdersDisplay();
        this.clearOrderForm();
        
        // If we already had cached coordinates, add to map immediately
        if (distance) {
            this.addOrderToMap(order);
            this.showNotification(`Order ${order.orderId} added with distance ${distance}km!`, 'success');
        } else {
            // Start geocoding in background for new pincode
            this.autoFillCoordinates(formData.customerPincode);
            this.showNotification(`Order ${order.orderId} added! Fetching location data...`, 'success');
        }
    },

    markOrderAsSelected(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Update order status
            this.orders[orderIndex].status = 'selected';
            this.orders[orderIndex].selectedAt = new Date();
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshAllDisplays(); // Use comprehensive refresh
            this.updateOrderMarkerStyle(order);
            
            // Show route to the selected order
            this.showRouteOnMap([order]);
            
            this.showNotification(`Order ${order.orderId} selected for delivery! 📋`, 'success');
        }
    },

    startDelivery(orderId) {
        // Instead of directly starting delivery, show rider assignment modal
        this.showRiderAssignmentModal(orderId);
    },

    showRiderAssignmentModal(orderId) {
        const order = this.orders.find(order => order.id === parseInt(orderId));
        if (!order) {
            this.showNotification('Order not found', 'error');
            return;
        }

        // Store the order for assignment
        this.pendingRiderAssignment = order;

        // Populate modal with order information
        const modalOrderInfo = document.getElementById('modalOrderInfo');
        if (modalOrderInfo) {
            modalOrderInfo.innerHTML = `
                <h4>📦 Order Details</h4>
                <div class="order-info-item">
                    <span class="order-info-label">Order ID:</span>
                    <span class="order-info-value">${order.orderId}</span>
                </div>
                <div class="order-info-item">
                    <span class="order-info-label">Pincode:</span>
                    <span class="order-info-value">${order.customerPincode}</span>
                </div>
                <div class="order-info-item">
                    <span class="order-info-label">Zone:</span>
                    <span class="order-info-value">${order.zone}</span>
                </div>
                <div class="order-info-item">
                    <span class="order-info-label">Distance:</span>
                    <span class="order-info-value">${order.distance} km</span>
                </div>
                <div class="order-info-item">
                    <span class="order-info-label">Priority:</span>
                    <span class="order-info-value">${order.priority}</span>
                </div>
                <div class="order-info-item">
                    <span class="order-info-label">SLA Deadline:</span>
                    <span class="order-info-value">${this.formatTime(order.slaDeadline)}</span>
                </div>
            `;
        }

        // Reset rider selection
        const riderSelect = document.getElementById('riderSelect');
        if (riderSelect) {
            riderSelect.value = '';
            this.updateRiderStatus();
        }

        // Show modal
        const modal = document.getElementById('riderAssignmentModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    },

    updateRiderStatus() {
        const riderSelect = document.getElementById('riderSelect');
        const riderStatus = document.getElementById('riderStatus');
        
        if (!riderSelect || !riderStatus) return;

        const selectedRider = riderSelect.value;
        
        if (!selectedRider) {
            riderStatus.innerHTML = `
                <div><i class="fas fa-info-circle"></i> Please select a rider to see availability status.</div>
            `;
            riderStatus.className = 'rider-status';
            return;
        }

        const rider = this.riders[selectedRider];
        if (rider.status === 'available') {
            riderStatus.innerHTML = `
                <div><i class="fas fa-check-circle"></i> ${rider.name} is available and ready for delivery.</div>
            `;
            riderStatus.className = 'rider-status available';
        } else {
            const busyOrderId = rider.currentOrder ? rider.currentOrder.orderId : 'Unknown';
            riderStatus.innerHTML = `
                <div><i class="fas fa-exclamation-triangle"></i> ${rider.name} is currently busy with order ${busyOrderId}.</div>
            `;
            riderStatus.className = 'rider-status busy';
        }
    },

    confirmRiderAssignment() {
        const riderSelect = document.getElementById('riderSelect');
        const selectedRider = riderSelect?.value;

        if (!selectedRider) {
            this.showNotification('Please select a rider', 'error');
            return;
        }

        if (!this.pendingRiderAssignment) {
            this.showNotification('No order selected for assignment', 'error');
            return;
        }

        const rider = this.riders[selectedRider];
        if (rider.status !== 'available') {
            this.showNotification(`${rider.name} is not available`, 'error');
            return;
        }

        // Assign rider and start delivery
        this.assignRiderAndStartDelivery(this.pendingRiderAssignment.id, selectedRider);
        this.closeRiderModal();
    },

    assignRiderAndStartDelivery(orderId, riderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Update order status and assign rider
            this.orders[orderIndex].status = 'out_for_delivery';
            this.orders[orderIndex].assignedRider = riderId;
            this.orders[orderIndex].deliveryStartedAt = new Date();
            
            // Update rider status
            this.riders[riderId].status = 'busy';
            this.riders[riderId].currentOrder = order;
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshAllDisplays();
            this.updateOrderMarkerStyle(order);
            
            // Show route to the delivery order
            this.showRouteOnMap([order]);
            
            this.showNotification(`Delivery started for order ${order.orderId} with ${this.riders[riderId].name}! 🚚`, 'success');
        }
    },

    closeRiderModal() {
        const modal = document.getElementById('riderAssignmentModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.pendingRiderAssignment = null;
    },

    cancelSelection(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Reset to pending status
            this.orders[orderIndex].status = 'pending';
            delete this.orders[orderIndex].selectedAt;
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshAllDisplays(); // Use comprehensive refresh
            this.updateOrderMarkerStyle(order);
            
            // Clear the route when cancelling selection
            this.clearExistingRoutes();
            
            this.showNotification(`Selection cancelled for order ${order.orderId}`, 'info');
        }
    },

    cancelDelivery(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Free up the assigned rider
            if (order.assignedRider && this.riders[order.assignedRider]) {
                this.riders[order.assignedRider].status = 'available';
                this.riders[order.assignedRider].currentOrder = null;
            }
            
            // Reset to selected status
            this.orders[orderIndex].status = 'selected';
            delete this.orders[orderIndex].deliveryStartedAt;
            delete this.orders[orderIndex].assignedRider;
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshAllDisplays(); // Use comprehensive refresh
            this.updateOrderMarkerStyle(order);
            
            // Show route again since order is back to selected status
            this.showRouteOnMap([order]);
            
            this.showNotification(`Delivery cancelled for order ${order.orderId}`, 'info');
        }
    },

    markOrderAsDelivered(orderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Ask for confirmation
            if (confirm(`Mark order ${order.orderId} as delivered?`)) {
                // Free up the assigned rider
                if (order.assignedRider && this.riders[order.assignedRider]) {
                    this.riders[order.assignedRider].status = 'available';
                    this.riders[order.assignedRider].currentOrder = null;
                }

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
                this.refreshAllDisplays(); // Use comprehensive refresh
                this.hideOptimizationResult();
                
                const riderName = order.assignedRider ? ` (${this.riders[order.assignedRider].name} is now available)` : '';
                this.showNotification(`Order ${order.orderId} marked as delivered! 🎉${riderName}`, 'success');
            }
        }
    },

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
                this.refreshAllDisplays(); // Use comprehensive refresh
                this.hideOptimizationResult();
                
                this.showNotification(`Order ${order.orderId} removed from queue`, 'info');
            }
        }
    },

    clearOrderForm() {
        document.getElementById('orderForm').reset();
        const now = new Date();
        const localDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
            .toISOString()
            .slice(0, 16);
        document.getElementById('orderTime').value = localDateTime;
    }
});
