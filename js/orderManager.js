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
        try {
            // Use the new customer-based form data method
            const formData = this.getOrderFormData();
            
            // Check if order ID already exists
            if (this.orders.find(order => order.orderId === formData.orderId)) {
                alert('Order ID already exists');
                return;
            }

            // Calculate SLA deadline
            const slaDeadline = this.calculateSLADeadline(formData.orderTime);

            // Distance and priority will be automatically calculated from customer coordinates
            let distance = null;
            let priority = 50; // Default priority
            
            // Use customer's lat/lng directly instead of pincode lookup
            if (formData.lat && formData.lng) {
                distance = this.calculateDistance(
                    this.storeLocation.lat, this.storeLocation.lng,
                    formData.lat, formData.lng
                );
                priority = this.calculatePriority(formData.orderTime, slaDeadline, distance);
                console.log(`New order ${formData.orderId} calculated distance from customer data: ${distance}km`);
            }

            // Create order object
            const order = {
                ...formData,
                id: Date.now(), // Unique ID
                distance: distance,
                slaDeadline: slaDeadline,
                status: 'pending',
                addedAt: new Date(),
                priority: priority
            };

            // Add order immediately to show in list
            this.orders.push(order);
            this.saveOrdersToStorage();
            this.refreshOrdersDisplay();
            this.clearOrderForm();
            
            // Add to map if we have coordinates
            if (distance) {
                this.addOrderToMap(order);
                this.showNotification(`Order ${order.orderId} added with distance ${distance.toFixed(2)}km!`, 'success');
            } else {
                this.showNotification(`Order ${order.orderId} added! Location data may be incomplete.`, 'warning');
            }
        } catch (error) {
            console.error('Error adding new order:', error);
            alert(error.message || 'Error adding order. Please try again.');
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
                    <span class="order-info-label">Customer:</span>
                    <span class="order-info-value">${order.customerName}</span>
                </div>
                <div class="order-info-item">
                    <span class="order-info-label">Address:</span>
                    <span class="order-info-value">${order.customerAddress}</span>
                </div>
                <div class="order-info-item">
                    <span class="order-info-label">Phone:</span>
                    <span class="order-info-value">${order.customerPhone}</span>
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
        
        // Check if busy rider should be made available (less than 15 minutes remaining)
        if (rider.status === 'busy' && rider.expectedFreeTime) {
            const now = new Date();
            const timeDiff = rider.expectedFreeTime.getTime() - now.getTime();
            const minutesRemaining = Math.floor(timeDiff / (1000 * 60));
            
            // If less than 15 minutes remaining, make rider available
            if (minutesRemaining < 15) {
                rider.status = 'available';
                rider.currentOrder = null;
                rider.expectedFreeTime = null;
                
                // Also update any orders assigned to this rider to mark them as delivered
                this.orders.forEach(order => {
                    if (order.assignedRider === selectedRider && order.status === 'out_for_delivery') {
                        order.status = 'delivered';
                        order.deliveredAt = new Date();
                        delete order.expectedReturnTime;
                        this.updateOrderMarkerStyle(order);
                    }
                });
                
                this.saveOrdersToStorage();
                this.refreshAllDisplays();
            }
        }
        
        if (rider.status === 'available') {
            riderStatus.innerHTML = `
                <div><i class="fas fa-check-circle"></i> ${rider.name} is available and ready for delivery.</div>
            `;
            riderStatus.className = 'rider-status available';
        } else {
            const busyOrderId = rider.currentOrder ? rider.currentOrder.orderId : 'Unknown';
            const expectedFreeTime = rider.expectedFreeTime;
            
            let timeMessage = '';
            if (expectedFreeTime) {
                const now = new Date();
                const timeDiff = expectedFreeTime.getTime() - now.getTime();
                
                if (timeDiff > 0) {
                    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
                    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                    
                    if (hours > 0) {
                        timeMessage = `Expected free in ${hours}h ${minutes}m`;
                    } else {
                        timeMessage = `Expected free in ${minutes}m`;
                    }
                    
                    // Add auto-availability indicator if less than 15 minutes
                    if (minutes < 15 && hours === 0) {
                        timeMessage += ` 🟢 (Auto-available soon)`;
                    }
                    
                    timeMessage += ` (${this.formatTime(expectedFreeTime)})`;
                } else {
                    timeMessage = 'Should be available soon (overdue)';
                }
            } else {
                timeMessage = 'Expected free time unknown';
            }
            
            riderStatus.innerHTML = `
                <div>
                    <div><i class="fas fa-exclamation-triangle"></i> ${rider.name} is currently busy with order ${busyOrderId}.</div>
                    <div style="margin-top: 8px; font-size: 0.9em; color: #374151;">
                        ⏱️ ${timeMessage}
                    </div>
                </div>
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

        const rider = this.riders[selectedRider];
        if (rider.status !== 'available') {
            this.showNotification(`${rider.name} is not available`, 'error');
            return;
        }

        // Check if this is a batch assignment or single order
        if (this.pendingBatchAssignment) {
            // Assign rider to entire batch
            this.assignRiderToBatch(this.pendingBatchAssignment, selectedRider);
        } else if (this.pendingRiderAssignment) {
            // Assign rider to single order
            this.assignRiderAndStartDelivery(this.pendingRiderAssignment.id, selectedRider);
        } else {
            this.showNotification('No order or batch selected for assignment', 'error');
            return;
        }
        
        this.closeRiderModal();
    },

    assignRiderAndStartDelivery(orderId, riderId) {
        const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
        if (orderIndex !== -1) {
            const order = this.orders[orderIndex];
            
            // Calculate expected return time
            const deliveryTime = this.calculateDeliveryTime(order.distance);
            const expectedReturnTime = new Date(Date.now() + deliveryTime * 60 * 60 * 1000);
            
            // Update order status and assign rider
            this.orders[orderIndex].status = 'out_for_delivery';
            this.orders[orderIndex].assignedRider = riderId;
            this.orders[orderIndex].deliveryStartedAt = new Date();
            this.orders[orderIndex].expectedReturnTime = expectedReturnTime;
            
            // Update rider status with expected return time
            this.riders[riderId].status = 'busy';
            this.riders[riderId].currentOrder = order;
            this.riders[riderId].expectedFreeTime = expectedReturnTime;
            
            // Update displays
            this.saveOrdersToStorage();
            this.refreshAllDisplays();
            this.updateOrderMarkerStyle(order);
            
            // Show route to the delivery order
            this.showRouteOnMap([order]);
            
            this.showNotification(`Delivery started for order ${order.orderId} with ${this.riders[riderId].name}! 🚚`, 'success');
        }
   },

    assignRiderToBatch(batchOrders, riderId) {
        const rider = this.riders[riderId];
        
        // Calculate batch time estimation directly
        const routeDistance = this.calculateRouteDistance(batchOrders);
        const travelTime = (4.2 * routeDistance) / 60; // hours (4.2 min/km converted to hours)
        const handoverTime = batchOrders.length * (10 / 60); // 10 minutes handover per stop (converted to hours)
        const baseTimeMinutes = (travelTime + handoverTime) * 60; // convert to minutes
        
        // Add 15% buffer to the total delivery time (same as individual orders)
        const bufferMultiplier = 1.15;
        const estimatedTimeMinutes = baseTimeMinutes * bufferMultiplier;
        const expectedReturnTime = new Date(Date.now() + estimatedTimeMinutes * 60 * 1000); // Convert minutes to milliseconds
        
        // Console log breakdown for debugging
        console.log('🚚 Batch Assignment Time Breakdown:');
        console.log(`  Total Route Distance: ${routeDistance.toFixed(2)} km (complete round trip route)`);
        console.log(`  Travel Time: ${(travelTime * 60).toFixed(1)} minutes (${routeDistance.toFixed(2)} km × 4.2 min/km)`);
        console.log(`  Handover Time: ${(handoverTime * 60).toFixed(1)} minutes (${batchOrders.length} stops × 10 min/stop)`);
        console.log(`  Base Total: ${baseTimeMinutes.toFixed(1)} minutes`);
        console.log(`  With 15% Buffer: ${estimatedTimeMinutes.toFixed(1)} minutes`);
        console.log(`  Expected Return Time: ${expectedReturnTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
        
        // Update all orders in the batch
        batchOrders.forEach(order => {
            const orderIndex = this.orders.findIndex(o => o.id === order.id);
            if (orderIndex !== -1) {
                this.orders[orderIndex].status = 'out_for_delivery';
                this.orders[orderIndex].assignedRider = riderId;
                this.orders[orderIndex].deliveryStartedAt = new Date();
                this.orders[orderIndex].expectedReturnTime = expectedReturnTime;
                this.orders[orderIndex].batchId = `batch_${Date.now()}`; // Add batch identifier
                
                // Update marker style for each order
                this.updateOrderMarkerStyle(this.orders[orderIndex]);
            }
        });
        
        // Update rider status - rider gets the total time for the entire batch
        rider.status = 'busy';
        rider.currentOrder = {
            orderId: `Batch (${batchOrders.length} orders)`,
            batchOrders: batchOrders.map(o => o.orderId).join(', ')
        };
        rider.expectedFreeTime = expectedReturnTime;
        
        // Update displays
        this.saveOrdersToStorage();
        this.refreshAllDisplays();
        
        // Show route for the entire batch
        this.showRouteOnMap(batchOrders);
        
        const orderIds = batchOrders.map(o => o.orderId).join(', ');
        this.showNotification(`Batch delivery started for orders [${orderIds}] with ${rider.name}! 🚛`, 'success');
    },

    closeRiderModal() {
        const modal = document.getElementById('riderAssignmentModal');
        if (modal) {
            modal.style.display = 'none';
        }
        this.pendingRiderAssignment = null;
        this.pendingBatchAssignment = null;
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
                this.riders[order.assignedRider].expectedFreeTime = null;
            }
            
            // Reset to selected status
            this.orders[orderIndex].status = 'selected';
            delete this.orders[orderIndex].deliveryStartedAt;
            delete this.orders[orderIndex].assignedRider;
            delete this.orders[orderIndex].expectedReturnTime;
            
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
                    this.riders[order.assignedRider].expectedFreeTime = null;
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
    },

    showBatchRiderAssignmentModal(orderIds) {
        const batchOrders = orderIds.map(id => this.orders.find(order => order.id === parseInt(id))).filter(order => order);
        
        if (batchOrders.length === 0) {
            this.showNotification('No valid orders found in batch', 'error');
            return;
        }

        // Store the batch for assignment
        this.pendingBatchAssignment = batchOrders;

        // Calculate batch metrics directly
        const routeDistance = this.calculateRouteDistance(batchOrders);
        const travelTime = (4.2 * routeDistance) / 60; // hours (4.2 min/km converted to hours)
        const handoverTime = batchOrders.length * (10 / 60); // 10 minutes handover per stop (converted to hours)
        const baseTimeMinutes = (travelTime + handoverTime) * 60; // convert to minutes
        
        // Add 15% buffer to the total delivery time (same as individual orders)
        const bufferMultiplier = 1.15;
        const estimatedTimeMinutes = baseTimeMinutes * bufferMultiplier;
        const averagePriority = batchOrders.reduce((sum, order) => sum + order.priority, 0) / batchOrders.length;
        
        // Console log breakdown for debugging
        console.log('🚚 Batch Modal Display Time Breakdown:');
        console.log(`  Total Route Distance: ${routeDistance.toFixed(2)} km (complete round trip route)`);
        console.log(`  Travel Time: ${(travelTime * 60).toFixed(1)} minutes (${routeDistance.toFixed(2)} km × 4.2 min/km)`);
        console.log(`  Handover Time: ${(handoverTime * 60).toFixed(1)} minutes (${batchOrders.length} stops × 10 min/stop)`);
        console.log(`  Base Total: ${baseTimeMinutes.toFixed(1)} minutes`);
        console.log(`  With 15% Buffer: ${estimatedTimeMinutes.toFixed(1)} minutes`);
        console.log(`  Average Priority: ${averagePriority.toFixed(1)}`);

        // Populate modal with batch information
        const modalOrderInfo = document.getElementById('modalOrderInfo');
        if (modalOrderInfo) {
            modalOrderInfo.innerHTML = `
                <h4>🚛 Batch Assignment (${batchOrders.length} orders)</h4>
                <div class="batch-summary">
                    <div class="batch-summary-item">
                        <span class="order-info-label">Total Distance:</span>
                        <span class="order-info-value">${routeDistance.toFixed(2)} km</span>
                    </div>
                    <div class="batch-summary-item">
                        <span class="order-info-label">Estimated Time:</span>
                        <span class="order-info-value">${this.formatDuration(estimatedTimeMinutes / 60)}</span>
                    </div>
                    <div class="batch-summary-item">
                        <span class="order-info-label">Average Priority:</span>
                        <span class="order-info-value">${averagePriority.toFixed(1)}</span>
                    </div>
                </div>
                
                <div class="batch-orders-list">
                    <h5>📦 Orders in this batch:</h5>
                    ${batchOrders.map((order, index) => `
                        <div class="batch-order-summary">
                            <span class="order-sequence">${index + 1}.</span>
                            <div class="order-summary-details">
                                <div class="order-summary-main">
                                    <strong>${order.orderId}</strong> - ${order.customerName} (Zone ${order.zone})
                                </div>
                                <div class="order-summary-meta">
                                    ${order.distance?.toFixed(2) || 'N/A'} km • Priority: ${order.priority} • SLA: ${this.formatTime(order.slaDeadline)}
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div class="batch-warning">
                    <i class="fas fa-info-circle"></i>
                    <strong>Note:</strong> All orders in this batch will be assigned to the same rider for optimized delivery.
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
});
