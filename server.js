const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' })); // Cho phép gửi ảnh tới 10MB

// Bộ nhớ tạm thời (RAM)
let storage = {
    temp: 0,
    humid: 0,
    light: 0,
    image: "", // Chuỗi Base64 của ảnh
    controls: { lamp: 0, fan: 0, pump: 0 }, // 0: Tắt, 1: Bật
    lastUpdate: Date.now()
};

// 1. API cho ESP32 gửi dữ liệu lên (Sensors + Camera)
app.post('/api/update', (req, res) => {
    const { temp, humid, light, image } = req.body;
    
    if (temp !== undefined) storage.temp = temp;
    if (humid !== undefined) storage.humid = humid;
    if (light !== undefined) storage.light = light;
    if (image !== undefined) storage.image = image; // ESP32 gửi chuỗi Base64
    
    storage.lastUpdate = Date.now();
    
    // Trả về trạng thái nút bấm để ESP32 điều khiển thiết bị
    res.json({ controls: storage.controls });
});

// 2. API cho Web đọc dữ liệu về hiển thị
app.get('/api/data', (req, res) => {
    // Tính trạng thái Online (nếu quá 10s không cập nhật là Offline)
    const isOnline = (Date.now() - storage.lastUpdate) < 10000;
    res.json({ ...storage, isOnline });
});

// 3. API cho Web điều khiển thiết bị
app.post('/api/control', (req, res) => {
    const { device, status } = req.body; // status: 1 hoặc 0
    if (storage.controls[device] !== undefined) {
        storage.controls[device] = parseInt(status);
        console.log(`Đã chỉnh ${device} thành ${status}`);
    }
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chạy tại port ${PORT}`));