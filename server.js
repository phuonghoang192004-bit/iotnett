const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Bộ nhớ lưu trữ trạng thái
let db = {
    temp: 0, humid: 0, light: 0,
    controls: { lamp: 0, fan: 0, pump: 0 }, // 0: Tắt, 1: Bật
    image: "", // Chuỗi ảnh Base64
    lastUpdate: Date.now()
};

// 1. API cho ESP32 (Gửi cảm biến lên, lấy lệnh về)
app.post('/api/update', (req, res) => {
    const { temp, humid, light, image } = req.body;
    
    if (temp !== undefined) db.temp = temp;
    if (humid !== undefined) db.humid = humid;
    if (light !== undefined) db.light = light;
    if (image !== undefined) db.image = image;
    
    db.lastUpdate = Date.now();

    // Trả về trạng thái nút bấm để ESP32 thực hiện
    res.json({ controls: db.controls });
});

// 2. API cho Web (Lấy dữ liệu hiển thị)
app.get('/api/data', (req, res) => {
    // Nếu quá 10s không có tin từ ESP32 -> Offline
    const isOnline = (Date.now() - db.lastUpdate) < 10000;
    res.json({ ...db, isOnline });
});

// 3. API cho Web (Gửi lệnh điều khiển)
app.post('/api/control', (req, res) => {
    const { device, status } = req.body;
    if (db.controls[device] !== undefined) {
        db.controls[device] = parseInt(status);
    }
    res.json({ success: true, controls: db.controls });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));