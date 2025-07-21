# Raftaar Order Picker

An intelligent order prioritization and route optimization system for delivery management with SLA compliance tracking.

![Raftaar Order Picker](https://img.shields.io/badge/Version-1.0.0-blue) ![Status](https://img.shields.io/badge/Status-Live-green) 

## Live Application

**Access the application directly at:** https://satvikbajpai.github.io/raftaar_orderpicker/

## Overview

Raftaar Order Picker is a web-based delivery management system designed to optimize order picking and delivery routes for maximum efficiency and SLA compliance. The application provides intelligent order prioritization, real-time route optimization, and comprehensive delivery tracking.

### Key Features

- **Smart Order Prioritization**: AI-driven order selection based on SLA deadlines and delivery distance
- **Route Optimization**: Advanced algorithms for multi-order batch delivery optimization
- **Real-time Mapping**: Interactive Google Maps integration with live route visualization
- **SLA Monitoring**: Automatic SLA deadline tracking with visual priority indicators
- **Rider Management**: Complete delivery rider assignment and tracking system
- **Customer Database**: Integrated customer management with Google Sheets sync
- **Zone-based Batching**: Intelligent grouping of orders by delivery zones
- **Performance Analytics**: Detailed metrics and route efficiency analysis

## Technology Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Mapping**: Google Maps JavaScript API, Google Routes API
- **Data Storage**: Browser LocalStorage, Google Sheets integration
- **Routing**: Google Directions API with optimization algorithms
- **Deployment**: Static hosting compatible (Netlify, Vercel, GitHub Pages)

## Project Structure

```
raftaar_orderpicker/
├── index.html                 # Main application interface
├── styles.css                 # Application styling
├── netlify.toml               # Netlify deployment configuration
├── vercel.json                # Vercel deployment configuration
├── js/                        # Modular JavaScript files
│   ├── main.js                # Application initialization
│   ├── orderManager.js        # Order creation and management
│   ├── optimizationEngine.js  # Route and priority optimization
│   ├── mapManager.js          # Google Maps integration
│   ├── customerManager.js     # Customer data management
│   ├── uiManager.js           # User interface management
│   ├── storageManager.js      # Data persistence
│   └── utilityFunctions.js    # Helper functions and calculations
├── README.md                  # Project overview and documentation
├── SETUP.md                   # Configuration and setup guide
├── USER_GUIDE.md              # Complete user manual
└── RELEASE_NOTES.md           # Version release information
```

## Getting Started

### Prerequisites

- Modern Web Browser (Chrome 80+, Firefox 75+, Safari 13+, Edge 80+)
- Internet connection
- Google Maps API Key (optional, for enhanced performance)

### Quick Start

1. **Access the Application**
   - Visit: https://satvikbajpai.github.io/raftaar_orderpicker/
   - The application loads automatically with default settings

2. **Optional: Configure Your Own API Key**
   - For optimal performance, set up your own Google Maps API key
   - Follow the setup guide in the application settings
   - Required APIs: Maps JavaScript, Directions, Places, Geocoding, Routes

3. **Start Using**
   - The application is ready to use immediately
   - Follow the on-screen tutorial for first-time setup
   - Configure your store location and preferences

## Core Functionality

### Order Management
- **Add New Orders**: Create orders with customer selection, timing, and automatic zone assignment
- **Order Prioritization**: Smart priority calculation based on SLA deadlines and delivery distance
- **Status Tracking**: Real-time order status updates (pending, selected, out for delivery, delivered)
- **Bulk Operations**: Handle multiple orders efficiently with batch processing

### Route Optimization
- **Single Order Mode**: Find the optimal next order based on SLA compliance or delivery efficiency
- **Batch Mode**: Create optimized multi-order routes with zone-based clustering
- **Dual-Color Routes**: Visual distinction between outbound (blue) and return (green) routes
- **Route Segments**: Toggle individual route segments for detailed analysis

### Rider Management
- **10 Active Riders**: Support for riders A through J with individual tracking
- **Automatic Availability**: Smart rider status management with 15-minute auto-return rule
- **Assignment Tracking**: Complete order-to-rider assignment with expected return times
- **Performance Monitoring**: Track rider efficiency and delivery completion

### Customer Integration
- **Google Sheets Sync**: Automatic customer data loading from Google Sheets
- **Address Geocoding**: Automatic coordinate resolution for new addresses
- **Zone Assignment**: Smart zone allocation based on customer location
- **Customer Database**: Persistent customer information storage

## User Guide

### Getting Started

1. **Access the Application**
   - Visit https://satvikbajpai.github.io/raftaar_orderpicker/
   - The Google Maps interface loads showing the default store location
   - Customer data syncs automatically if Google Sheets is configured

2. **Adding Your First Order**
   - Click the "Add New Order" section
   - Enter a unique Order ID (e.g., "ORD-001")
   - Set the order time (current time by default)
   - Select a customer from the dropdown (or add manually with pincode)
   - Zone will auto-fill based on customer location
   - Click "Add Order" to create

3. **Order Optimization**
   - Orders appear in the queue with color-coded priorities
   - Use "Get Next Order" for single-order optimization
   - Enable "Zone Batch Optimization" for multi-order routes
   - The system will recommend the optimal selection

### Advanced Features

#### SLA Management
- **Green**: Orders with ample time to meet SLA
- **Yellow**: Orders requiring attention (moderate urgency)
- **Orange**: High priority orders (limited time remaining)
- **Red**: Overdue or critical orders requiring immediate action

#### Route Visualization
- **Blue Routes**: Outbound delivery routes from store to customers
- **Green Routes**: Return routes from customers back to store
- **Route Controls**: Toggle individual segments, view full routes, or analyze specific portions
- **Distance/Time Display**: Real-time route metrics with Google Maps integration

#### Batch Optimization
- **Zone-Based Clustering**: Automatically groups orders by delivery zones
- **Route Efficiency**: Calculates optimal order sequence within batches
- **SLA Risk Analysis**: Identifies orders at risk of missing deadlines
- **Capacity Management**: Configurable batch sizes (2-8 orders per batch)

### Rider Assignment

1. **Select Orders**: Use optimization to identify orders for delivery
2. **Choose Rider**: Click "Select for Delivery" and pick an available rider
3. **Track Progress**: Monitor rider status and expected return times
4. **Auto-Updates**: System automatically updates rider availability

### Data Management

- **Automatic Saving**: All data persists in browser storage
- **Export Capability**: Generate reports and analytics
- **Backup Options**: Manual data export/import functionality
- **Sync Management**: Real-time updates across browser tabs

## Configuration

All configuration can be done within the application interface. For detailed setup instructions, see [SETUP.md](SETUP.md).

### Google Maps API Setup (Optional)

For enhanced performance and security:

1. **Create Google Cloud Project**
   - Visit [Google Cloud Console](https://console.cloud.google.com/)
   - Enable required APIs: Maps JavaScript, Directions, Places, Geocoding, Routes

2. **Configure in Application**
   - Access Settings within the application
   - Enter your API key for improved performance
   - Set up domain restrictions for security

### Google Sheets Integration (Optional)

1. **Create Customer Database**
   - Set up Google Sheets with customer data
   - Make sheet publicly accessible
   - Configure sheet ID in application settings

### Store Location

- Update store coordinates within the application settings
- Default location: Nagpur, Maharashtra
- Use Google Maps to find your exact coordinates

## Documentation

For detailed information:

- **[SETUP.md](SETUP.md)**: Complete configuration guide
- **[USER_GUIDE.md](USER_GUIDE.md)**: Comprehensive user manual
- **[RELEASE_NOTES.md](RELEASE_NOTES.md)**: Version 1.0.0 release information

## Troubleshooting

### Common Issues

**Map Not Loading**
- The application works with a default API key initially
- For better performance, set up your own Google Maps API key
- Check browser console for any error messages
- Ensure required APIs are enabled in Google Cloud Console

**Customer Data Not Loading**
- Verify Google Sheets is publicly accessible
- Check spreadsheet ID in application settings
- Ensure correct column format in Google Sheets

**Routes Not Displaying**
- Confirm internet connection is stable
- The application uses cached route data when possible
- Check API quota limits if using your own API key
- Try refreshing the application

**Orders Not Saving**
- Check browser localStorage availability
- Clear browser cache if experiencing issues
- Verify no browser extensions are blocking storage

### Performance Optimization

- **API Quota Management**: Monitor Google Maps API usage
- **Data Caching**: Customer and route data is cached for efficiency
- **Batch Processing**: Use batch optimization for multiple orders
- **Route Reuse**: System caches common routes for faster loading

## Analytics and Metrics

The application tracks comprehensive metrics:

- **Route Efficiency**: Distance optimization and time savings
- **SLA Compliance**: Success rates and risk analysis
- **Rider Performance**: Delivery times and capacity utilization
- **Order Volume**: Daily, weekly, and monthly order processing
- **Geographic Distribution**: Zone-wise delivery analysis

## Contributing

### Development Setup

For developers who want to contribute:

1. **Fork the Repository**
2. **Clone Locally**
   ```bash
   git clone https://github.com/yourusername/raftaar_orderpicker.git
   cd raftaar_orderpicker
   ```
3. **Set up Local Development**
   - Use any local web server (Python, Node.js, VS Code Live Server)
   - Configure your own Google Maps API key
4. **Make Changes and Test**
5. **Submit Pull Request**

### Code Standards

- Use ES6+ JavaScript features
- Follow modular architecture patterns
- Implement comprehensive error handling
- Add detailed code comments
- Test across multiple browsers

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- **Live Application**: https://satvikbajpai.github.io/raftaar_orderpicker/
- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: GitHub Discussions for feature requests
- **Documentation**: Comprehensive guides included in this repository

## Quick Links

- **Application**: https://satvikbajpai.github.io/raftaar_orderpicker/
- **Setup Guide**: [SETUP.md](SETUP.md)
- **User Manual**: [USER_GUIDE.md](USER_GUIDE.md)
- **Release Notes**: [RELEASE_NOTES.md](RELEASE_NOTES.md)

---

**Start optimizing your delivery operations today!**
