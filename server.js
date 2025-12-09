const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// --- CÀI ĐẶT NGƯỠNG AN TOÀN TẠI ĐÂY ---
const TEMP_LIMIT = 30;      // Trên 30 độ -> Bật Quạt
const GAS_LIMIT = 1500;     // Trên 1500 -> Bật Đèn báo
const RAIN_LIMIT = 1;       // 1 là có mưa -> Đóng Servo

let db = {
    temp: 0, humid: 0, gas: 0, rain: 0, image: "",
    // Trạng thái điều khiển: 0 (Tắt/Mở), 1 (Bật/Đóng)
    controls: { lamp: 0, fan: 0, servo: 0 },
    lastUpdate: Date.now()
};

// 1. API Giao tiếp với ESP32
app.post('/api/update', (req, res) => {
    const { temp, humid, gas, rain, image } = req.body;
    
    // 1. Cập nhật dữ liệu vào kho
    if (temp !== undefined) db.temp = temp;
    if (humid !== undefined) db.humid = humid;
    if (gas !== undefined) db.gas = gas;
    if (rain !== undefined) db.rain = rain;
    if (image !== undefined) db.image = image;
    
    db.lastUpdate = Date.now();

    // 2. XỬ LÝ LOGIC (SERVER QUYẾT ĐỊNH)
    // -------------------------------------------------
    
    // Logic Quạt (Theo nhiệt độ)
    if (db.temp > TEMP_LIMIT) {
        db.controls.fan = 1;
    } else {
        db.controls.fan = 0;
    }

    // Logic Đèn (Theo khí Ga)
    if (db.gas > GAS_LIMIT) {
        db.controls.lamp = 1;
    } else {
        db.controls.lamp = 0;
    }

    // Logic Servo (Theo Mưa)
    if (db.rain == RAIN_LIMIT) {
        db.controls.servo = 1; // 1 = Đóng mái che (180 độ)
    } else {
        db.controls.servo = 0; // 0 = Mở mái che (0 độ)
    }
    
    // -------------------------------------------------

    // 3. Phản hồi lại cho ESP32 biết phải làm gì
    res.json({ 
        success: true, 
        controls: db.controls // Gửi bộ lệnh về cho ESP32
    });
});

// 2. API cho Web lấy dữ liệu
app.get('/api/data', (req, res) => {
    const isOnline = (Date.now() - db.lastUpdate) < 15000;
    res.json({ ...db, isOnline });
});

// 3. API cho Web điều khiển (Tùy chọn)
// Lưu ý: Vì Server có logic tự động ở trên, nên nếu bạn bấm nút trên Web,
// nó có thể bị Server ghi đè lại ngay lập tức nếu điều kiện cảm biến vẫn thỏa mãn.
app.post('/api/control', (req, res) => {
    const { device, status } = req.body;
    if (db.controls[device] !== undefined) {
        db.controls[device] = parseInt(status);
    }
    res.json({ success: true, controls: db.controls });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server Brain running on port ${PORT}`));