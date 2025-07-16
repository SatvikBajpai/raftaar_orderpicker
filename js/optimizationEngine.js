// Optimization Engine Module
// Handles order optimization algorithms and batch processing

// Extend OrderPickingTool with optimization methods
Object.assign(OrderPickingTool.prototype, {
    
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
            
            console.log('Max orders element:', maxOrdersElement);
            
            if (!maxOrdersElement) {
                console.error('Batch settings elements not found!');
                this.displayOptimizationResult('Batch settings not properly configured.');
                return;
            }
            
            const maxOrders = parseInt(maxOrdersElement.value);
            
            console.log('Batch settings - maxOrders:', maxOrders);
            
            try {
                // For zone-based batching, we don't need max distance parameter
                const batches = this.optimizeBatch(maxOrders, null, strategy);
                console.log('Generated zone batches:', batches);
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
            
            // Show route breakdown for single order too
            if (recommendedOrder) {
                this.showRouteOnMap([recommendedOrder]);
            }
        }
    },

    findClosestOrder(orders) {
        // Simply return the order with minimum distance
        return orders.reduce((closest, current) => {
            return current.distance < closest.distance ? current : closest;
        });
    },

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
    },

    // Zone-based batch optimization
    optimizeBatch(maxOrdersPerBatch, maxDistanceFromStore = null, strategy = 'maximize_orders') {
        console.log('=== ZONE-BASED BATCH OPTIMIZATION ===');
        console.log('optimizeBatch called with:', { maxOrdersPerBatch, strategy });
        
        try {
            if (this.orders.length === 0) {
                console.log('No orders available');
                return [];
            }
            
            // Filter pending orders only (ignore distance constraint for zone-based batching)
            const availableOrders = this.orders.filter(order => 
                order.status === 'pending' && 
                order.zone // Must have a zone
            );
            
            console.log('📋 Total orders:', this.orders.length);
            console.log('📋 Pending orders:', this.orders.filter(o => o.status === 'pending').length);
            console.log('📋 Available orders (with zone):', availableOrders.length);
            
            if (availableOrders.length === 0) {
                console.log('No orders available for zone-based batching');
                return [];
            }

            // Group orders by zone
            const zoneGroups = this.groupOrdersByZone(availableOrders);
            console.log('📋 Zone groups:', Object.keys(zoneGroups).map(zone => `Zone ${zone}: ${zoneGroups[zone].length} orders`));
            
            // Create batches from zone groups
            const batches = this.createZoneBatches(zoneGroups, maxOrdersPerBatch, strategy);
            console.log('📋 Generated zone batches:', batches.length);
            
            // Score and rank each batch
            const scoredBatches = batches.map(batch => {
                const score = this.calculateZoneBatchScore(batch, strategy);
                return { cluster: batch, score };
            });

            // Sort batches by score (highest first)
            scoredBatches.sort((a, b) => b.score - a.score);
            
            console.log('📋 Scored zone batches:', scoredBatches.map(sb => ({ 
                zone: sb.cluster[0]?.zone,
                orderCount: sb.cluster.length, 
                score: sb.score.toFixed(2),
                orderIds: sb.cluster.map(o => o.orderId)
            })));

            return scoredBatches.map(sb => sb.cluster);
            
        } catch (error) {
            console.error('Error in zone-based batch optimization:', error);
            throw error;
        }
    },

    // Group orders by their delivery zone
    groupOrdersByZone(orders) {
        const zoneGroups = {};
        
        orders.forEach(order => {
            const zone = order.zone;
            if (!zoneGroups[zone]) {
                zoneGroups[zone] = [];
            }
            zoneGroups[zone].push(order);
        });
        
        return zoneGroups;
    },

    // Create batches from zone groups
    createZoneBatches(zoneGroups, maxBatchSize, strategy) {
        const batches = [];
        
        // Process each zone
        Object.keys(zoneGroups).forEach(zone => {
            const zoneOrders = zoneGroups[zone];
            
            // Sort orders within zone by priority/strategy
            const sortedOrders = this.sortOrdersInZone(zoneOrders, strategy);
            
            // Split zone into batches if there are too many orders
            for (let i = 0; i < sortedOrders.length; i += maxBatchSize) {
                const batch = sortedOrders.slice(i, i + maxBatchSize);
                batches.push(batch);
            }
        });
        
        return batches;
    },

    // Sort orders within a zone based on strategy
    sortOrdersInZone(orders, strategy) {
        if (strategy === 'maximize_sla') {
            // Sort by priority (highest first), then by SLA deadline (earliest first)
            return orders.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority; // Higher priority first
                }
                return a.slaDeadline.getTime() - b.slaDeadline.getTime(); // Earlier deadline first
            });
        } else {
            // For maximize_orders, sort by distance (closest first), then by priority
            return orders.sort((a, b) => {
                if (a.distance && b.distance) {
                    if (Math.abs(a.distance - b.distance) > 1) { // If distance difference > 1km
                        return a.distance - b.distance; // Closer first
                    }
                }
                return b.priority - a.priority; // Higher priority first if distances are similar
            });
        }
    },

    // Calculate score for a zone-based batch
    calculateZoneBatchScore(batch, strategy) {
        if (batch.length === 0) return 0;
        
        const zone = batch[0].zone;
        let score = 0;
        
        // Base score: number of orders in batch (more is better)
        score += batch.length * 10;
        
        // Zone consistency bonus (all orders in same zone)
        const allSameZone = batch.every(order => order.zone === zone);
        if (allSameZone) {
            score += 50; // Big bonus for zone consistency
        }
        
        if (strategy === 'maximize_sla') {
            // SLA strategy: prioritize urgent orders and deadlines
            const avgPriority = batch.reduce((sum, order) => sum + order.priority, 0) / batch.length;
            score += avgPriority * 5;
            
            // Bonus for urgent orders that can meet SLA
            const now = new Date();
            const urgentOrders = batch.filter(order => {
                const timeToDeadline = (order.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60);
                return timeToDeadline <= 4; // Orders with less than 4 hours to deadline
            });
            score += urgentOrders.length * 15;
            
        } else {
            // Maximize orders strategy: efficiency and distance
            if (batch.length > 0 && batch[0].distance) {
                const avgDistance = batch.reduce((sum, order) => sum + (order.distance || 0), 0) / batch.length;
                // Bonus for closer zones (inverse relationship)
                score += Math.max(0, (20 - avgDistance)) * 2;
            }
            
            // Bonus for having more orders (efficiency)
            if (batch.length >= 3) {
                score += (batch.length - 2) * 8;
            }
        }
        
        // Priority bonus
        const highPriorityCount = batch.filter(order => order.priority >= 8).length;
        score += highPriorityCount * 5;
        
        return score;
    },

    calculateRouteDistance(orders) {
        if (orders.length === 0) return 0;
        if (orders.length === 1) return orders[0].distance * 2; // Round trip
        
        // Simple TSP approximation: store -> order1 -> order2 -> ... -> store
        let totalDistance = orders[0].distance; // Store to first order
        
        for (let i = 0; i < orders.length - 1; i++) {
            const fromCoords = this.pincodeData.get(orders[i].customerPincode);
            const toCoords = this.pincodeData.get(orders[i + 1].customerPincode);
            
            if (fromCoords && toCoords) {
                totalDistance += this.calculateDistance(
                    fromCoords.lat, fromCoords.lng,
                    toCoords.lat, toCoords.lng
                );
            }
        }
        
        // Add distance from last order back to store
        const lastOrderCoords = this.pincodeData.get(orders[orders.length - 1].customerPincode);
        if (lastOrderCoords) {
            totalDistance += this.calculateDistance(
                lastOrderCoords.lat, lastOrderCoords.lng,
                this.storeLocation.lat, this.storeLocation.lng
            );
        }
        
        return totalDistance;
    },

    calculateClusterScore(cluster, strategy) {
        const totalDistance = this.calculateRouteDistance(cluster);
        const totalPriority = cluster.reduce((sum, order) => sum + order.priority, 0);
        const avgPriority = totalPriority / cluster.length;
        
        let score = 0;
        
        if (strategy === 'maximize_sla') {
            score = avgPriority * 10 - totalDistance;
        } else {
            score = cluster.length * 50 - totalDistance * 2;
        }
        
        return score;
    },

    displayOptimizationResult(orderOrMessage, reason) {
        // Wait a bit to ensure DOM is ready
        setTimeout(() => {
            try {
                const resultPanel = document.getElementById('optimizationResult');
                const orderContainer = document.getElementById('recommendedOrder');
                
                // Check if required DOM elements exist
                if (!resultPanel) {
                    console.error('optimizationResult element not found in DOM');
                    return;
                }
                
                if (!orderContainer) {
                    console.error('recommendedOrder element not found in DOM');
                    return;
                }
                
                // Handle string messages (like "No orders found")
                if (typeof orderOrMessage === 'string') {
                    orderContainer.innerHTML = `
                        <div class="no-orders-message">
                            <i class="fas fa-info-circle"></i>
                            <p>${orderOrMessage}</p>
                        </div>
                    `;
                    resultPanel.classList.remove('hidden');
                    resultPanel.style.display = 'block';
                    return;
                }
                
                // Handle order objects
                const order = orderOrMessage;
                const deliveryTime = this.calculateDeliveryTime(order.distance);
                const now = new Date();
                const estimatedDelivery = new Date(now.getTime() + deliveryTime * 60 * 60 * 1000);
                const willMeetSLA = estimatedDelivery <= order.slaDeadline;
                
                // Calculate route breakdown for single order
                const routeBreakdown = this.calculateDetailedRouteBreakdown([order]);
                
                orderContainer.innerHTML = `
                    <div class="single-order-result">
                        <h3>📦 Recommended Order: ${order.orderId}</h3>
                        
                        <div class="route-breakdown">
                            <h4>📍 Route Details:</h4>
                            <div class="route-steps">
                                ${routeBreakdown.map((step, index) => `
                                    <div class="route-step">
                                        <span class="step-number">${index + 1}</span>
                                        <span class="step-details">
                                            <strong>${step.from}</strong> → <strong>${step.to}</strong>
                                            <span class="step-distance">${step.distance.toFixed(2)} km</span>
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                            <div class="route-total">
                                <strong>Total Route Distance: ${(order.distance * 2).toFixed(2)} km (round trip)</strong>
                            </div>
                        </div>

                        <div class="order-info">
                            <div><strong>Order ID:</strong> ${order.orderId}</div>
                            <div><strong>Pincode:</strong> ${order.customerPincode}</div>
                            <div><strong>Zone:</strong> ${order.zone}</div>
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
                    </div>
                `;
                
                resultPanel.classList.remove('hidden');
                resultPanel.style.display = 'block';
                
                // Highlight the recommended order
                this.highlightRecommendedOrder(order.id);
                
            } catch (error) {
                console.error('Error in displayOptimizationResult:', error);
                // Show a basic notification instead
                this.showNotification('Optimization complete! Check the results above.', 'info');
            }
        }, 10); // Small delay to ensure DOM is ready
    },

    displayBatchResults(batches) {
        if (!batches || batches.length === 0) {
            this.displayOptimizationResult('No suitable batches found for current settings.');
            return;
        }

        const resultPanel = document.getElementById('optimizationResult');
        const orderContainer = document.getElementById('recommendedOrder');
        
        if (!resultPanel || !orderContainer) {
            console.error('Required DOM elements not found for batch results');
            return;
        }

        const bestBatch = batches[0]; // First batch is highest scored
        const batchZone = bestBatch[0]?.zone || 'Unknown';
        const batchDistance = this.calculateRouteDistance(bestBatch);
        const avgPriority = bestBatch.reduce((sum, order) => sum + order.priority, 0) / bestBatch.length;
        
        // Calculate batch time estimation
        const travelTime = (4.2 * batchDistance) / 60; // hours (4.2 min/km converted to hours)
        const handoverTime = bestBatch.length * (10 / 60); // 10 minutes handover per stop (converted to hours)
        const baseTimeMinutes = (travelTime + handoverTime) * 60; // convert to minutes
        
        // Add 15% buffer to the total delivery time (same as individual orders)
        const bufferMultiplier = 1.15;
        const estimatedTimeMinutes = baseTimeMinutes * bufferMultiplier;
        
        // Console log breakdown for debugging
        console.log('🚚 Batch Time Breakdown (optimizationEngine):');
        console.log(`  Total Route Distance: ${batchDistance.toFixed(2)} km (complete round trip route)`);
        console.log(`  Travel Time: ${(travelTime * 60).toFixed(1)} minutes (${batchDistance.toFixed(2)} km × 4.2 min/km)`);
        console.log(`  Handover Time: ${(handoverTime * 60).toFixed(1)} minutes (${bestBatch.length} stops × 10 min/stop)`);
        console.log(`  Base Total: ${baseTimeMinutes.toFixed(1)} minutes`);
        console.log(`  With 15% Buffer: ${estimatedTimeMinutes.toFixed(1)} minutes`);
        console.log(`  Breakdown: ${(travelTime * 60).toFixed(1)}min travel + ${(handoverTime * 60).toFixed(1)}min handover = ${baseTimeMinutes.toFixed(1)}min base × 1.15 = ${estimatedTimeMinutes.toFixed(1)}min total`);
        
        orderContainer.innerHTML = `
            <div class="batch-result">
                <h3>🚛 Recommended Zone Batch (${bestBatch.length} orders)</h3>
                <div class="batch-summary">
                    <div><strong>Zone:</strong> ${batchZone}</div>
                    <div><strong>Total Distance:</strong> ${batchDistance.toFixed(2)} km</div>
                    <div><strong>Average Priority:</strong> ${avgPriority.toFixed(1)}</div>
                    <div><strong>Estimated Time:</strong> ${this.formatDuration(estimatedTimeMinutes / 60)}</div>
                </div>
                
                <div class="zone-info">
                    <h4>🎯 Zone ${batchZone} Optimization</h4>
                    <p class="zone-description">
                        <i class="fas fa-info-circle"></i>
                        All orders in this batch are in the same delivery zone for maximum efficiency.
                        The rider can complete all deliveries in a single zone trip.
                    </p>
                </div>

                <div class="batch-orders">
                    <h4>📦 Orders in this batch:</h4>
                    ${bestBatch.map((order, index) => `
                        <div class="batch-order-item">
                            <span class="order-sequence">${index + 1}</span>
                            <span class="order-details">${order.orderId} - ${order.customerPincode} (Zone ${order.zone})</span>
                            <span class="order-priority">Priority: ${order.priority}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="batch-actions">
                    <button class="btn btn-primary" onclick="orderPickingTool.selectBatch(${JSON.stringify(bestBatch.map(o => o.id))})">
                        <i class="fas fa-check-double"></i> Assign Zone Batch
                    </button>
                    <button class="btn btn-secondary" onclick="orderPickingTool.showBatchRouteById(${JSON.stringify(bestBatch.map(o => o.id))})">
                        <i class="fas fa-route"></i> Show Route
                    </button>
                </div>
            </div>
        `;

        resultPanel.classList.remove('hidden');
        resultPanel.style.display = 'block';

        // Show route for the recommended batch automatically
        this.showRouteOnMap(bestBatch);
    },

    selectBatch(orderIds) {
        // Mark all orders in batch as selected
        orderIds.forEach(orderId => {
            const orderIndex = this.orders.findIndex(order => order.id === parseInt(orderId));
            if (orderIndex !== -1) {
                this.orders[orderIndex].status = 'selected';
                this.orders[orderIndex].selectedAt = new Date();
                this.updateOrderMarkerStyle(this.orders[orderIndex]);
            }
        });
        
        // Show rider assignment modal for the entire batch
        this.showBatchRiderAssignmentModal(orderIds);
        
        this.saveOrdersToStorage();
        this.refreshAllDisplays();
        this.hideOptimizationResult();
    },

    showBatchRouteById(orderIds) {
        const orders = orderIds.map(id => this.orders.find(o => o.id === id)).filter(o => o);
        this.showRouteOnMap(orders);
    },

    hideOptimizationResult() {
        const resultPanel = document.getElementById('optimizationResult');
        if (resultPanel) {
            resultPanel.classList.add('hidden');
            resultPanel.style.display = 'none';
        }
        this.removeHighlights();
        this.clearOrderHighlights(); // Also clear batch highlights and routes
    },

    calculateDetailedRouteBreakdown(orders) {
        const breakdown = [];
        
        if (orders.length === 0) return breakdown;
        
        // Store to first order
        const firstOrder = orders[0];
        breakdown.push({
            from: 'Store (Raftaar)',
            to: `${firstOrder.orderId} (${firstOrder.customerPincode})`,
            distance: firstOrder.distance
        });
        
        // Between orders
        for (let i = 0; i < orders.length - 1; i++) {
            const fromOrder = orders[i];
            const toOrder = orders[i + 1];
            
            const fromCoords = this.pincodeData.get(fromOrder.customerPincode);
            const toCoords = this.pincodeData.get(toOrder.customerPincode);
            
            let distance = 0;
            if (fromCoords && toCoords) {
                distance = this.calculateDistance(
                    fromCoords.lat, fromCoords.lng,
                    toCoords.lat, toCoords.lng
                );
            }
            
            breakdown.push({
                from: `${fromOrder.orderId} (${fromOrder.customerPincode})`,
                to: `${toOrder.orderId} (${toOrder.customerPincode})`,
                distance: distance
            });
        }
        
        // Last order back to store
        const lastOrder = orders[orders.length - 1];
        const lastOrderCoords = this.pincodeData.get(lastOrder.customerPincode);
        let returnDistance = 0;
        
        if (lastOrderCoords) {
            returnDistance = this.calculateDistance(
                lastOrderCoords.lat, lastOrderCoords.lng,
                this.storeLocation.lat, this.storeLocation.lng
            );
        }
        
        breakdown.push({
            from: `${lastOrder.orderId} (${lastOrder.customerPincode})`,
            to: 'Store (Raftaar)',
            distance: returnDistance
        });
        
        return breakdown;
    },
});
