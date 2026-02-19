// --- ELECTRON ENTEGRASYONU ---
const { ipcRenderer } = require('electron');

// Pencere Kontrolleri
const btnMinimize = document.getElementById('btnMinimize');
const btnCloseApp = document.getElementById('btnCloseApp');

if (btnMinimize) {
    btnMinimize.addEventListener('click', () => {
        ipcRenderer.send('minimize-app');
    });
}

if (btnCloseApp) {
    btnCloseApp.addEventListener('click', () => {
        ipcRenderer.send('close-app');
    });
}

// --- BLUETOOTH CLASS ---
class BluetoothManager {
    constructor() {
        this.SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb'; 
        this.CHAR_NOTE_SYNC = '00002a29-0000-1000-8000-00805f9b34fb'; 

        this.device = null;
        this.server = null;
    }

    async connect() {
        try {
            console.log("Cihaz aranıyor...");
            
            // Electron'da main.js isteği yakalar
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'AirNote' }], 
                optionalServices: [this.SERVICE_UUID]
            });

            this.server = await this.device.gatt.connect();
            console.log("Bağlandı:", this.device.name);

            const service = await this.server.getPrimaryService(this.SERVICE_UUID);
            await this.setupNotifications(service);

            return true;
        } catch (error) {
            console.error("Bağlantı Hatası:", error);
            return false;
        }
    }

    async setupNotifications(service) {
        try {
            const characteristic = await service.getCharacteristic(this.CHAR_NOTE_SYNC);
            await characteristic.startNotifications();

            characteristic.addEventListener('characteristicvaluechanged', (event) => {
                const value = event.target.value;
                const decoder = new TextDecoder('utf-8');
                const jsonString = decoder.decode(value);
                document.dispatchEvent(new CustomEvent('note-received', { detail: JSON.parse(jsonString) }));
            });
        } catch (e) {
            console.warn("Karakteristik okuma hatası:", e);
        }
    }
}

// --- APP LOGIC ---

const noteContainer = document.getElementById('noteContainer');
const toastElement = document.getElementById('toast');

// Modal Elements
const modal = document.getElementById('editorModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnSaveNote = document.getElementById('btnSaveNote');
const inputTitle = document.getElementById('inputTitle');

// FAB ve Menu Elements
const fabMain = document.getElementById('fabMain');
const fabMenu = document.getElementById('fabMenu');
const btnNewNote = document.getElementById('btnNewNote');
const btnKaiAi = document.getElementById('btnKaiAi');
const btnSearch = document.getElementById('btnSearch');
const splitFab = document.querySelector('.split-fab');

// Connection Capsule
const btnConnection = document.getElementById('btnConnection');
const connIcon = document.getElementById('connIcon');
const deviceNameTxt = document.getElementById('deviceName');
const deviceStatusTxt = document.getElementById('deviceStatus');
const batteryIndicator = document.getElementById('batteryIndicator');
const batteryLevelTxt = document.getElementById('batteryLevel');

// CHAT Elements
const kaiChatWindow = document.getElementById('kaiChatWindow');
const btnCloseChat = document.getElementById('btnCloseChat');
const chatInput = document.getElementById('chatInput');
const btnSendChat = document.getElementById('btnSendChat');
const chatBody = document.getElementById('chatBody');

// State
let notesList = []; 
let easyMDE;
const bleManager = new BluetoothManager();

// Başlangıç
document.addEventListener("DOMContentLoaded", () => {
    // EasyMDE Kurulumu
    if (typeof EasyMDE !== 'undefined') {
        easyMDE = new EasyMDE({
            element: document.getElementById('inputContent'),
            placeholder: "Notunuzu buraya yazın...",
            status: false,
            spellChecker: false,
            toolbar: ["bold", "italic", "heading", "|", "quote", "code", "link", "|", "preview"]
        });
    } else {
        console.error("EasyMDE kütüphanesi yüklenemedi!");
    }
});

// Event Listeners

// 1. Bluetooth Bağlantısı
btnConnection.addEventListener('click', async () => {
    if (btnConnection.classList.contains('connected')) {
        if(confirm("Bağlantıyı kesmek istiyor musunuz?")) {
            setConnectionState('disconnected');
            showToast("Bağlantı kesildi.");
        }
        return;
    }

    setConnectionState('connecting');
    
    try {
        const isConnected = await bleManager.connect();
        if (isConnected) {
            const devName = bleManager.device ? bleManager.device.name : "AirNote Device";
            setConnectionState('connected', devName);
            showToast("Bağlantı Başarılı! 🔋");
            simulateBatteryLevel(); 
        } else {
            setConnectionState('disconnected');
            showToast("Cihaz bulunamadı");
        }
    } catch (e) {
        setConnectionState('disconnected');
        showToast("Hata: " + e.message);
    }
});

// 2. FAB & Menü
fabMain.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMenu();
});

btnNewNote.addEventListener('click', () => {
    closeMenu();
    openModal();
});

btnSearch.addEventListener('click', () => {
    const term = prompt("Notlarda ara:");
    if(term) showToast(`"${term}" aranıyor...`);
});

// 3. Modal
btnCloseModal.addEventListener('click', closeModal);
modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
});

