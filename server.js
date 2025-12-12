// FILE server.js (CẬP NHẬT: THỜI TIẾT + CẢNH BÁO KHÍ GA BẬT ĐÈN)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios'); // 📦 Bắt buộc: npm install axios

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// --- CẤU HÌNH NGƯỠNG ---
const TEMP_LIMIT = 35;
const GAS_LIMIT = 2000;
const RAIN_DETECTED = 1;

// --- CẤU HÌNH API THỜI TIẾT (OpenWeatherMap) ---
// ⚠️ Đăng ký miễn phí tại openweathermap.org để lấy Key
const WEATHER_API_KEY = '31e0334beffad83dfda8b665003245bc'; // <--- Dán KEY của bạn vào đây
const CITY = 'Ho Chi Minh, VN'; 
const WEATHER_URL = `http://api.openweathermap.org/data/2.5/weather?q=${CITY}&appid=${WEATHER_API_KEY}&units=metric&lang=vi`;

// --- DATABASE TRONG RAM ---
let db = {
    // Dữ liệu từ cảm biến gửi lên
    temp: 0, humid: 0, gas: 0, rain: 0, image: "",
    
    // Các thiết bị điều khiển (Thêm 'led' cho đèn báo động)
    controls: { 
        fan: 0,    // Quạt (theo nhiệt độ)
        servo: 0,  // Mái che (theo mưa)
        led: 0     // Đèn báo động (theo khí ga) -> MỚI THÊM
    },
    
    // Trạng thái cảnh báo để Web hiển thị
    alerts: { gasDanger: false, rainDanger: false },
    
    // Dữ liệu thời tiết online
    weatherOnline: { 
        temp: "--", desc: "Đang tải...", icon: "" 
    },
    
    lastUpdate: Date.now()
};

// --- HÀM LẤY THỜI TIẾT (TỰ ĐỘNG CHẠY) ---
const fetchWeather = async () => {
    try {
        if (WEATHER_API_KEY === 'Y31e0334beffad83dfda8b665003245bc') return; // Bỏ qua nếu chưa có Key
        
        const response = await axios.get(WEATHER_URL);
        const data = response.data;
        
        db.weatherOnline = {
            temp: Math.round(data.main.temp),
            desc: data.weather[0].description, // VD: "mây rải rác"
            icon: `http://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png`
        };
        console.log(`☁️ Weather updated: ${db.weatherOnline.temp}°C - ${db.weatherOnline.desc}`);
    } catch (error) {
        console.error("❌ Weather Error:", error.message);
    }
};

// Lấy thời tiết ngay khi chạy và lặp lại mỗi 15 phút
fetchWeather();
setInterval(fetchWeather, 15 * 60 * 1000);

// --- API NHẬN DỮ LIỆU TỪ ESP32 ---
app.post('/api/update', (req, res) => {
    const { temp, humid, gas, rain, image } = req.body;
    
    // 1. Cập nhật dữ liệu cảm biến
    if (temp !== undefined) db.temp = temp;
    if (humid !== undefined) db.humid = humid;
    if (gas !== undefined) db.gas = gas;
    if (rain !== undefined) db.rain = rain;
    if (image !== undefined) db.image = image;
    
    db.lastUpdate = Date.now();

    // 2. XỬ LÝ LOGIC TỰ ĐỘNG (Automation)
    
    // >> Logic Mưa: Mưa (1) -> Thu sào (Servo 1)
    if (db.rain == RAIN_DETECTED) {
        db.controls.servo = 1;
        db.alerts.rainDanger = true;
    } else {
        db.controls.servo = 0;
        db.alerts.rainDanger = false;
    }

    // >> Logic Khí Ga (YÊU CẦU MỚI CỦA BẠN): 
    // Nếu Gas > 2000 -> Báo động Web (alerts) VÀ Bật đèn ESP32 (controls.led)
    if (db.gas > GAS_LIMIT) {
        db.alerts.gasDanger = true; 
        db.controls.led = 1;  // <--- Gửi lệnh bật đèn về ESP32
    } else {
        db.alerts.gasDanger = false;
        db.controls.led = 0;  // <--- Tắt đèn
    }

    // >> Logic Nhiệt độ: Nóng -> Bật quạt
    if (db.temp > TEMP_LIMIT) {
        db.controls.fan = 1;
    } else {
        db.controls.fan = 0;
    }

    // 3. Phản hồi về ESP32 (kèm lệnh điều khiển mới nhất)
    // ESP32 sẽ nhận được JSON dạng: { "success": true, "controls": { "fan": 0, "servo": 0, "led": 1 } }
    res.json({ success: true, controls: db.controls });
});

// --- API CHO WEB/APP LẤY DỮ LIỆU ---
app.get('/api/data', (req, res) => {
    const isOnline = (Date.now() - db.lastUpdate) < 15000;
    // Trả về tất cả để Web hiển thị (Cảm biến, Nút bấm, Cảnh báo, Thời tiết)
    res.json({ ...db, isOnline });
});

// --- API ĐIỀU KHIỂN THỦ CÔNG TỪ WEB ---
app.post('/api/control', (req, res) => {
    const { device, status } = req.body;
    // Cho phép điều khiển: fan, servo, led
    if (db.controls[device] !== undefined) {
        db.controls[device] = parseInt(status);
    }
    res.json({ success: true, controls: db.controls });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));