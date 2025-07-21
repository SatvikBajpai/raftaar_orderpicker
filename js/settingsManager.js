/**
 * Settings Manager - Handles application settings
 * Raftaar Order Picker
 * Author: Development Team
 * Last Updated: July 2025
 */

class SettingsManager {
    constructor() {
        this.settings = {
            avgDeliveryTime: 4.2 // Default value in minutes per km
        };
        this.loadSettings();
        this.initializeUI();
        this.bindEvents();
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('raftaar_settings');
            if (saved) {
                this.settings = { ...this.settings, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
        }
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('raftaar_settings', JSON.stringify(this.settings));
            this.showNotification('Settings saved successfully!', 'success');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showNotification('Failed to save settings', 'error');
        }
    }

    /**
     * Get current average delivery time
     */
    getAvgDeliveryTime() {
        return this.settings.avgDeliveryTime;
    }

    /**
     * Set average delivery time
     */
    setAvgDeliveryTime(value) {
        this.settings.avgDeliveryTime = parseFloat(value);
        this.saveSettings();
    }

    /**
     * Reset settings to default
     */
    resetSettings() {
        this.settings = {
            avgDeliveryTime: 4.2
        };
        this.saveSettings();
        this.updateUI();
        this.showNotification('Settings reset to default', 'info');
    }

    /**
     * Initialize UI elements
     */
    initializeUI() {
        // Show settings toggle after a delay to make it discoverable
        setTimeout(() => {
            const toggle = document.getElementById('settingsToggle');
            if (toggle) {
                toggle.classList.add('visible');
            }
        }, 3000);

        // Update UI with current settings
        this.updateUI();
    }

    /**
     * Update UI elements with current settings
     */
    updateUI() {
        const avgTimeInput = document.getElementById('avgDeliveryTime');
        if (avgTimeInput) {
            avgTimeInput.value = this.settings.avgDeliveryTime.toString();
        }
    }

    /**
     * Bind event listeners
     */
    bindEvents() {
        // Settings toggle button
        const settingsToggle = document.getElementById('settingsToggle');
        if (settingsToggle) {
            settingsToggle.addEventListener('click', () => this.openSettings());
        }

        // Close settings button
        const closeSettings = document.getElementById('closeSettings');
        if (closeSettings) {
            closeSettings.addEventListener('click', () => this.closeSettings());
        }

        // Save settings button
        const saveSettings = document.getElementById('saveSettings');
        if (saveSettings) {
            saveSettings.addEventListener('click', () => this.handleSaveSettings());
        }

        // Reset settings button
        const resetSettings = document.getElementById('resetSettings');
        if (resetSettings) {
            resetSettings.addEventListener('click', () => this.handleResetSettings());
        }

        // Input validation for delivery time
        const avgTimeInput = document.getElementById('avgDeliveryTime');
        if (avgTimeInput) {
            avgTimeInput.addEventListener('input', (e) => this.validateInput(e));
            avgTimeInput.addEventListener('blur', (e) => this.handleInputBlur(e));
        }

        // Close on overlay click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('settings-overlay')) {
                this.closeSettings();
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isSettingsOpen()) {
                this.closeSettings();
            }
        });
    }

    /**
     * Open settings panel
     */
    openSettings() {
        this.updateUI();
        this.showOverlay();
        const panel = document.getElementById('settingsPanel');
        if (panel) {
            panel.style.display = 'block';
        }
    }

    /**
     * Close settings panel
     */
    closeSettings() {
        const panel = document.getElementById('settingsPanel');
        if (panel) {
            panel.style.display = 'none';
        }
        this.hideOverlay();
    }

    /**
     * Check if settings panel is open
     */
    isSettingsOpen() {
        const panel = document.getElementById('settingsPanel');
        return panel && panel.style.display === 'block';
    }

    /**
     * Show overlay
     */
    showOverlay() {
        let overlay = document.querySelector('.settings-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'settings-overlay';
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'block';
    }

    /**
     * Hide overlay
     */
    hideOverlay() {
        const overlay = document.querySelector('.settings-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Handle save settings button click
     */
    handleSaveSettings() {
        const avgTimeInput = document.getElementById('avgDeliveryTime');
        if (avgTimeInput) {
            const newValue = parseFloat(avgTimeInput.value);
            if (newValue >= 1.0 && newValue <= 10.0) {
                this.setAvgDeliveryTime(newValue);
                this.refreshApplicationData();
            } else {
                this.showNotification('Please enter a value between 1.0 and 10.0 minutes per km', 'error');
                return;
            }
        }
        this.closeSettings();
    }

    /**
     * Refresh application data to use new settings
     */
    refreshApplicationData() {
        // Trigger refresh of orders display to update SLA calculations
        if (window.orderPickingTool && window.orderPickingTool.refreshOrdersDisplay) {
            window.orderPickingTool.refreshOrdersDisplay();
        }
        
        // Update delivery display as well
        if (window.orderPickingTool && window.orderPickingTool.refreshDeliveryDisplay) {
            window.orderPickingTool.refreshDeliveryDisplay();
        }
        
        // If there's an active optimization result, refresh it
        const optimizationResult = document.getElementById('optimizationResult');
        if (optimizationResult && !optimizationResult.classList.contains('hidden')) {
            // Re-run optimization to update with new travel time
            if (window.orderPickingTool && window.orderPickingTool.optimizePickingOrder) {
                setTimeout(() => {
                    window.orderPickingTool.optimizePickingOrder();
                }, 100);
            }
        }
        
        this.showNotification('Settings applied and calculations updated!', 'success');
    }

    /**
     * Handle reset settings button click
     */
    handleResetSettings() {
        if (confirm('Are you sure you want to reset all settings to default?')) {
            this.resetSettings();
            this.refreshApplicationData();
        }
    }

    /**
     * Validate input as user types
     */
    validateInput(event) {
        const input = event.target;
        const value = parseFloat(input.value);
        
        // Remove any existing validation classes
        input.classList.remove('input-valid', 'input-invalid');
        
        if (input.value === '') {
            return; // Allow empty for typing
        }
        
        if (isNaN(value) || value < 1.0 || value > 10.0) {
            input.classList.add('input-invalid');
        } else {
            input.classList.add('input-valid');
        }
    }

    /**
     * Handle input blur (when user clicks away)
     */
    handleInputBlur(event) {
        const input = event.target;
        const value = parseFloat(input.value);
        
        if (input.value === '' || isNaN(value)) {
            input.value = this.settings.avgDeliveryTime.toString();
            input.classList.remove('input-invalid');
            input.classList.add('input-valid');
        } else if (value < 1.0) {
            input.value = '1.0';
            input.classList.remove('input-invalid');
            input.classList.add('input-valid');
        } else if (value > 10.0) {
            input.value = '10.0';
            input.classList.remove('input-invalid');
            input.classList.add('input-valid');
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${this.getNotificationIcon(type)}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
            z-index: 3000;
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;

        // Add animation styles
        if (!document.querySelector('#notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(notification);

        // Auto remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Get notification icon based on type
     */
    getNotificationIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-triangle',
            warning: 'exclamation-circle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    /**
     * Get notification color based on type
     */
    getNotificationColor(type) {
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        return colors[type] || '#3b82f6';
    }
}

// Initialize settings manager
document.addEventListener('DOMContentLoaded', () => {
    window.settingsManager = new SettingsManager();
});

// Make it available globally
window.SettingsManager = SettingsManager;
