# Teleconsultation Application Setup

## Overview
This application provides video consultation functionality using ZegoCloud with appointment data storage and video call event tracking in Azure MSSQL database.

## Features
- ✅ URL parameter decryption (existing functionality)
- ✅ ZegoCloud video integration (existing functionality)
- ✅ Appointment data storage in database
- ✅ Video call event tracking (join, leave, reconnect)
- ✅ Call session duration calculation
- ✅ Azure MSSQL database integration

## Environment Variables Required

### Client (.env file in client directory)
```bash
# ZegoCloud Video Consultation Configuration
REACT_APP_ZEGO_APP_ID=your_zego_app_id_here
REACT_APP_ZEGO_SERVER_SECRET=your_zego_server_secret_here

# Decryption Configuration
REACT_APP_DECRYPTION_API_URL=https://your-decryption-api-url.com/api/decrypt
REACT_APP_DECRYPTION_KEY=your_decryption_key_here

# Server Configuration
REACT_APP_SERVER_URL=http://localhost:3001
```

### Server (.env file in root directory)
```bash
# Decryption Key (Server-side)
DECRYPTION_KEY=sfrwYIgtcgsRdwjo

# Database Configuration (Azure MSSQL)
DB_SERVER=your-azure-server.database.windows.net
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# Server Configuration
PORT=3001
NODE_ENV=development
```

## Database Setup

### Azure MSSQL Database
1. Create a new MSSQL database in Azure
2. Note down the server name, database name, username, and password
3. Update the environment variables with your database credentials

### Database Tables
The application will automatically create the following tables:

#### 1. Appointments Table
```sql
CREATE TABLE appointments (
  id INT IDENTITY(1,1) PRIMARY KEY,
  app_no VARCHAR(100) NOT NULL,
  username VARCHAR(255) NOT NULL,
  userid VARCHAR(100) NOT NULL,
  doctorname VARCHAR(255) NOT NULL,
  speciality VARCHAR(255) NOT NULL,
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  room_id VARCHAR(100) NOT NULL,
  created_at DATETIME2 DEFAULT GETDATE(),
  updated_at DATETIME2 DEFAULT GETDATE()
)
```

#### 2. Video Call Events Table
```sql
CREATE TABLE video_call_events (
  id INT IDENTITY(1,1) PRIMARY KEY,
  appointment_id INT NOT NULL,
  event_type VARCHAR(50) NOT NULL,
  event_timestamp DATETIME2 DEFAULT GETDATE(),
  event_data NVARCHAR(MAX),
  room_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  username VARCHAR(255) NOT NULL,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
)
```

#### 3. Call Sessions Table
```sql
CREATE TABLE call_sessions (
  id INT IDENTITY(1,1) PRIMARY KEY,
  appointment_id INT NOT NULL,
  session_start DATETIME2 NOT NULL,
  session_end DATETIME2,
  duration_seconds INT,
  room_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  username VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at DATETIME2 DEFAULT GETDATE(),
  FOREIGN KEY (appointment_id) REFERENCES appointments(id)
)
```

## Installation Steps

### 1. Install Dependencies
```bash
# Root directory
npm install

# Client directory
cd client
npm install
```

### 2. Configure Environment Variables
- Copy the environment variables above to your `.env` files
- Update with your actual values

### 3. Start the Application
```bash
# Start server (from root directory)
npm start

# Start client (from client directory)
cd client
npm start
```

## URL Parameters Support

### Encrypted Single Parameter
```
https://your-domain.com/?id=encrypted_string_here
```

### Direct Parameters
```
https://your-domain.com/?app_no=APP123&username=JohnDoe&userid=USER456&doctorname=Dr.Smith&speciality=Cardiology&appointment_date=2024-01-15&appointment_time=10:00:00&room_id=ROOM001
```

## Video Call Event Tracking

The application automatically tracks the following events:

### 1. Join Room Event
- Triggered when user successfully joins video call
- Starts call session timer
- Stores event in database

### 2. Leave Room Event
- Triggered when user leaves video call
- Ends call session timer
- Calculates call duration
- Stores event in database

### 3. Manual Leave Room Event
- Triggered when user manually ends call
- Ends call session timer
- Stores event with manual action flag

