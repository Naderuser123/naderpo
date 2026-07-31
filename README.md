# تقویم شمسی - Cloudflare Worker
### طراحی شده توسط نادر اکشیک

یک Cloudflare Worker برای تقویم شمسی ایران با تمام مناسبت‌ها 🌙

![Cloudflare](https://img.shields.io/badge/Cloudflare-Worker-F38020?style=for-the-badge&logo=cloudflare)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-yellow?style=for-the-badge&logo=javascript)

## ✨ ویژگی‌ها

- 📅 تقویم شمسی کامل با ۱۲ ماه
- 🎉 تمام مناسبت‌های رسمی ایران
- 🌐 اجرا روی Edge Network کلودفلر
- ⚡ سرعت بسیار بالا
- 📱 طراحی ریسپانسیو
- 🔌 REST API برای استفاده در پروژه‌های دیگر

## 🚀 نحوه Deploy

### پیش‌نیازها
- Node.js 18+
- حساب Cloudflare (رایگان)
- Wrangler CLI

### نصب Wrangler
```bash
npm install -g wrangler
```

### احراز هویت
```bash
wrangler login
```

### Deploy کردن
```bash
# Clone یا کپی پروژه
git clone <repo-url>
cd persian-calendar-worker

# Deploy
wrangler deploy
```

Worker شما روی URL زیر در دسترس خواهد بود:
```
https://persian-calendar-nader.<your-subdomain>.workers.dev
```

## 📡 API Endpoints

### دریافت تاریخ امروز
```http
GET /api/date
```

**پاسخ:**
```json
{
  "jalali": {
    "year": 1404,
    "month": 2,
    "day": 10,
    "monthName": "اردیبهشت",
    "dayName": "چهارشنبه"
  },
  "gregorian": {
    "year": 2025,
    "month": 4,
    "day": 29
  },
  "event": {
    "type": "national",
    "title": "روز بزرگداشت عطار",
    "desc": "عطار نیشابوری"
  },
  "isFriday": false,
  "isHoliday": true
}
```

### دریافت مناسبت یک روز خاص
```http
GET /api/events/12-25
GET /api/events/1404-6-1
```

**پاسخ:**
```json
{
  "date": {
    "month": 12,
    "day": 25,
    "monthName": "اسفند",
    "dayName": "جمعه"
  },
  "event": {
    "type": "nowruz",
    "title": "پنجمین روز نوروز",
    "desc": "پنجم فروردین"
  },
  "isFriday": true
}
```

### دریافت تقویم یک ماه
```http
GET /api/calendar/1404-6
```

**پاسخ:**
```json
{
  "year": 1404,
  "month": 6,
  "monthName": "شهریور",
  "daysInMonth": 31,
  "firstDayOfWeek": 3,
  "days": [
    {
      "day": 1,
      "month": 6,
      "year": 1404,
      "isCurrentMonth": true,
      "isFriday": true,
      "event": {
        "type": "religious",
        "title": "عاشورای حسینی",
        "desc": "عاشورا"
      }
    }
    // ... بقیه روزها
  ]
}
```

## 📁 ساختار فایل‌ها

```
persian-calendar-worker/
├── persian-calendar-worker.js   # کد اصلی Worker
├── wrangler.toml                # تنظیمات Cloudflare
├── persian-calendar.html        # نسخه HTML ساده (برای تست محلی)
└── README.md                    # این فایل
```

## ⚙️ تنظیمات سفارشی

### تغییر دامنه
در فایل `wrangler.toml` بخش `routes` را ویرایش کنید:
```toml
[[routes]]
pattern = "calendar.yourdomain.com"
zone_name = "yourdomain.com"
```

### اضافه کردن KV Cache
```toml
[[kv_namespaces]]
binding = "CACHE"
id = "your-kv-namespace-id"
```

## 🎨 توسعه محلی

```bash
# اجرای Worker به صورت محلی
wrangler dev

# اجرا با Tail (لاگ‌های real-time)
wrangler dev --tail
```

## 📝 انواع مناسبت‌ها

| نوع | رنگ | توضیح |
|-----|------|-------|
| `nowruz` | 🟢 سبز | نوروز و جشن‌های بهاری |
| `religious` | 🟣 بنفش | اعیاد مذهبی |
| `national` | 🔵 آبی | مناسبت‌های ملی |
| `holiday` | 🔴 قرمز | تعطیلات رسمی |

## 🤝 مشارکت

برای اضافه کردن مناسبت‌های جدید، فایل `persian-calendar-worker.js` را ویرایش کرده و آرایه `holidays` را به‌روزرسانی کنید:

```javascript
const holidays = {
  '1-1': { type: 'nowruz', title: 'نوروز', desc: 'آغاز سال نو شمسی' },
  // مناسبت‌های جدید را اینجا اضافه کنید
};
```

## 📜 لایسنس

MIT License - نادر اکشیک

---

ساخته شده با ❤️ روی Cloudflare Workers
