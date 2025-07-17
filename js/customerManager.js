// Customer Management Module
// Handles customer database, selection, and management

// Extend OrderPickingTool with customer management methods
Object.assign(OrderPickingTool.prototype, {
    
    // Initialize customer management
    initCustomerManagement() {
        console.log('Initializing customer management...');
        
        // Initialize empty customers array
        this.customers = [];
        
        // Hide customer modal on initialization (prevent auto-show on page load)
        this.hideCustomerModal();
        
        // Set up event listeners first
        this.setupCustomerEventListeners();
        
        // Load customers from Google Sheets
        this.loadCustomersFromGoogleSheets();
    },
    
    // Google Sheets configuration
    getGoogleSheetsConfig() {
        return {
            spreadsheetId: '1NNF4Pybiq-jmM_bkFWYTGxwBHqWbCPPgpl1Brmlk_IA',
            range: 'Sheet1!A:E', // Customer Name, Customer Number, Latitude, Longitude, Zone
            apiKey: 'AIzaSyDr-DYch4S-JeL-sTlbixPKSjgOJiHLe8A' // Using the existing Maps API key
        };
    },
    
    // Load customers from Google Sheets
    async loadCustomersFromGoogleSheets() {
        try {
            console.log('🔄 Loading customers from Google Sheets...');
            
            const config = this.getGoogleSheetsConfig();
            
            // Use a CORS proxy for local development
            const corsProxy = 'https://api.allorigins.win/get?url=';
            
            // Try different approaches to access the public sheet
            const attempts = [
                {
                    name: 'CORS Proxy + CSV Export',
                    url: `${corsProxy}${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/export?format=csv&gid=0`)}`,
                    type: 'cors-csv'
                },
                {
                    name: 'CORS Proxy + Public CSV',
                    url: `${corsProxy}${encodeURIComponent(`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/pub?gid=0&single=true&output=csv`)}`,
                    type: 'cors-csv'
                },
                {
                    name: 'Sheets API',
                    url: `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${config.range}?key=${config.apiKey}`,
                    type: 'api'
                }
            ];
            
            let success = false;
            let lastError = null;
            
            for (const attempt of attempts) {
                try {
                    console.log(`📡 Trying ${attempt.name}:`, attempt.url);
                    
                    const response = await fetch(attempt.url);
                    
                    if (response.ok) {
                        console.log(`✅ ${attempt.name} successful`);
                        
                        if (attempt.type === 'cors-csv') {
                            const data = await response.json();
                            let csvText = data.contents;
                            
                            // Check if the response is base64 encoded
                            if (csvText.startsWith('data:text/csv;base64,')) {
                                // Decode base64
                                const base64Data = csvText.split(',')[1];
                                csvText = atob(base64Data);
                                console.log('📊 Decoded CSV Response first 200 chars:', csvText.substring(0, 200));
                            } else {
                                console.log('📊 CORS CSV Response first 200 chars:', csvText.substring(0, 200));
                            }
                            
                            // Check if it's actually CSV data (not a login page)
                            if (csvText && !csvText.includes('Sign in') && !csvText.includes('Google Docs') && !csvText.includes('<html>')) {
                                this.customers = this.parseCSVData(csvText);
                                if (this.customers.length > 0) {
                                    success = true;
                                    break;
                                }
                            } else {
                                console.log(`❌ ${attempt.name} returned login page or invalid content`);
                            }
                        } else if (attempt.type === 'api') {
                            const data = await response.json();
                            console.log('📊 API Response:', data);
                            
                            if (data.values && data.values.length > 0) {
                                this.customers = this.parseGoogleSheetData(data.values);
                                if (this.customers.length > 0) {
                                    success = true;
                                    break;
                                }
                            }
                        }
                    } else {
                        console.log(`❌ ${attempt.name} failed with status:`, response.status);
                        const errorText = await response.text();
                        lastError = `${attempt.name} failed: ${response.status} - ${errorText.substring(0, 100)}`;
                    }
                    
                } catch (error) {
                    console.log(`❌ ${attempt.name} error:`, error.message);
                    lastError = `${attempt.name} error: ${error.message}`;
                }
            }
            
            if (!success) {
                throw new Error(`All Google Sheets access methods failed. Last error: ${lastError}`);
            }
            
            console.log(`✅ Successfully loaded ${this.customers.length} customers from Google Sheets`);
            console.log('👥 First few customers:', this.customers.slice(0, 3));
            
            // Cache coordinates in pincodeData for quick lookup (if pincode exists)
            this.customers.forEach(customer => {
                if (customer.lat && customer.lng && customer.pincode) {
                    this.pincodeData.set(customer.pincode, { 
                        lat: customer.lat, 
                        lng: customer.lng 
                    });
                }
            });
            
            // Populate dropdown
            this.populateCustomerDropdown();
            
            // Show success notification
            this.showNotification(`✅ Loaded ${this.customers.length} customers from Google Sheets`, 'success');
            
        } catch (error) {
            console.error('❌ Error loading customers from Google Sheets:', error);
            this.customers = [];
            this.populateCustomerDropdown();
            this.showNotification(`❌ Failed to load customer data from Google Sheets: ${error.message}. Please serve the application through a web server (not file://) or make sure the sheet is publicly accessible.`, 'error');
        }
    },
    
    // Parse CSV data into customer objects
    parseCSVData(csvText) {
        const customers = [];
        const lines = csvText.trim().split('\n');
        
        console.log(`📊 Found ${lines.length} CSV lines (including header)`);
        
        // Skip header row (index 0)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            // Parse CSV line (handle quoted values)
            const row = this.parseCSVLine(line);
            
            try {
                const customer = {
                    id: `CUST${i.toString().padStart(3, '0')}`, // Generated ID
                    name: row[0] || '', // Customer Name (Column A)
                    phone: row[1] || '', // Customer Number/Phone (Column B)
                    address: `${row[0]} - Zone ${row[4] || 'Unmapped'}`, // Generated address from name and zone
                    pincode: '', // Not available in this sheet structure
                    zone: row[4] || '', // Zone (Column E)
                    lat: parseFloat(row[2]) || null, // Latitude (Column C)
                    lng: parseFloat(row[3]) || null, // Longitude (Column D)
                    isValidZone: this.isValidZone(row[4]) // Add zone validation flag
                };
                
                // Validate required fields (including valid zone for batching)
                if (customer.name && customer.phone && customer.lat && customer.lng) {
                    customers.push(customer);
                    
                    if (!customer.isValidZone) {
                        console.log(`⚠️ Parsed customer with unmapped zone: ${customer.name} - Zone: "${customer.zone}" (excluded from batching)`);
                    } else {
                        console.log(`✅ Parsed CSV customer: ${customer.name} - Zone ${customer.zone}`);
                    }
                } else {
                    console.warn(`⚠️ Skipping incomplete CSV customer row ${i + 1}:`, {
                        name: customer.name,
                        phone: customer.phone,
                        zone: customer.zone,
                        lat: customer.lat,
                        lng: customer.lng,
                        isValidZone: customer.isValidZone
                    });
                }
                
            } catch (error) {
                console.warn(`⚠️ Error parsing CSV customer row ${i + 1}:`, error, row);
            }
        }
        
        return customers;
    },
    
    // Simple CSV line parser (handles quoted values)
    parseCSVLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    },

    // Parse Google Sheet data into customer objects
    parseGoogleSheetData(values) {
        const customers = [];
        
        // Skip header row (index 0)
        for (let i = 1; i < values.length; i++) {
            const row = values[i];
            
            // Skip empty rows
            if (!row || row.length === 0 || !row[0]) continue;
            
            try {
                const customer = {
                    id: `CUST${i.toString().padStart(3, '0')}`, // Generated ID
                    name: row[0] || '', // Customer Name (Column A)
                    phone: row[1] || '', // Customer Number/Phone (Column B)
                    address: `${row[0]} - Zone ${row[4] || 'Unmapped'}`, // Generated address from name and zone
                    pincode: '', // Not available in this sheet structure
                    zone: row[4] || '', // Zone (Column E)
                    lat: parseFloat(row[2]) || null, // Latitude (Column C)
                    lng: parseFloat(row[3]) || null, // Longitude (Column D)
                    isValidZone: this.isValidZone(row[4]) // Add zone validation flag
                };
                
                // Validate required fields (including valid zone for batching)
                if (customer.name && customer.phone && customer.lat && customer.lng) {
                    customers.push(customer);
                    
                    if (!customer.isValidZone) {
                        console.log(`⚠️ Parsed customer with unmapped zone: ${customer.name} - Zone: "${customer.zone}" (excluded from batching)`);
                    } else {
                        console.log(`✅ Parsed customer: ${customer.name} - Zone ${customer.zone}`);
                    }
                } else {
                    console.warn(`⚠️ Skipping incomplete customer row ${i + 1}:`, {
                        name: customer.name,
                        phone: customer.phone,
                        zone: customer.zone,
                        lat: customer.lat,
                        lng: customer.lng
                    });
                }
                
            } catch (error) {
                console.warn(`⚠️ Error parsing customer row ${i + 1}:`, error, row);
            }
        }
        
        return customers;
    },
    
    // Refresh customer data from Google Sheets
    async refreshCustomerData() {
        console.log('🔄 Refreshing customer data...');
        await this.loadCustomersFromGoogleSheets();
    },
    
    // Load customers from localStorage
    loadCustomersFromStorage() {
        try {
            const stored = localStorage.getItem('raftaar_customers');
            return stored ? JSON.parse(stored) : null;
        } catch (error) {
            console.error('Error loading customers from storage:', error);
            return null;
        }
    },
    
    // Save customers to localStorage
    saveCustomersToStorage() {
        try {
            localStorage.setItem('raftaar_customers', JSON.stringify(this.customers));
            console.log('Customers saved to storage');
        } catch (error) {
            console.error('Error saving customers to storage:', error);
        }
    },
    
    // Populate customer dropdown
    populateCustomerDropdown(customers = null, loadingText = null) {
        const select = document.getElementById('customerSelect');
        if (!select) return;
        
        // Clear existing options
        select.innerHTML = '';
        
        if (loadingText) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = loadingText;
            option.disabled = true;
            select.appendChild(option);
            select.disabled = true;
            return;
        }
        
        select.disabled = false;
        select.innerHTML = '<option value="">Select Customer</option>';
        
        const customersToUse = customers || this.customers;
        
        if (customersToUse.length === 0) {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No customers available';
            option.disabled = true;
            select.appendChild(option);
            return;
        }
        
        // Sort customers by name
        const sortedCustomers = [...customersToUse].sort((a, b) => a.name.localeCompare(b.name));
        
        sortedCustomers.forEach(customer => {
            const option = document.createElement('option');
            option.value = customer.id;
            
            // Show unmapped zone status in dropdown
            const zoneDisplay = customer.isValidZone ? 
                `Zone ${customer.zone}` : 
                `Zone ${customer.zone || 'Unmapped'} ⚠️`;
            
            option.textContent = `${customer.name} - ${customer.phone} (${zoneDisplay})`;
            option.dataset.zone = customer.zone;
            option.dataset.pincode = customer.pincode;
            option.dataset.lat = customer.lat;
            option.dataset.lng = customer.lng;
            option.dataset.phone = customer.phone;
            option.dataset.isValidZone = customer.isValidZone;
            
            // Add visual styling for unmapped customers
            if (!customer.isValidZone) {
                option.style.color = '#ff6b35';
                option.style.fontStyle = 'italic';
            }
            
            select.appendChild(option);
        });
        
        console.log(`Populated dropdown with ${sortedCustomers.length} customers`);
    },
    
    // Set up customer management event listeners
    setupCustomerEventListeners() {
        // Customer selection change
        const customerSelect = document.getElementById('customerSelect');
        if (customerSelect) {
            customerSelect.addEventListener('change', (e) => {
                this.handleCustomerSelection(e.target.value);
            });
        }
    },
    
    // Handle customer selection
    handleCustomerSelection(customerId) {
        const zoneSelect = document.getElementById('orderZone');
        if (!zoneSelect) return;
        
        if (!customerId) {
            zoneSelect.value = '';
            zoneSelect.disabled = true;
            zoneSelect.innerHTML = '<option value="">Auto-filled from customer</option>';
            return;
        }
        
        const customer = this.customers.find(c => c.id === customerId);
        if (customer) {
            // Auto-fill zone
            const zoneDisplay = customer.isValidZone ? 
                `Zone ${customer.zone} (Auto-filled)` : 
                `Zone ${customer.zone || 'Unmapped'} (Auto-filled) ⚠️ Excluded from batching`;
                
            zoneSelect.innerHTML = `<option value="${customer.zone}" selected class="zone-auto-filled">${zoneDisplay}</option>`;
            zoneSelect.value = customer.zone;
            zoneSelect.disabled = true;
            
            // Show warning for unmapped zones
            if (!customer.isValidZone) {
                console.warn(`⚠️ Selected customer has unmapped zone: ${customer.name} - Zone: "${customer.zone}"`);
                zoneSelect.style.color = '#ff6b35';
            } else {
                zoneSelect.style.color = '';
            }
            
            console.log(`Selected customer: ${customer.name}, Zone: ${customer.zone}, Valid: ${customer.isValidZone}`);
        }
    },
    
    // Show customer modal
    showCustomerModal() {
        const modal = document.getElementById('customerModal');
        if (modal) {
            modal.style.display = 'block';
            // Clear form
            document.getElementById('customerForm').reset();
        }
    },
    
    // Hide customer modal
    hideCustomerModal() {
        const modal = document.getElementById('customerModal');
        if (modal) {
            modal.style.display = 'none';
        }
    },
    
    // Handle customer form submission
    async handleCustomerFormSubmit() {
        const formData = {
            id: this.generateCustomerId(),
            name: document.getElementById('customerName').value.trim(),
            phone: document.getElementById('customerPhone').value.trim(),
            address: document.getElementById('customerAddress').value.trim(),
            pincode: document.getElementById('customerPincode').value.trim(),
            zone: document.getElementById('customerZone').value,
            lat: parseFloat(document.getElementById('customerLat').value) || null,
            lng: parseFloat(document.getElementById('customerLng').value) || null
        };
        
        // Validation
        if (!formData.name || !formData.phone || !formData.address || !formData.pincode || !formData.zone) {
            alert('Please fill in all required fields');
            return;
        }
        
        if (!formData.lat || !formData.lng) {
            alert('Please provide valid coordinates. Use the "Auto-fill Coordinates" button if needed.');
            return;
        }
        
        // Check for duplicate phone/address
        const duplicate = this.customers.find(c => 
            c.phone === formData.phone || 
            (c.address.toLowerCase() === formData.address.toLowerCase() && c.pincode === formData.pincode)
        );
        
        if (duplicate) {
            alert('A customer with this phone number or address already exists.');
            return;
        }
        
        try {
            // Show loading
            const submitBtn = document.querySelector('#customerForm button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
            submitBtn.disabled = true;
            
            // Add customer locally first
            this.customers.push(formData);
            this.populateCustomerDropdown();
            
            // Select the new customer
            document.getElementById('customerSelect').value = formData.id;
            this.handleCustomerSelection(formData.id);
            
            this.hideCustomerModal();
            
            // Cache coordinates for this customer
            this.pincodeData.set(formData.pincode, { lat: formData.lat, lng: formData.lng });
            
            console.log('New customer added locally:', formData);
            
            // Note: Adding to Google Sheets would require authentication and write permissions
            // For now, we'll show a message about manual addition to the sheet
            alert(`Customer "${formData.name}" added locally!\n\n📝 Please manually add this customer to your Google Sheet:\n\nCustomer Name: ${formData.name}\nCustomer Number: ${formData.phone}\nLatitude: ${formData.lat}\nLongitude: ${formData.lng}\nZone: ${formData.zone}\n\nAdd this as a new row in your Google Sheet.`);
            
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
        } catch (error) {
            console.error('Error adding customer:', error);
            alert('Error adding customer. Please try again.');
            
            // Reset button
            const submitBtn = document.querySelector('#customerForm button[type="submit"]');
            submitBtn.innerHTML = '<i class="fas fa-save"></i> Save Customer';
            submitBtn.disabled = false;
        }
    },
    
    // Generate unique customer ID
    generateCustomerId() {
        const prefix = 'CUST';
        const timestamp = Date.now().toString().slice(-6);
        return `${prefix}${timestamp}`;
    },
    
    // Geocode customer address
    geocodeCustomerAddress() {
        const address = document.getElementById('customerAddress').value.trim();
        const pincode = document.getElementById('customerPincode').value.trim();
        
        if (!address && !pincode) {
            alert('Please enter an address or pincode first');
            return;
        }
        
        const searchQuery = address || `Pincode ${pincode}, India`;
        
        if (this.geocoder) {
            console.log('Geocoding customer address:', searchQuery);
            
            this.geocoder.geocode({ address: searchQuery }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    const lat = location.lat();
                    const lng = location.lng();
                    
                    document.getElementById('customerLat').value = lat.toFixed(6);
                    document.getElementById('customerLng').value = lng.toFixed(6);
                    
                    console.log(`Geocoded "${searchQuery}" to:`, { lat, lng });
                    alert('Coordinates auto-filled successfully!');
                } else {
                    console.error('Geocoding failed:', status);
                    alert('Could not find coordinates for this address. Please enter them manually.');
                }
            });
        } else {
            alert('Geocoding service not available. Please enter coordinates manually.');
        }
    },
    
    // Auto-fill coordinates when pincode is entered in customer form
    autoFillCoordinatesForCustomer(pincode) {
        // Check if we already have coordinates for this pincode
        if (this.pincodeData.has(pincode)) {
            const coords = this.pincodeData.get(pincode);
            document.getElementById('customerLat').value = coords.lat.toFixed(6);
            document.getElementById('customerLng').value = coords.lng.toFixed(6);
            console.log(`Used cached coordinates for pincode ${pincode}`);
            return;
        }
        
        // Otherwise, geocode the pincode
        if (this.geocoder) {
            const searchQuery = `Pincode ${pincode}, India`;
            
            this.geocoder.geocode({ address: searchQuery }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    const location = results[0].geometry.location;
                    const lat = location.lat();
                    const lng = location.lng();
                    
                    document.getElementById('customerLat').value = lat.toFixed(6);
                    document.getElementById('customerLng').value = lng.toFixed(6);
                    
                    // Cache for future use
                    this.pincodeData.set(pincode, { lat, lng });
                    
                    console.log(`Geocoded pincode ${pincode} to:`, { lat, lng });
                } else {
                    console.log(`Could not geocode pincode ${pincode}`);
                }
            });
        }
    },
    
    // Get customer by ID
    getCustomerById(customerId) {
        return this.customers.find(c => c.id === customerId);
    },
    
    // Refresh customer data from Google Sheets
    async refreshCustomerData() {
        try {
            console.log('Refreshing customer data...');
            const customerDropdown = document.getElementById('customerSelect');
            const currentValue = customerDropdown ? customerDropdown.value : '';
            
            // Show loading state
            this.populateCustomerDropdown([], 'Loading customers...');
            
            // Reload customers from Google Sheets
            await this.loadCustomersFromGoogleSheets();
            
            // Repopulate dropdown and restore selection if possible
            this.populateCustomerDropdown(this.customers);
            if (currentValue && customerDropdown) {
                customerDropdown.value = currentValue;
            }
            
            console.log('Customer data refreshed successfully');
        } catch (error) {
            console.error('Error refreshing customer data:', error);
            // Show error state but keep existing data
            if (this.customers.length > 0) {
                this.populateCustomerDropdown(this.customers);
            } else {
                this.populateCustomerDropdown([], 'Error loading customers');
            }
        }
    },
    
    // Update order creation to use customer data instead of pincode
    getOrderFormData() {
        const customerId = document.getElementById('customerSelect').value;
        const customer = this.getCustomerById(customerId);
        
        if (!customer) {
            throw new Error('Please select a customer');
        }
        
        return {
            orderId: document.getElementById('orderId').value,
            orderTime: new Date(document.getElementById('orderTime').value),
            customerId: customer.id,
            customerName: customer.name,
            customerPhone: customer.phone,
            customerAddress: customer.address,
            customerPincode: customer.pincode, // Keep pincode for backward compatibility
            zone: customer.zone,
            lat: customer.lat,
            lng: customer.lng,
            distance: null,
            estimatedDelivery: null,
            priority: 50, // Default priority - will be calculated based on SLA in orderManager
            createdAt: new Date(),
            status: 'pending'
        };
    },
    
    // Check if a zone is valid and mapped
    isValidZone(zone) {
        // Valid zones are A, B, C, D, E (case insensitive)
        // Exclude empty, null, undefined, or other invalid values
        if (!zone || typeof zone !== 'string') {
            return false;
        }
        
        const normalizedZone = zone.toString().trim().toUpperCase();
        const validZones = ['A', 'B', 'C', 'D', 'E'];
        
        return validZones.includes(normalizedZone);
    }
});
