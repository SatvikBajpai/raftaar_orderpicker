// UI Manager Module
// Handles all UI rendering, display updates, and visual components

// Extend OrderPickingTool with UI management methods
Object.assign(OrderPickingTool.prototype, {
    
    refreshOrdersDisplay() {
        this.updateStatistics();
        this.renderOrdersList();
        this.updateMapMarkers();
    },

    refreshDeliveryDisplay() {
        this.updateDeliveryStatistics();
        this.renderDeliveryList();
    },

    // Comprehensive refresh for both tabs and all UI elements
    refreshAllDisplays() {
        this.refreshOrdersDisplay();
        this.refreshDeliveryDisplay();
        this.updateMapMarkers();
    },

    updateStatistics() {
        const stats = {
            highPriority: 0,
            normal: 0,
            nextDay: 0
        };

        // Count both pending and selected orders for queue statistics
        const queueOrders = this.orders.filter(order => 
            order.status === 'pending' || order.status === 'selected'
        );
        
        queueOrders.forEach(order => {
            const level = this.getPriorityLevel(order.orderTime, order.slaDeadline);
            if (level === 'high-priority' || level === 'overdue') {
                stats.highPriority++;
            } else if (level === 'next-day') {
                stats.nextDay++;
            } else {
                stats.normal++;
            }
        });

        const highPriorityEl = document.getElementById('highPriorityCount');
        const normalEl = document.getElementById('normalCount');
        const nextDayEl = document.getElementById('nextDayCount');

        if (highPriorityEl) highPriorityEl.textContent = stats.highPriority;
        if (normalEl) normalEl.textContent = stats.normal;
        if (nextDayEl) nextDayEl.textContent = stats.nextDay;
    },

    updateDeliveryStatistics() {
        const deliveryOrders = this.orders.filter(order => order.status === 'out_for_delivery');
        const deliveryCountEl = document.getElementById('deliveryCount');
        
        if (deliveryCountEl) {
            deliveryCountEl.textContent = deliveryOrders.length;
        }
    },

    renderOrdersList() {
        const container = document.getElementById('ordersList');
        
        if (!container) {
            console.error('ordersList element not found in DOM');
            return;
        }
        
        // Show both pending and selected orders in the queue tab
        const queueOrders = this.orders.filter(order => 
            order.status === 'pending' || order.status === 'selected'
        );
        
        if (queueOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>No orders in queue. Add an order to get started.</p>
                </div>
            `;
            return;
        }

        // Sort orders by priority (highest first)
        const sortedOrders = [...queueOrders].sort((a, b) => b.priority - a.priority);

        container.innerHTML = sortedOrders.map(order => {
            const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
            const timeRemaining = this.formatTimeRemaining(order.slaDeadline);
            const statusClass = this.getStatusClass(order.status);
            const statusIcon = this.getStatusIcon(order.status);
            const statusLabel = this.getStatusLabel(order.status);
            
            return `
                <div class="order-card ${priorityLevel} ${statusClass}" data-order-id="${order.id}" onclick="orderPickingTool.showOrderOnMap('${order.id}')" title="Click to show order location and route on map" style="cursor: pointer;">
                    <div class="order-header">
                        <span class="order-id">${order.orderId} <i class="fas fa-map-marker-alt" style="color: #6b7280; font-size: 0.8em;" title="Click to view on map"></i></span>
                        <div class="order-actions">
                            <span class="priority-badge ${priorityLevel}">${priorityLevel.replace('-', ' ')}</span>
                            <span class="status-badge ${statusClass}">${statusIcon} ${statusLabel}</span>
                            ${this.renderOrderActionButtons(order)}
                        </div>
                    </div>
                    <div class="order-details">
                        <div><strong>📍 Pincode:</strong> ${order.customerPincode}</div>
                        <div><strong>🏢 Zone:</strong> ${order.zone}</div>
                        <div><strong>🕐 Order Time:</strong> ${this.formatTime(order.orderTime)}</div>
                        <div><strong>⏰ SLA Deadline:</strong> ${this.formatTime(order.slaDeadline)}</div>
                        <div><strong>⭐ Priority:</strong> ${order.priority}</div>
                        ${order.assignedRider ? `<div><strong>🏍️ Assigned Rider:</strong> ${this.riders[order.assignedRider].name}</div>` : ''}
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
    },

    renderDeliveryList() {
        const container = document.getElementById('deliveryList');
        
        if (!container) {
            console.error('deliveryList element not found in DOM');
            return;
        }
        
        const deliveryOrders = this.orders.filter(order => order.status === 'out_for_delivery');
        
        if (deliveryOrders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-truck"></i>
                    <p>No orders out for delivery.</p>
                </div>
            `;
            return;
        }

        // Sort delivery orders by delivery start time (most recent first)
        const sortedOrders = [...deliveryOrders].sort((a, b) => 
            new Date(b.deliveryStartedAt || 0) - new Date(a.deliveryStartedAt || 0)
        );

        container.innerHTML = sortedOrders.map(order => {
            const priorityLevel = this.getPriorityLevel(order.orderTime, order.slaDeadline);
            const timeRemaining = this.formatTimeRemaining(order.slaDeadline);
            const statusClass = this.getStatusClass(order.status);
            const statusIcon = this.getStatusIcon(order.status);
            const statusLabel = this.getStatusLabel(order.status);
            const deliveryDuration = order.deliveryStartedAt ? 
                this.formatDuration((new Date() - new Date(order.deliveryStartedAt)) / (1000 * 60 * 60)) : 'Unknown';
            
            return `
                <div class="order-card ${priorityLevel} ${statusClass}" data-order-id="${order.id}" onclick="orderPickingTool.showOrderOnMap('${order.id}')" title="Click to show order location and route on map" style="cursor: pointer;">
                    <div class="order-header">
                        <span class="order-id">${order.orderId} <i class="fas fa-map-marker-alt" style="color: #6b7280; font-size: 0.8em;" title="Click to view on map"></i></span>
                        <div class="order-actions">
                            <span class="priority-badge ${priorityLevel}">${priorityLevel.replace('-', ' ')}</span>
                            <span class="status-badge ${statusClass}">${statusIcon} ${statusLabel}</span>
                            ${this.renderOrderActionButtons(order)}
                        </div>
                    </div>
                    <div class="order-details">
                        <div><strong>📍 Pincode:</strong> ${order.customerPincode}</div>
                        <div><strong>🏢 Zone:</strong> ${order.zone}</div>
                        <div><strong>🕐 Order Time:</strong> ${this.formatTime(order.orderTime)}</div>
                        <div><strong>⏰ SLA Deadline:</strong> ${this.formatTime(order.slaDeadline)}</div>
                        <div><strong>🚚 Delivery Duration:</strong> ${deliveryDuration}</div>
                        <div><strong>⭐ Priority:</strong> ${order.priority}</div>
                        ${order.assignedRider ? `<div><strong>🏍️ Assigned Rider:</strong> ${this.riders[order.assignedRider].name}</div>` : ''}
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
    },

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
    },

    highlightRecommendedOrder(orderId) {
        // Remove previous highlights
        this.removeHighlights();
        
        // Highlight on map
        const markerData = this.orderMarkers.get(parseInt(orderId));
        if (markerData && window.google) {
            markerData.marker.setAnimation(google.maps.Animation.BOUNCE);
            markerData.marker.setZIndex(1000);
        }
        
        // Highlight in list
        const orderCard = document.querySelector(`[data-order-id="${orderId}"]`);
        if (orderCard) {
            orderCard.classList.add('recommended-highlight');
            orderCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    },

    removeHighlights() {
        // Remove map highlights
        this.orderMarkers.forEach(markerData => {
            if (window.google) {
                markerData.marker.setAnimation(null);
                markerData.marker.setZIndex(null);
            }
        });
        
        // Remove list highlights
        document.querySelectorAll('.recommended-highlight').forEach(card => {
            card.classList.remove('recommended-highlight');
        });
    },

    clearOrderHighlights() {
        this.removeHighlights();
        // Also clear any batch-related highlights if needed
        document.querySelectorAll('.batch-highlight').forEach(card => {
            card.classList.remove('batch-highlight');
        });
    }
});