btnSaveNote.addEventListener('click', async () => {
    const title = inputTitle.value.trim();
    const content = easyMDE ? easyMDE.value().trim() : document.getElementById('inputContent').value;

    if (!title && !content) {
        showToast("Boş not kaydedilemez.");
        return;
    }

    const newNote = {
        id: Date.now(),
        name: title || "Başlıksız",
        description: content,
        createdAt: Date.now()
    };

    onNoteReceived(newNote);
    showToast("Not kaydedildi!");
    closeModal();
});

// 4. Chat & Kai AI
btnKaiAi.addEventListener('click', () => {
    closeMenu();
    openChat();
});

btnCloseChat.addEventListener('click', closeChat);

btnSendChat.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto'; 
    chatInput.style.height = chatInput.scrollHeight + 'px';
    btnSendChat.disabled = chatInput.value.trim() === "";
});

// 5. Global Events
document.addEventListener('click', (e) => {
    if (!fabMain.contains(e.target) && !fabMenu.contains(e.target)) {
        closeMenu();
    }
});

document.addEventListener('note-received', (e) => onNoteReceived(e.detail));

// Helper Functions

function openModal() {
    modal.classList.add('show');
    inputTitle.value = "";
    if (easyMDE) {
        easyMDE.value("");
        setTimeout(() => easyMDE.codemirror.refresh(), 200);
    }
    inputTitle.focus();
}

function toggleMenu() {
    if (fabMenu.classList.contains('show')) closeMenu();
    else {
        fabMenu.classList.add('show');
        splitFab.classList.add('active');
    }
}

function closeMenu() {
    fabMenu.classList.remove('show');
    splitFab.classList.remove('active');
}

function closeModal() {
    modal.classList.remove('show');
}

function onNoteReceived(note) {
    notesList.unshift(note);
    renderNotes();
}

function renderNotes() {
    noteContainer.innerHTML = ''; 
    if (notesList.length === 0) {
        noteContainer.innerHTML = `
            <div class="empty-state">
                <span class="material-icons empty-icon">note_add</span>
                <p>Listeniz boş.</p>
            </div>`;
        return;
    }

    notesList.forEach(note => {
        const card = document.createElement('div');
        card.className = 'note-card';
        let formattedContent = note.description;
        if (typeof marked !== 'undefined') {
            formattedContent = marked.parse(note.description);
        }
        card.innerHTML = `
            <h3>${note.name}</h3>
            <div class="note-content-markdown">${formattedContent}</div>
            <small>${getRelativeTime(note.createdAt)}</small>
        `;
        noteContainer.appendChild(card);
    });
}

function showToast(message) {
    toastElement.innerText = message;
    toastElement.className = "toast show";
    setTimeout(() => toastElement.className = "toast", 3000);
}

function getRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Az önce";
    if (mins < 60) return `${mins} dk önce`;
    return `${Math.floor(mins / 60)} saat önce`;
}

function setConnectionState(state, name = "") {
    btnConnection.classList.remove('disconnected', 'connecting', 'connected');
    switch (state) {
        case 'disconnected':
            btnConnection.classList.add('disconnected');
            connIcon.innerText = "bluetooth_disabled";
            deviceNameTxt.innerText = "Cihaz Eşleşmedi";
            deviceStatusTxt.innerText = "Bağlanmak için tıkla";
            batteryIndicator.classList.add('hidden');
            break;
        case 'connecting':
            btnConnection.classList.add('connecting');
            connIcon.innerText = "bluetooth_searching";
            deviceNameTxt.innerText = "Aranıyor...";
            deviceStatusTxt.innerText = "Lütfen bekleyin";
            batteryIndicator.classList.add('hidden');
            break;
        case 'connected':
            btnConnection.classList.add('connected');
            connIcon.innerText = "bluetooth_connected";
            deviceNameTxt.innerText = name;
            deviceStatusTxt.innerText = "Senkronize edildi";
            batteryIndicator.classList.remove('hidden');
            break;
    }
}

function simulateBatteryLevel() { batteryLevelTxt.innerText = "85%"; }

function openChat() {
    kaiChatWindow.classList.add('show');
    setTimeout(() => chatInput.focus(), 300);
}

function closeChat() { kaiChatWindow.classList.remove('show'); }

function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    chatInput.value = "";
    chatInput.style.height = 'auto';
    btnSendChat.disabled = true;

    const welcome = chatBody.querySelector('.chat-welcome');
    if (welcome) welcome.style.display = 'none';

    showTypingIndicator();

    setTimeout(() => {
        removeTypingIndicator();
        simulateKaiResponse(text);
    }, 1500);
}

function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    if (sender === 'kai' && typeof marked !== 'undefined') msgDiv.innerHTML = marked.parse(text);
    else msgDiv.innerText = text;
    chatBody.appendChild(msgDiv);
    chatBody.scrollTop = chatBody.scrollHeight;
}

let typingIndicator = null;
function showTypingIndicator() {
    typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>`;
    chatBody.appendChild(typingIndicator);
    chatBody.scrollTop = chatBody.scrollHeight;
}

function removeTypingIndicator() {
    if (typingIndicator) { typingIndicator.remove(); typingIndicator = null; }
}

function simulateKaiResponse(userText) {
    const lower = userText.toLowerCase();
    let response = "Bunu henüz öğrenemedim.";
    if (lower.includes("merhaba")) response = "Merhaba! Nasıl yardımcı olabilirim?";
    else if (lower.includes("not")) response = "Notlarını senin için düzenleyebilirim.";
    else if (lower.includes("kai")) response = "Ben Kai, senin kişisel asistanınım.";
    addMessage(response, 'kai');
}