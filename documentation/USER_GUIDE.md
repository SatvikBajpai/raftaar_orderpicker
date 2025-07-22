# Raftaar Order Picker - User Guide

## Getting Started

Welcome to Raftaar Order Picker! This comprehensive guide will help you master the application and optimize your delivery operations.

### First Time Setup

1. **Launch the Application**
   - Open your web browser
   - Navigate to the application URL
   - Wait for the Google Maps interface to load
   - You'll see the Raftaar store location marked on the map

2. **Interface Overview**
   The main interface consists of four key sections:
   - **Add New Order**: Create new delivery orders
   - **Orders Queue**: View and manage pending orders
   - **Optimization Panel**: Smart order selection and route planning
   - **Interactive Map**: Visual representation of orders and routes

## Order Management

### Creating New Orders

1. **Basic Order Creation**
   - **Order ID**: Enter a unique identifier (e.g., ORD-001, DEL-2024-001)
   - **Order Time**: Select when the order was placed (defaults to current time)
   - **Customer**: Choose from existing customers or add new customer data
   - **Zone**: Automatically filled based on customer location

2. **Customer Selection**
   - **Existing Customers**: Select from the dropdown list (auto-loaded from Google Sheets)
   - **Auto-Geocoding**: System automatically finds coordinates for new addresses

3. **Order Validation**
   - System prevents duplicate Order IDs
   - Validates required fields before creation
   - Automatically calculates delivery distance and priority


### Order Status Tracking

- **Pending**: Order created, awaiting assignment
- **Selected**: Order chosen for delivery, awaiting rider assignment
- **Out for Delivery**: Assigned to rider, currently being delivered
- **Delivered**: Successfully completed delivery

## Smart Optimization

### Single Order Mode

1. **Select Optimization Strategy**
   - **Maximize Orders**: Prioritizes closest orders for maximum delivery count
   - **Maximize SLA**: Focuses on SLA compliance and deadline management

2. **Get Recommendation**
   - Click "Get Next Order" button
   - System analyzes all pending orders
   - Provides intelligent recommendation

3. **Order Selection Logic**
   
   **For Maximize SLA Strategy:**
   - **Critical Orders**: Overdue by >4 hours (highest priority)
   - **Meetable SLA**: Orders that can still meet deadlines
   - **Recently Overdue**: <4 hours overdue (damage control)

   **For Maximize Orders Strategy:**
   - **Closest First**: Shortest distance from store
   - **Quick Turnaround**: Fastest delivery completion
   - **High Volume**: Maximum orders per time period

### Batch Mode (Zone Optimization)

1. **Enable Batch Processing**
   - Toggle "Zone Batch Optimization" checkbox
   - Configure batch settings (2-5 orders per batch)

2. **Zone-Based Clustering**
   - System automatically groups orders by delivery zones
   - Creates efficient multi-stop routes
   - Considers zone proximity and route optimization

3. **Batch Analysis**
   - **Route Efficiency**: Optimized order sequence
   - **SLA Risk Assessment**: Identifies orders at risk
   - **Time Estimates**: Total delivery time calculations
   - **Distance Optimization**: Minimized total route distance

## Map Features and Route Visualization

### Interactive Map Controls

1. **Zoom and Pan**
   - Use mouse wheel or zoom controls
   - Drag to pan around the map
   - Double-click to zoom to specific location

2. **Marker Information**
   - **Store Marker**: Blue building icon (distribution center)
   - **Order Markers**: Color-coded circles with priority numbers
   - **Click Markers**: View detailed order information

### Route Visualization

The application uses dual-color route system:

- **Blue Routes**: Outbound journey (store → customers)
- **Green Routes**: Return journey (customers → store)

### Route Controls

1. **Single Order Routes**
   - **Store → Order**: View outbound route
   - **Order → Store**: View return route
   - **Toggle Views**: Switch between route types

2. **Batch Routes**
   - **Full Route**: Complete multi-stop journey
   - **Store → First**: Route to first delivery
   - **Segment Routes**: Individual order-to-order segments
   - **Return Route**: Final delivery back to store

### Route Information Display

Each route shows:
- **Distance**: Total kilometers for the route
- **Duration**: Estimated driving time
- **Route Type**: Outbound, return, or segment

## Rider Management

### Available Riders

The system supports 10 active riders (A through J):
- **Rider A** through **Rider J**
- Each rider has independent status tracking
- Automatic availability management

### Rider Status Types

- **Available**: Ready for new assignments
- **Busy**: Currently on delivery (with expected return time)
- **Unavailable**: Manually set as unavailable

### Order Assignment Process

1. **Select Orders**
   - Use optimization to identify orders for delivery
   - Single orders or complete batches

2. **Choose Rider**
   - Click "Select for Delivery" button
   - Choose from available riders
   - System calculates expected return time

3. **Track Progress**
   - Monitor rider status in real-time
   - View expected return times
   - Automatic status updates

### Automatic Rider Management

- **Delivery Completion**: Orders marked as delivered when rider returns
- **Status Synchronization**: Real-time updates across all interface elements

## Customer Database Management

### Google Sheets Integration

1. **Automatic Data Loading**
   - Customer data loads automatically from Google Sheets
   - Includes name, phone, coordinates, and zone information
   - Real-time synchronization capabilities

2. **Customer Information**
   - **Name**: Full customer name
   - **Phone**: Contact number
   - **Coordinates**: Latitude and longitude for precise delivery
   - **Zone**: Delivery zone assignment

### Adding New Customers

1. **Bulk Import**
   - Update Google Sheets with new customer data
   - Refresh application to load new customers
   - Automatic coordinate resolution

### Performance Issues

**Issue: Slow order loading**
- Solution: Clear browser cache and refresh

**Issue: Optimization taking too long**
- Solution: Reduce batch size or check system resources

## Best Practices

### Order Management

1. **Consistent Naming**: Use standardized Order ID formats
2. **Timely Entry**: Add orders as soon as they're received
3. **Regular Monitoring**: Check SLA status frequently
4. **Batch Planning**: Group orders efficiently for delivery

### Route Optimization

1. **Zone Awareness**: Consider geographic clustering
2. **Time Windows**: Account for traffic patterns
3. **Capacity Planning**: Don't overload riders
4. **Flexibility**: Be ready to adjust plans based on real-time conditions

## Productivity Tips

### Daily Workflow

1. **Morning Setup**
   - Review overnight orders
   - Check rider availability
   - Plan initial batch routes

2. **Continuous Monitoring**
   - Use real-time optimization
   - Monitor SLA compliance
   - Adjust routes as needed

3. **End-of-Day Review**
   - Analyze delivery performance
   - Update customer database
   - Plan next day operations

## Advanced Settings

### Configurable Travel Time

The application includes a hidden settings panel for advanced configuration:

1. **Accessing Settings**
   - Look for the gear icon in the bottom-right corner of the screen
   - Click the gear icon to open the Advanced Settings panel
   - The settings panel can be closed by clicking the X button

2. **Average Delivery Time Configuration**
   - **Default Value**: 4.2 minutes per kilometer
   - **Recommended Range**: 3.0 - 6.0 minutes per kilometer
   - **Input Range**: 1.0 - 10.0 minutes per kilometer (0.1 step precision)
   - **Real-time Updates**: Changes apply immediately to all calculations

## Support and Resources

### Getting Help

1. **Application Issues**: Check browser console for error messages
2. **Feature Questions**: Refer to this user guide
3. **Performance Problems**: Verify internet connection and system resources
4. **Data Issues**: Check Google Sheets configuration
---