### 4. End Call Requested Event
- Triggered when user requests to end call
- Stores event before showing confirmation popup

## API Endpoints

### Appointment Management
- `POST /api/appointments` - Store appointment data
- `GET /api/appointments/:appNo` - Get appointment details

### Video Call Events
- `POST /api/video-call-events` - Store video call event
- `POST /api/call-sessions/start` - Start call session
- `POST /api/call-sessions/end` - End call session

### Decryption
- `POST /api/decrypt` - Decrypt encoded parameters

## Data Flow

1. **User enters website** with URL parameters
2. **Parameters are decrypted** (if encrypted)
3. **Appointment data is stored** in database
4. **Video call is initialized** with ZegoCloud
5. **Call events are tracked** (join, leave, reconnect)
6. **Call duration is calculated** and stored
7. **All events are logged** in database for analytics

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check Azure MSSQL credentials
   - Verify firewall rules allow your IP
   - Ensure database server is running

2. **ZegoCloud Not Working**
   - Verify ZegoCloud credentials
   - Check environment variables
   - Ensure ZegoCloud account is active

3. **Decryption Failed**
   - Verify decryption key
   - Check encrypted parameter format
   - Ensure server is running

### Logs
- Check browser console for client-side errors
- Check server console for server-side errors
- Database errors are logged in server console

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique decryption keys
- Implement proper authentication for production
- Use HTTPS in production environment
- Regularly rotate database credentials

## Support

For technical support or questions, please refer to the application logs and ensure all environment variables are properly configured. 

## 📊 MIS Data Storage Plan

### 1. **Current Table Structure** (Based on your schema)

```sql
-- Appointments Table (Main appointment data)
CREATE TABLE appointments (
    id int IDENTITY(1,1) PRIMARY KEY,
    app_no varchar(50) NOT NULL,
    username varchar(255) NOT NULL,
    userid varchar(50) NOT NULL,
    doctorname varchar(255),
    speciality varchar(255),
    appointment_date date,
    appointment_time time,
    room_id varchar(255),
    status varchar(50) DEFAULT 'Scheduled',
    created_at datetime2 DEFAULT GETDATE(),
    updated_at datetime2 DEFAULT GETDATE()
);

-- Video Call Events Table (All video call activities)
CREATE TABLE video_call_events (
    id int IDENTITY(1,1) PRIMARY KEY,
    appointment_id int NOT NULL,
    event_type varchar(50) NOT NULL,
    event_timestamp datetime2 DEFAULT GETDATE(),
    event_data nvarchar(MAX),
    room_id varchar(255),
    user_id varchar(255),
    username varchar(255),
    session_id varchar(255),
    duration_seconds int,
    created_at datetime2 DEFAULT GETDATE()
);

-- Call Sessions Table (Session tracking)
CREATE TABLE call_sessions (
    id int IDENTITY(1,1) PRIMARY KEY,
    appointment_id int NOT NULL,
    session_start datetime2,
    session_end datetime2,
    duration_seconds int,
    room_id varchar(255),
    user_id varchar(255),
    username varchar(255),
    status varchar(50) DEFAULT 'active',
    created_at datetime2 DEFAULT GETDATE()
);
```

### 2. **Enhanced Data Storage Functions**

