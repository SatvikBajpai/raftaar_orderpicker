# Setup and Configuration Guide

## Application Access

**Raftaar Order Picker** is live and ready to use at:
**https://satvikbajpai.github.io/raftaar_orderpicker/**

## Prerequisites

To use Raftaar Order Picker effectively, you need:

### Required
- Modern Web Browser (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- Google Maps API Key with required permissions
- Internet connection

### Optional
- Google Sheets (for customer data management)
- Custom API key restrictions for enhanced security

## Quick Setup

### Step 1: Access the Application
Simply visit **https://satvikbajpai.github.io/raftaar_orderpicker/** in your web browser.

### Step 2: Configure Your API Key (Recommended)

For optimal performance and security, set up your own Google Maps API key:

1. **Get Google Maps API Key**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the following APIs:
     - Maps JavaScript API
     - Directions API
     - Places API
     - Geocoding API
     - Routes API (recommended)
   - Create an API key
   - Add API key restrictions for security

2. **Update API Key in Application**
   - The application will prompt you to enter your API key on first use
   - Or you can update it in Settings within the application

## Detailed Configuration

### Google Maps API Setup

1. **Create Google Cloud Project**
   ```
   1. Visit https://console.cloud.google.com/
   2. Click "Select a project" → "New Project"
   3. Enter project name: "Raftaar Order Picker"
   4. Click "Create"
   ```

2. **Enable Required APIs**
   ```
   1. Go to "APIs & Services" → "Library"
   2. Search and enable each API:
      - Maps JavaScript API
      - Directions API
      - Places API
      - Geocoding API
      - Routes API (for advanced routing)
   ```

3. **Create and Secure API Key**
   ```
   1. Go to "APIs & Services" → "Credentials"
   2. Click "Create Credentials" → "API Key"
   3. Copy the generated key
   4. Click "Restrict Key" for security:
      - Application restrictions: HTTP referrers
      - Add your website domains
      - API restrictions: Select only enabled APIs
   ```

### Store Location Configuration

Update your store coordinates within the application:

1. **Access Settings**
   - Open the application at https://satvikbajpai.github.io/raftaar_orderpicker/
   - Click on Settings or Configuration menu
   - Navigate to Store Location section

2. **Set Your Coordinates**
   - Enter your store's latitude and longitude
   - Default location: Nagpur, Maharashtra (21.142639, 79.090385)
   - Update with your actual store coordinates

3. **Find Your Coordinates**
   - Open [Google Maps](https://maps.google.com)
   - Right-click on your store location
   - Click on the coordinates to copy them

### Customer Data Integration (Optional)

#### Google Sheets Setup

1. **Create Customer Database**
   - Create new Google Sheets document
   - Set up columns (A-E):
     - A: Customer Name
     - B: Customer Phone
     - C: Latitude
     - D: Longitude
     - E: Zone
   
2. **Sample Data Format**
   ```
   Row 1: Customer Name | Customer Phone | Latitude  | Longitude | Zone
   Row 2: John Doe      | +91-9876543210| 21.145000 | 79.088000 | A
   Row 3: Jane Smith    | +91-9876543211| 21.140000 | 79.092000 | B
   ```

3. **Make Sheet Public**
   - Click "Share" button
   - Change to "Anyone with the link can view"
   - Copy the sheet ID from URL

4. **Update Configuration**
   - Within the application, go to Settings
   - Navigate to Customer Data Integration
   - Enter your Google Sheet ID
   - Save configuration

## Configuration Options

All configuration can be done within the application interface. No file editing required.

## Browser Compatibility

### Supported Browsers
- **Chrome**: Version 80+ (recommended)
- **Firefox**: Version 75+
- **Safari**: Version 13+
- **Edge**: Version 80+

### Required Browser Features
- ES6+ JavaScript support
- Local Storage API
- Geolocation API (optional)
- WebGL (for advanced map features)

### Browser Settings
- **JavaScript**: Must be enabled
- **Cookies**: Required for session management
- **Local Storage**: Required for data persistence
- **Location Services**: Optional (for auto-location features)

## Security Configuration

### API Key Security

1. **Restrict by Domain**
   ```
   In Google Cloud Console:
   1. Go to Credentials → Edit API Key
   2. Application restrictions → HTTP referrers
   3. Add: yourdomain.com/* and www.yourdomain.com/*
   ```

2. **Restrict by API**
   ```
   API restrictions:
   Maps JavaScript API
   Directions API
   Places API
   Geocoding API
   Routes API
   (Uncheck all others)
   ```

### HTTPS and Security

The application is served over HTTPS at https://satvikbajpai.github.io/raftaar_orderpicker/ which ensures:
- Secure API communications
- Geolocation features work properly
- Data transmission is encrypted

## 📱 Mobile Responsiveness

The application is fully responsive and works on:
- **Smartphones**: iOS Safari, Android Chrome
- **Tablets**: iPad Safari, Android tablets
- **Desktops**: All major browsers

### Mobile-Specific Features
- Touch-friendly interface
- Responsive map controls
- Mobile-optimized forms
- Swipe gestures for maps

## Troubleshooting Installation

### Common Issues

**Issue: Map not loading**
```
Solution:
1. Check API key is valid
2. Verify APIs are enabled in Google Cloud
3. Check browser console for errors
4. Ensure correct domain restrictions
```

**Issue: "This page can't load Google Maps correctly"**
```
Solution:
1. Set up your own API key in the application settings
2. Verify billing is enabled (Google requires billing account)
3. Check API quotas aren't exceeded
4. Ensure APIs are enabled in Google Cloud Console
```

**Issue: CORS errors**
```
Solution:
1. Use the deployed application at https://satvikbajpai.github.io/raftaar_orderpicker/
2. For Google Sheets: ensure sheet is publicly accessible
3. Check browser console for specific error details
```

**Issue: Customer data not loading**
```
Solution:
1. Verify Google Sheets is publicly accessible
2. Check spreadsheet ID in application settings
3. Ensure correct column format in your sheet
4. Check browser console for errors
```

### Performance Issues

**Slow map loading**
```
Solutions:
1. Reduce initial zoom level
2. Implement lazy loading for markers
3. Use marker clustering for many orders
4. Optimize API calls
```

**High API usage**
```
Solutions:
1. Implement request caching
2. Use batch geocoding
3. Monitor API quotas
4. Implement rate limiting
```

## Setup Checklist

Before using the application, verify:

- [ ] Access the application at https://satvikbajpai.github.io/raftaar_orderpicker/
- [ ] Application loads without errors
- [ ] Maps display correctly (may use default API key initially)
- [ ] Set up your own Google Maps API key for better performance
- [ ] Configure your store location coordinates
- [ ] Test basic order creation functionality
- [ ] Test route optimization features
- [ ] Set up customer data integration (if using Google Sheets)
- [ ] Verify application works on your mobile devices
- [ ] Configure API key restrictions for security

## Getting Started

1. **Visit the Application**: https://satvikbajpai.github.io/raftaar_orderpicker/
2. **Complete Initial Setup**: Follow the on-screen setup wizard
3. **Configure Your Settings**: Set store location and API preferences
4. **Start Managing Orders**: Begin creating and optimizing delivery routes

---

**Your Raftaar Order Picker is ready to optimize your delivery operations!**
