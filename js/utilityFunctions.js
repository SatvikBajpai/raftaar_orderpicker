// Utility Functions Module
// Contains calculation methods, SLA logic, and general utilities

// Extend OrderPickingTool with utility methods
Object.assign(OrderPickingTool.prototype, {
    
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
    },

    toRadians(degrees) {
        return degrees * (Math.PI / 180);
    },

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
    },

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
    },

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
    },

    calculateDeliveryTime(distance) {
        // Base delivery time calculation
        const travelTime = distance / this.averageSpeed; // Travel time in hours
        const preparationTime = 0.25; // 15 minutes preparation time
        const deliveryTime = 0.17; // 10 minutes delivery time
        
        const baseTime = travelTime + preparationTime + deliveryTime;
        
        // Add 15% buffer to the total delivery time
        const bufferMultiplier = 1.15;
        
        return baseTime * bufferMultiplier;
    },

    formatTime(date) {
        return date.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    },

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
    },

    formatDuration(hours) {
        const totalMinutes = Math.round(hours * 60);
        const hrs = Math.floor(totalMinutes / 60);
        const mins = totalMinutes % 60;
        
        if (hrs > 0) {
            return `${hrs}h ${mins}m`;
        } else {
            return `${mins}m`;
        }
    },

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
    },

    getStatusClass(status) {
        const statusClasses = {
            'pending': 'status-pending',
            'selected': 'status-selected',
            'out_for_delivery': 'status-out-for-delivery',
            'delivered': 'status-delivered',
            'cancelled': 'status-cancelled'
        };
        return statusClasses[status] || 'status-pending';
    },

    getStatusIcon(status) {
        const statusIcons = {
            'pending': '⏳',
            'selected': '📋',
            'out_for_delivery': '🚚',
            'delivered': '✅',
            'cancelled': '❌'
        };
        return statusIcons[status] || '⏳';
    },

    getStatusLabel(status) {
        const statusLabels = {
            'pending': 'Pending',
            'selected': 'Selected for Delivery',
            'out_for_delivery': 'Out for Delivery',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return statusLabels[status] || 'Pending';
    },

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
});