```javascript:server.js
// Enhanced appointment storage with MIS tracking
async function storeAppointment(appointmentData) {
  try {
    console.log('📝 Server: Storing appointment data:', appointmentData);
    
    const pool = await sql.connect(dbConfig);
    const request = pool.request();
    
    // Format dates for SQL Server
    const formattedDate = formatDateForSQL(appointmentData.appointment_date);
    const formattedTime = formatTimeForSQL(appointmentData.appointment_time);
    
    // Check if appointment already exists
    const checkResult = await request.query(`
      SELECT id FROM appointments 
      WHERE app_no = '${appointmentData.app_no}' 
      AND userid = '${appointmentData.userid}'
    `);
    
    if (checkResult.recordset.length > 0) {
      // Update existing appointment with MIS tracking
      await request.query(`
        UPDATE appointments SET
            username = '${appointmentData.username}',
            userid = '${appointmentData.userid}',
            doctorname = '${appointmentData.doctorname}',
            speciality = '${appointmentData.speciality}',
            appointment_date = '${formattedDate}',
            appointment_time = '${formattedTime}',
            room_id = '${appointmentData.room_id}',
            status = 'Updated',
            updated_at = GETDATE()
        WHERE app_no = '${appointmentData.app_no}' 
        AND userid = '${appointmentData.userid}'
      `);
      
      return { 
        success: true, 
        appointment_id: checkResult.recordset[0].id,
        message: 'Appointment updated successfully' 
      };
    } else {
      // Insert new appointment with MIS tracking
      const insertResult = await request.query(`
        INSERT INTO appointments 
        (app_no, username, userid, doctorname, speciality, appointment_date, appointment_time, room_id, status, created_at)
        VALUES 
        ('${appointmentData.app_no}', '${appointmentData.username}', '${appointmentData.userid}', 
         '${appointmentData.doctorname}', '${appointmentData.speciality}', 
         '${formattedDate}', '${formattedTime}', 
         '${appointmentData.room_id}', 'Scheduled', GETDATE())
      `);
      
      // Get the newly created appointment ID
      const newAppointmentResult = await request.query(`
        SELECT id FROM appointments 
        WHERE app_no = '${appointmentData.app_no}' 
        AND userid = '${appointmentData.userid}'
      `);
      
      return { 
        success: true, 
        appointment_id: newAppointmentResult.recordset[0].id,
        message: 'Appointment created successfully' 
      };
    }
  } catch (error) {
    console.error('❌ Server: Error storing appointment:', error);
    throw error;
  }
}

// Enhanced video call event storage with comprehensive tracking
async function storeVideoCallEvent(eventData) {
  try {
    console.log('📹 Server: Storing video call event:', eventData);
    
    const pool = await sql.connect(dbConfig);
    const request = pool.request();
    
    // Get appointment ID
    let appointmentId = eventData.appointment_id;
    if (isNaN(eventData.appointment_id)) {
      const appointmentResult = await request.query(`
        SELECT id FROM appointments 
        WHERE app_no = '${eventData.appointment_id}'
      `);
      
      if (appointmentResult.recordset.length > 0) {
        appointmentId = appointmentResult.recordset[0].id;
      } else {
        throw new Error(`Appointment not found: ${eventData.appointment_id}`);
      }
    }
    
    // Store comprehensive event data
    await request.query(`
      INSERT INTO video_call_events 
      (appointment_id, event_type, event_timestamp, event_data, room_id, user_id, username, session_id, duration_seconds, created_at)
      VALUES 
      (${appointmentId}, '${eventData.event_type}', 
       '${eventData.event_timestamp || new Date().toISOString()}', 
       '${JSON.stringify(eventData.event_data)}', 
       '${eventData.room_id}', '${eventData.user_id}', '${eventData.username}',
       '${eventData.session_id || ''}', 
       ${eventData.duration_seconds || 0}, 
       GETDATE())
    `);
    
    // Update appointment status based on event type
    if (eventData.event_type === 'connected') {
      await request.query(`
        UPDATE appointments 
        SET status = 'In Progress', updated_at = GETDATE()
        WHERE id = ${appointmentId}
      `);
    } else if (eventData.event_type === 'disconnected') {
      await request.query(`
        UPDATE appointments 
        SET status = 'Completed', updated_at = GETDATE()
        WHERE id = ${appointmentId}
      `);
    }
    
    console.log('✅ Server: Video call event stored successfully');
    return { success: true, appointment_id: appointmentId };
    
  } catch (err) {
    console.error('❌ Error storing video call event:', err);
    throw err;
  }
}
```

### 3. **MIS Reporting Queries**

```sql
<code_block_to_apply_changes_from>
```

### 4. **Data Flow Summary**

```
1. Patient enters website → Store in appointments table
2. Patient joins room → Update status to 'In Progress' + Store connect event
3. Doctor joins room → Store user_update event
4. Call events (mute, camera, etc.) → Store in video_call_events table
5. Call ends → Update status to 'Completed' + Store disconnect event + Calculate duration
6. All data available for MIS reporting and analytics
```

This comprehensive approach ensures all data is properly tracked for MIS reporting, analytics, and business intelligence purposes.