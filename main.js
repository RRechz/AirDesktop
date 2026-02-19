const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        frame: false, // Çerçevesiz tasarım
        webPreferences: {
            nodeIntegration: true,    // HTML içinde require kullanabilmek için ŞART
            contextIsolation: false,  // app.js ile rahat iletişim için ŞART
            enableRemoteModule: false,
            devTools: true            // Hata ayıklama için konsolu açar
        }
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // --- PENCERE KONTROLÜ (IPC) ---
    // app.js'den gelen kapatma/küçültme isteklerini dinler
    ipcMain.on('minimize-app', () => {
        mainWindow.minimize();
    });

    ipcMain.on('close-app', () => {
        mainWindow.close();
    });

    // Bluetooth izinlerini otomatik yönetmek için
    mainWindow.webContents.on('select-bluetooth-device', (event, deviceList, callback) => {
        event.preventDefault();
        console.log('Bulunan cihazlar:', deviceList);
        
        const result = deviceList.find((device) => {
            return device.deviceName && device.deviceName.includes('AirNote');
        });
        
        if (result) {
            callback(result.deviceId);
        } else {
            // Cihaz yoksa callback boş dönebilir
        }
    });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});