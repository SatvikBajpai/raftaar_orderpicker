# Dependencies and External Libraries

## Raftaar Order Picker - External Dependencies

This document provides a comprehensive list of all external libraries, APIs, tools, and services used in the Raftaar Order Picker application.

---

## Core External Libraries

### 1. Font Awesome 6.0.0
- **Type**: CSS Icon Library
- **Source**: `https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css`
- **Purpose**: Provides scalable vector icons for user interface elements
- **Usage**: Icons throughout the application (shipping, plus, save, search, location, etc.)
- **License**: Font Awesome Free License
- **Integration**: CDN link in `index.html`

### 2. Google Maps JavaScript API
- **Type**: Mapping and Geolocation Service
- **Source**: `https://maps.googleapis.com/maps/api/js`
- **Purpose**: Core mapping functionality, route visualization, and geocoding services
- **Required Libraries**:
  - `routes` - Advanced route planning and optimization
  - `geometry` - Geometric calculations and spatial operations
  - `places` - Place search, autocomplete, and geocoding
- **Integration**: Script tag in `index.html` with API key
- **Documentation**: [Google Maps JavaScript API](https://developers.google.com/maps/documentation/javascript)

---

## Google Cloud APIs

### 3. Google Sheets API v4
- **Type**: Data Integration Service
- **Endpoint**: `https://sheets.googleapis.com/v4/spreadsheets/`
- **Purpose**: Customer data synchronization and management
- **Usage**: Loading customer database from Google Sheets
- **Authentication**: API key-based
- **Implementation**: `js/customerManager.js`

### 4. Google Directions API
- **Type**: Route Calculation Service
- **Purpose**: Calculate optimal routes between multiple points
- **Usage**: Route optimization and turn-by-turn directions
- **Integration**: Through Google Maps JavaScript API
- **Implementation**: `js/mapManager.js`, `js/optimizationEngine.js`

### 5. Google Places API
- **Type**: Location Data Service
- **Purpose**: Address validation, geocoding, and place search
- **Usage**: Converting addresses to coordinates, place autocomplete
- **Integration**: Through Google Maps JavaScript API
- **Implementation**: `js/customerManager.js`

### 6. Google Geocoding API
- **Type**: Address Conversion Service
- **Purpose**: Converting addresses to coordinates and vice versa
- **Usage**: Automatic coordinate resolution for customer addresses
- **Integration**: Through Google Maps JavaScript API
- **Implementation**: `js/customerManager.js`

### 7. Google Routes API (Advanced)
- **Type**: Enhanced Route Planning Service
- **Purpose**: Advanced route optimization with real-time traffic data
- **Usage**: Traffic-aware route calculations and optimization
- **Integration**: Through Google Maps JavaScript API
- **Implementation**: `js/optimizationEngine.js`

---

## Development and Documentation Tools

### 8. GitHub Markdown CSS
- **Type**: Styling Library
- **Source**: `https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown-light.min.css`
- **Purpose**: GitHub-style markdown rendering for documentation
- **Usage**: PDF and HTML documentation generation
- **Integration**: `generate_pdfs.sh` script
- **Note**: Used only for documentation generation, not in main application

### 9. Pandoc (Development Tool)
- **Type**: Document Conversion Tool
- **Purpose**: Converting Markdown documentation to HTML/PDF formats
- **Usage**: Automated documentation generation
- **Integration**: `generate_pdfs.sh` script
- **Installation**: `brew install pandoc` (macOS)

---

## Native Browser APIs

The application extensively uses native browser APIs, eliminating the need for additional JavaScript libraries:

### 10. LocalStorage API
- **Type**: Native Browser API
- **Purpose**: Client-side data persistence
- **Usage**: Storing orders, customer data, and application state
- **Implementation**: `js/storageManager.js`

### 11. Fetch API
- **Type**: Native Browser API
- **Purpose**: HTTP requests and API communication
- **Usage**: Google Sheets API calls and external service requests
- **Implementation**: `js/customerManager.js`

### 12. FileReader API
- **Type**: Native Browser API
- **Purpose**: File handling for data import/export
- **Usage**: Backup and restore functionality
- **Implementation**: `js/storageManager.js`

### 13. Geolocation API (Optional)
- **Type**: Native Browser API
- **Purpose**: User location detection
- **Usage**: Auto-location features for enhanced user experience
- **Implementation**: Optional feature in mapping components

---

## Deployment and Hosting Services

### 14. GitHub Pages
- **Type**: Static Site Hosting
- **Purpose**: Application deployment and hosting
- **URL**: https://satvikbajpai.github.io/raftaar_orderpicker/
- **Configuration**: Automatic deployment from main branch

### 15. Netlify (Configuration Available)
- **Type**: Static Site Hosting Platform
- **Purpose**: Alternative deployment option
- **Configuration**: `netlify.toml`
- **Features**: Continuous deployment, custom domains, environment variables

### 16. Vercel (Configuration Available)
- **Type**: Static Site Hosting Platform
- **Purpose**: Alternative deployment option
- **Configuration**: `vercel.json`
- **Features**: Instant deployments, global CDN, serverless functions

---

## Architecture Philosophy

### Minimal Dependencies Approach
The Raftaar Order Picker follows a **minimal dependencies** philosophy:

- **Pure Vanilla JavaScript (ES6+)** - No heavy frameworks like React, Vue, or Angular
- **Native CSS** - No CSS frameworks like Bootstrap or Tailwind CSS
- **Modern Browser APIs** - Leveraging native capabilities instead of polyfills
- **Modular Architecture** - 8 separate JavaScript modules for maintainability

### Benefits of This Approach
- **Performance**: Faster loading times with minimal external dependencies
- **Maintainability**: Reduced complexity and version conflicts
- **Security**: Fewer third-party libraries reduce attack surface
- **Longevity**: Less dependent on external library updates and breaking changes
- **Compatibility**: Better browser compatibility with native APIs

---

## Version Compatibility

### Browser Requirements
- **Chrome**: Version 80+ (recommended)
- **Firefox**: Version 75+
- **Safari**: Version 13+
- **Edge**: Version 80+

### API Version Dependencies
- **Google Maps JavaScript API**: Current stable version
- **Google Sheets API**: v4
- **Font Awesome**: 6.0.0

---

## License Information

### External Library Licenses
- **Font Awesome**: Font Awesome Free License (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT)
- **Google APIs**: Subject to Google API Terms of Service
- **GitHub Markdown CSS**: MIT License

### Usage Compliance
All external dependencies are used in compliance with their respective licenses and terms of service. The application follows best practices for API usage and rate limiting.

---

## Development Setup Requirements

For developers setting up the project locally:

### Required
- Modern web browser with ES6+ support
- Web server (Python SimpleHTTPServer, Node.js http-server, or VS Code Live Server)
- Google Maps API key with enabled services

### Optional
- Pandoc (for documentation generation)
- Git (for version control)
- Code editor with JavaScript support

---

## API Usage and Quotas

### Google Maps API Quotas
- **Maps JavaScript API**: 28,000 map loads per month (free tier)
- **Directions API**: 2,500 requests per day (free tier)
- **Geocoding API**: 40,000 requests per month (free tier)
- **Places API**: Monthly usage limits vary by request type

### Optimization Strategies
- **Caching**: Coordinate and route data cached in LocalStorage
- **Rate Limiting**: Implemented to prevent quota exhaustion
- **Efficient Requests**: Batch processing and request optimization
- **Fallback Handling**: Graceful degradation when APIs are unavailable

---

**Total External Dependencies: 7 core libraries + 9 supporting tools/APIs**

**Last Updated**: July 2025  
**Version**: 1.0.0
