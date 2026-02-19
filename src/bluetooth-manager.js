// Kotlin'deki "object" veya "class" gibi düşün.
export class BluetoothManager {
    constructor() {
        // UUID Sabitleri (Senin belirlediğin UUID'ler buraya)
        this.SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb'; // Örnek
        this.CHAR_NOTE_SYNC = '00002a29-0000-1000-8000-00805f9b34fb'; // Örnek

        this.device = null;
        this.server = null;
    }

    // Kotlin: suspend fun connect()
    async connect() {
        try {
            console.log("Cihaz aranıyor...");
            
            // 1. Cihazı Bul (Scanning)
            this.device = await navigator.bluetooth.requestDevice({
                filters: [{ namePrefix: 'AirNote' }], // AirNote cihazlarını filtrele
                optionalServices: [this.SERVICE_UUID]
            });

            // 2. GATT Sunucusuna Bağlan
            this.server = await this.device.gatt.connect();
            console.log("Bağlandı:", this.device.name);

            // 3. Servisi Al
            const service = await this.server.getPrimaryService(this.SERVICE_UUID);

            // 4. Karakteristikleri (Uç noktaları) Hazırla
            await this.setupNotifications(service);

            return true;
        } catch (error) {
            console.error("Bağlantı Hatası:", error);
            return false;
        }
    }

    // Event-Driven Dinleme (Flow.collect gibi)
    async setupNotifications(service) {
        const characteristic = await service.getCharacteristic(this.CHAR_NOTE_SYNC);
        
        // Bildirimleri aç (Polling yerine Event-Driven)
        await characteristic.startNotifications();

        // Veri geldiğinde tetiklenecek olay
        characteristic.addEventListener('characteristicvaluechanged', (event) => {
            const value = event.target.value;
            const decoder = new TextDecoder('utf-8');
            const jsonString = decoder.decode(value);
            
            console.log("AirNote'tan veri geldi:", jsonString);
            // Burada UI'a haber vereceğiz (Callback veya EventBus ile)
            document.dispatchEvent(new CustomEvent('note-received', { detail: JSON.parse(jsonString) }));
        });
    }

    // Veri Gönderme (Repository.saveNote gibi)
    async sendCommand(commandData) {
        if (!this.server || !this.server.connected) return;

        const service = await this.server.getPrimaryService(this.SERVICE_UUID);
        const characteristic = await service.getCharacteristic(this.CHAR_NOTE_SYNC);

        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify(commandData));

        // Chunking (Parçalama) mantığı buraya eklenecek (İleri seviye)
        await characteristic.writeValue(data);
    }
}