/**
 * Cloudflare Worker - تقویم شمسی
 * طراحی شده توسط نادر اکشیک
 * 
 * نحوه Deploy:
 * 1. wrangler init persian-calendar
 * 2. این کد را در src/index.js کپی کنید
 * 3. wrangler deploy
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API endpoints
    if (path === '/api/date') {
      return handleDateApi();
    }
    
    if (path.startsWith('/api/events/')) {
      const parts = path.split('/');
      const dateStr = parts[parts.length - 1];
      return handleEventsApi(dateStr);
    }

    if (path.startsWith('/api/calendar/')) {
      const parts = path.split('/');
      const yearMonth = parts[parts.length - 1]; // YYYY-MM format
      return handleCalendarApi(yearMonth);
    }

    // Serve HTML page
    return new Response(getCalendarHTML(), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'X-Powered-By': 'Cloudflare Worker - نادر اکشیک'
      }
    });
  }
};

// ==================== Persian Calendar Logic ====================

const persianMonths = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'
];

const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
const weekDaysShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

class JalaliCalendar {
  static toJalali(gy, gm, gd) {
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy = (gy <= 1600) ? 0 : 979;
    gy -= (gy <= 1600) ? 621 : 1600;
    const gy2 = (gm > 2) ? (gy + 1) : gy;
    let days = (365 * gy) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) 
      + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053);
    days %= 12053;
    jy += 4 * Math.floor(days / 1461);
    days %= 1461;
    jy += Math.floor((days - 1) / 365);
    if (days > 365) days = (days - 1) % 365;
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
  }

  static toGregorian(jy, jm, jd) {
    let jy_new = jy + 1595;
    const days = -1 + 365 * jy_new + Math.floor(jy_new / 33) * 8 
      + Math.floor((jy_new % 33 + 3) / 4) + jd + ((jm < 7) ? (jm - 1) * 31 : ((jm - 7) * 30) + 186);
    let gy = 400 * Math.floor(days / 146097);
    let d = days - 146097 * Math.floor(gy / 400);
    gy += 100 * Math.floor(d / 36524);
    d -= 36524 * Math.floor(gy / 100);
    gy += 4 * Math.floor(d / 1461);
    d -= 1461 * Math.floor(d / 1461);
    gy += Math.floor((d - 1) / 365);
    if (d > 365) d = (d - 1) % 365;
    const gd = d + 1;
    const sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || (gy % 400 === 0) ? 29 : 28, 
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let gm = 0;
    let v = gd;
    for (gm = 0; gm < 13 && v > sal_a[gm]; gm++) v -= sal_a[gm];
    return [gy, gm, gd];
  }

  static getDaysInMonth(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return this.isLeapYear(jy) ? 30 : 29;
  }

  static isLeapYear(jy) {
    return ((11 * jy + 14) % 30) < 11;
  }

  static getDayOfWeek(jy, jm, jd) {
    const [gy, gm, gd] = this.toGregorian(jy, jm, jd);
    const g_dow = new Date(gy, gm - 1, gd).getDay();
    return g_dow;
  }
}

// ==================== Events Database ====================

const holidays = {
  '1-1': { type: 'nowruz', title: 'نوروز', desc: 'آغاز سال نو شمسی' },
  '1-2': { type: 'nowruz', title: 'عید نوروز', desc: 'دومین روز نوروز' },
  '1-3': { type: 'nowruz', title: 'سومین روز نوروز', desc: 'سوم فروردین' },
  '1-4': { type: 'nowruz', title: 'چهارمین روز نوروز', desc: 'چهارم فروردین' },
  '1-5': { type: 'nowruz', title: 'پنجمین روز نوروز', desc: 'پنجم فروردین' },
  '1-6': { type: 'nowruz', title: 'ششمین روز نوروز', desc: 'ششم فروردین' },
  '1-7': { type: 'nowruz', title: 'هفتمین روز نوروز', desc: 'هفتم فروردین' },
  '1-8': { type: 'nowruz', title: 'هشتمین روز نوروز', desc: 'هشتم فروردین' },
  '1-9': { type: 'nowruz', title: 'نهمین روز نوروز', desc: 'نهم فروردین' },
  '1-10': { type: 'nowruz', title: 'دهمین روز نوروز', desc: 'دهم فروردین' },
  '1-11': { type: 'nowruz', title: 'یازدهمین روز نوروز', desc: 'یازدهم فروردین' },
  '1-12': { type: 'nowruz', title: 'دوازدهمین روز نوروز', desc: 'دوازدهم فروردین' },
  '1-13': { type: 'nowruz', title: 'سیزده‌بدر', desc: 'روز طبیعت' },
  '2-1': { type: 'national', title: 'روز بزرگداشت عطار', desc: 'عطار نیشابوری' },
  '2-12': { type: 'national', title: 'روز معلم', desc: 'بزرگداشت معلم' },
  '2-15': { type: 'religious', title: 'شب قدر', desc: 'شب قدر' },
  '3-1': { type: 'national', title: 'روز بزرگداشت حکیم عمر خیام', desc: 'عمر خیام' },
  '3-14': { type: 'national', title: 'تأسیس جمهوری اسلامی', desc: 'رفراندوم ۱۲ فروردین' },
  '3-15': { type: 'religious', title: 'شهادت امام علی (ع)', desc: 'ضربت امام علی' },
  '4-1': { type: 'national', title: 'روز بزرگداشت مولانا', desc: 'مولوی' },
  '4-7': { type: 'religious', title: 'شهادت امام جعفر صادق (ع)', desc: 'امام ششم' },
  '4-14': { type: 'national', title: 'روز قلم', desc: 'روز قلم' },
  '5-1': { type: 'national', title: 'روز بزرگداشت خیام', desc: 'خیام' },
  '5-14': { type: 'religious', title: 'عید غدیر خم', desc: 'عید غدیر' },
  '5-17': { type: 'religious', title: 'عید قربان', desc: 'عید قربان' },
  '5-30': { type: 'religious', title: 'تاسوعای حسینی', desc: 'تاسوعا' },
  '6-1': { type: 'religious', title: 'عاشورای حسینی', desc: 'عاشورا' },
  '6-4': { type: 'national', title: 'روز بزرگداشت سعدی', desc: 'سعدی' },
  '6-8': { type: 'national', title: 'روز کتاب و کتابخوانی', desc: 'روز کتاب' },
  '6-17': { type: 'national', title: 'شهادت آیت‌الله بهشتی', desc: 'شهید بهشتی' },
  '6-21': { type: 'national', title: 'روز سینما', desc: 'روز سینما' },
  '6-27': { type: 'religious', title: 'اربعین حسینی', desc: 'اربعین' },
  '7-1': { type: 'national', title: 'آغاز هفته دولت', desc: 'هفته دولت' },
  '7-8': { type: 'national', title: 'روز بزرگداشت حافظ', desc: 'حافظ' },
  '7-12': { type: 'religious', title: 'ولادت حضرت رسول (ص)', desc: 'هفته وحدت' },
  '7-20': { type: 'national', title: 'روز بزرگداشت سعدی', desc: 'سعدی' },
  '8-4': { type: 'national', title: 'روز نیروی انتظامی', desc: 'روز پلیس' },
  '8-13': { type: 'national', title: 'روز دانش‌آموز', desc: 'روز دانش‌آموز' },
  '8-15': { type: 'religious', title: 'رحلت حضرت رسول (ص)', desc: 'شهادت پیامبر' },
  '8-16': { type: 'religious', title: 'شهادت امام حسن (ع)', desc: 'امام حسن' },
  '8-22': { type: 'national', title: 'روز جهانی مبارزه با مواد مخدر', desc: 'روز مبارزه با مواد' },
  '8-25': { type: 'national', title: 'روز بسیج', desc: 'روز بسیج' },
  '9-5': { type: 'national', title: 'روز ناشنوایان', desc: 'روز ناشنوایان' },
  '9-7': { type: 'national', title: 'شهادت دکتر چمران', desc: 'شهید چمران' },
  '9-9': { type: 'national', title: 'روز جهانی حقوق بشر', desc: 'حقوق بشر' },
  '11-1': { type: 'national', title: 'پیروزی انقلاب اسلامی', desc: 'پیروزی انقلاب' },
  '11-11': { type: 'national', title: 'روز پرستار', desc: 'روز پرستار' },
  '11-10': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-11': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-12': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-13': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-14': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-15': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-16': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-17': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-18': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-19': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-20': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-21': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-22': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-23': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-24': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-25': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-26': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-27': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-28': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-29': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '11-30': { type: 'holiday', title: 'شب یلدا', desc: 'شب یلدا' },
  '12-29': { type: 'national', title: 'روز ملی energy', desc: 'روز ملی' },
  '12-30': { type: 'national', title: 'پایان سال', desc: 'آخرین روز سال' },
};

// ==================== API Handlers ====================

function handleDateApi() {
  const now = new Date();
  const [year, month, day] = JalaliCalendar.toJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const dayOfWeek = JalaliCalendar.getDayOfWeek(year, month, day);
  
  const dateKey = `${month}-${day}`;
  const event = holidays[dateKey];
  
  return new Response(JSON.stringify({
    jalali: { year, month, day, monthName: persianMonths[month - 1], dayName: persianDays[dayOfWeek] },
    gregorian: { 
      year: now.getFullYear(), 
      month: now.getMonth() + 1, 
      day: now.getDate(),
      dateString: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    },
    event: event || null,
    isFriday: dayOfWeek === 6,
    isHoliday: event !== undefined || dayOfWeek === 6
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function handleEventsApi(dateStr) {
  // dateStr format: MM-DD or YYYY-MM-DD
  const parts = dateStr.split('-');
  let month, day;
  
  if (parts.length === 2) {
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
  } else if (parts.length === 3) {
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  } else {
    return new Response(JSON.stringify({ error: 'Invalid date format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const dateKey = `${month}-${day}`;
  const event = holidays[dateKey];
  const dayOfWeek = JalaliCalendar.getDayOfWeek(1404, month, day); // Using 1404 as reference year
  
  return new Response(JSON.stringify({
    date: { month, day, monthName: persianMonths[month - 1], dayName: persianDays[dayOfWeek] },
    event: event || null,
    isFriday: dayOfWeek === 6
  }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function handleCalendarApi(yearMonth) {
  // yearMonth format: YYYY-MM or YYYY-M
  const parts = yearMonth.split('-');
  const year = parseInt(parts[0]);
  const month = parseInt(parts[1]);
  
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return new Response(JSON.stringify({ error: 'Invalid year-month format' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  const daysInMonth = JalaliCalendar.getDaysInMonth(year, month);
  const firstDayOfWeek = JalaliCalendar.getDayOfWeek(year, month, 1);
  
  // Previous month for padding
  let prevMonth = month === 1 ? 12 : month - 1;
  let prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = JalaliCalendar.getDaysInMonth(prevYear, prevMonth);
  
  const days = [];
  
  // Previous month padding
  const startDay = (firstDayOfWeek + 1) % 7;
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false });
  }
  
  // Current month
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = `${month}-${day}`;
    const event = holidays[dateKey];
    const dayOfWeek = JalaliCalendar.getDayOfWeek(year, month, day);
    
    days.push({
      day,
      month,
      year,
      isCurrentMonth: true,
      isFriday: dayOfWeek === 6,
      event
    });
  }
  
  // Next month padding
  const totalCells = startDay + daysInMonth;
  const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
  let nextMonth = month === 12 ? 1 : month + 1;
  let nextYear = month === 12 ? year + 1 : year;
  
  for (let i = 1; i <= remainingCells; i++) {
    days.push({ day: i, month: nextMonth, year: nextYear, isCurrentMonth: false });
  }
  
  return new Response(JSON.stringify({
    year,
    month,
    monthName: persianMonths[month - 1],
    daysInMonth,
    firstDayOfWeek,
    days
  }), {
    headers: { 
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}

// ==================== HTML Template ====================

function toPersianNum(num) {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return String(num).replace(/\d/g, d => persianDigits[d]);
}

function getCalendarHTML() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تقویم شمسی - نادر اکشیک | Cloudflare Worker</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;600;700;800&family=Lalezar&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #1a5f7a;
      --primary-light: #57c5b6;
      --secondary: #d4a373;
      --accent: #e9c46a;
      --bg-dark: #0f1419;
      --bg-card: #1a1f26;
      --bg-hover: #252d38;
      --text-primary: #f8f9fa;
      --text-secondary: #8b949e;
      --holiday: #ff6b6b;
      --friday: #ffd93d;
      --nowruz: #2ecc71;
      --religious: #9b59b6;
      --national: #3498db;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Vazirmatn', sans-serif;
      background: var(--bg-dark);
      min-height: 100vh;
      color: var(--text-primary);
    }

    .bg-pattern {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      opacity: 0.03;
      background-image: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      z-index: 0;
    }

    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
      position: relative;
      z-index: 1;
    }

    .header {
      text-align: center;
      margin-bottom: 3rem;
      animation: fadeInDown 0.8s ease-out;
    }

    .cloud-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #f38020, #f9a440);
      padding: 0.5rem 1.5rem;
      border-radius: 50px;
      font-size: 0.85rem;
      margin-bottom: 1rem;
      box-shadow: 0 4px 20px rgba(243, 128, 32, 0.3);
    }

    .designer-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      padding: 0.5rem 1.5rem;
      border-radius: 50px;
      font-size: 0.85rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 4px 20px rgba(26, 95, 122, 0.3);
    }

    .main-title {
      font-family: 'Lalezar', cursive;
      font-size: clamp(2.5rem, 8vw, 4rem);
      background: linear-gradient(135deg, var(--accent), var(--secondary), var(--primary-light));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 0.5rem;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 1.1rem;
      font-weight: 300;
    }

    .nav-section {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
      animation: fadeInUp 0.6s ease-out 0.2s both;
    }

    .month-nav {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .nav-btn {
      background: var(--bg-card);
      border: 1px solid rgba(255,255,255,0.1);
      color: var(--text-primary);
      width: 48px;
      height: 48px;
      border-radius: 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .nav-btn:hover {
      background: var(--bg-hover);
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    }

    .current-month {
      font-family: 'Lalezar', cursive;
      font-size: 1.8rem;
      min-width: 200px;
      text-align: center;
    }

    .today-btn {
      background: linear-gradient(135deg, var(--secondary), var(--accent));
      border: none;
      color: var(--bg-dark);
      padding: 0.75rem 1.5rem;
      border-radius: 12px;
      font-family: 'Vazirmatn', sans-serif;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
    }

    .today-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(212, 163, 115, 0.4);
    }

    .calendar-wrapper {
      background: var(--bg-card);
      border-radius: 24px;
      padding: 1.5rem;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
      border: 1px solid rgba(255,255,255,0.05);
      animation: fadeInUp 0.8s ease-out 0.4s both;
    }

    .weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .weekday {
      text-align: center;
      padding: 1rem 0.5rem;
      font-weight: 600;
      color: var(--text-secondary);
      font-size: 0.9rem;
    }

    .weekday.friday { color: var(--friday); }

    .days-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 0.5rem;
    }

    .day {
      aspect-ratio: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
      background: transparent;
      border: 1px solid transparent;
    }

    .day:hover:not(.empty):not(.other-month) {
      background: var(--bg-hover);
      transform: scale(1.05);
    }

    .day-number {
      font-size: 1.2rem;
      font-weight: 500;
      z-index: 1;
    }

    .day-name {
      font-size: 0.65rem;
      color: var(--text-secondary);
      margin-top: 0.25rem;
      z-index: 1;
    }

    .day.other-month { opacity: 0.3; }

    .day.today {
      background: linear-gradient(135deg, var(--primary), var(--primary-light));
      box-shadow: 0 4px 20px rgba(26, 95, 122, 0.4);
    }

    .day.friday .day-number,
    .day.friday .day-name { color: var(--friday); }

    .day.holiday { background: rgba(255,107,107,0.15); border-color: rgba(255,107,107,0.3); }
    .day.holiday .day-number { color: var(--holiday); font-weight: 600; }

    .day.nowruz { background: rgba(46,204,113,0.15); border-color: rgba(46,204,113,0.3); }
    .day.nowruz .day-number { color: var(--nowruz); font-weight: 700; }

    .day.religious { background: rgba(155,89,182,0.15); border-color: rgba(155,89,182,0.3); }
    .day.religious .day-number { color: var(--religious); }

    .day.national { background: rgba(52,152,219,0.15); border-color: rgba(52,152,219,0.3); }
    .day.national .day-number { color: var(--national); }

    .holiday-dot {
      position: absolute;
      bottom: 6px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--holiday);
    }

    .day.nowruz .holiday-dot { background: var(--nowruz); }
    .day.religious .holiday-dot { background: var(--religious); }
    .day.national .holiday-dot { background: var(--national); }

    .event-modal {
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .event-modal.active {
      display: flex;
      opacity: 1;
    }

    .modal-content {
      background: var(--bg-card);
      border-radius: 24px;
      padding: 2rem;
      max-width: 400px;
      width: 90%;
      transform: scale(0.9) translateY(20px);
      transition: transform 0.3s ease;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .event-modal.active .modal-content { transform: scale(1) translateY(0); }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 1.5rem;
    }

    .modal-date {
      font-family: 'Lalezar', cursive;
      font-size: 1.5rem;
      color: var(--accent);
    }

    .modal-day { color: var(--text-secondary); font-size: 0.9rem; }

    .close-btn {
      background: var(--bg-hover);
      border: none;
      color: var(--text-primary);
      width: 36px;
      height: 36px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
    }

    .close-btn:hover { background: var(--holiday); }

    .event-list { list-style: none; }

    .event-item {
      padding: 1rem;
      background: var(--bg-hover);
      border-radius: 12px;
      margin-bottom: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .event-icon {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .event-icon.holiday { background: linear-gradient(135deg, var(--holiday), #ff8787); }
    .event-icon.nowruz { background: linear-gradient(135deg, var(--nowruz), #27ae60); }
    .event-icon.religious { background: linear-gradient(135deg, var(--religious), #a569bd); }
    .event-icon.national { background: linear-gradient(135deg, var(--national), #5dade2); }

    .event-text { flex: 1; }
    .event-title { font-weight: 600; margin-bottom: 0.25rem; }
    .event-desc { font-size: 0.85rem; color: var(--text-secondary); }

    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
      justify-content: center;
      margin-top: 2rem;
      padding: 1.5rem;
      background: var(--bg-card);
      border-radius: 16px;
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
      color: var(--text-secondary);
    }

    .legend-dot {
      width: 12px;
      height: 12px;
      border-radius: 4px;
    }

    .legend-dot.holiday { background: var(--holiday); }
    .legend-dot.nowruz { background: var(--nowruz); }
    .legend-dot.religious { background: var(--religious); }
    .legend-dot.national { background: var(--national); }
    .legend-dot.friday { background: var(--friday); }

    .api-section {
      margin-top: 3rem;
      background: var(--bg-card);
      border-radius: 16px;
      padding: 2rem;
    }

    .api-title {
      font-family: 'Lalezar', cursive;
      font-size: 1.5rem;
      margin-bottom: 1rem;
      color: var(--accent);
    }

    .api-endpoints {
      display: grid;
      gap: 1rem;
    }

    .api-endpoint {
      background: var(--bg-hover);
      border-radius: 12px;
      padding: 1rem;
      font-family: monospace;
      font-size: 0.9rem;
      direction: ltr;
      text-align: left;
    }

    .api-endpoint code {
      color: var(--primary-light);
    }

    @keyframes fadeInDown {
      from { opacity: 0; transform: translateY(-30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(30px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .container { padding: 1rem; }
      .calendar-wrapper { padding: 1rem; }
      .day { border-radius: 10px; }
      .day-number { font-size: 1rem; }
      .day-name { display: none; }
      .current-month { font-size: 1.3rem; min-width: 150px; }
    }
  </style>
</head>
<body>
  <div class="bg-pattern"></div>
  
  <div class="container">
    <header class="header">
      <div class="cloud-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
        </svg>
        Powered by Cloudflare Worker
      </div>
      <div class="designer-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
        </svg>
        طراحی شده توسط نادر اکشیک
      </div>
      <h1 class="main-title">تقویم شمسی</h1>
      <p class="subtitle">تقویم رسمی ایران با تمام مناسبت‌ها</p>
    </header>

    <nav class="nav-section">
      <div class="month-nav">
        <button class="nav-btn" id="prevMonth">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <span class="current-month" id="currentMonth"></span>
        <button class="nav-btn" id="nextMonth">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
      </div>
      <button class="today-btn" id="todayBtn">امروز</button>
    </nav>

    <div class="calendar-wrapper">
      <div class="weekdays" id="weekdays"></div>
      <div class="days-grid" id="daysGrid"></div>
    </div>

    <div class="legend">
      <div class="legend-item"><div class="legend-dot holiday"></div>تعطیل رسمی</div>
      <div class="legend-item"><div class="legend-dot friday"></div>جمعه</div>
      <div class="legend-item"><div class="legend-dot nowruz"></div>نوروز و جشن‌ها</div>
      <div class="legend-item"><div class="legend-dot religious"></div>اعیاد مذهبی</div>
      <div class="legend-item"><div class="legend-dot national"></div>مناسبت ملی</div>
    </div>

    <div class="api-section">
      <h2 class="api-title">API Endpoints</h2>
      <div class="api-endpoints">
        <div class="api-endpoint">
          <code>GET /api/date</code> - تاریخ امروز
        </div>
        <div class="api-endpoint">
          <code>GET /api/events/12-25</code> - مناسبت یک روز خاص
        </div>
        <div class="api-endpoint">
          <code>GET /api/calendar/1404-6</code> - تقویم یک ماه
        </div>
      </div>
    </div>
  </div>

  <div class="event-modal" id="eventModal">
    <div class="modal-content">
      <div class="modal-header">
        <div>
          <div class="modal-date" id="modalDate"></div>
          <div class="modal-day" id="modalDay"></div>
        </div>
        <button class="close-btn" id="closeModal">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <ul class="event-list" id="eventList"></ul>
    </div>
  </div>

  <script>
    const persianMonths = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
    const persianDays = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];
    const weekDaysShort = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

    let currentYear, currentMonth;
    let todayYear, todayMonth, todayDay;

    function toPersianNum(num) {
      const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
      return String(num).replace(/\\d/g, d => persianDigits[d]);
    }

    async function initCalendar() {
      try {
        const res = await fetch('/api/date');
        const data = await res.json();
        todayYear = data.jalali.year;
        todayMonth = data.jalali.month;
        todayDay = data.jalali.day;
        currentYear = todayYear;
        currentMonth = todayMonth;
        await loadMonth(currentYear, currentMonth);
      } catch (e) {
        console.error('Failed to load date:', e);
        currentYear = 1404;
        currentMonth = 1;
        await loadMonth(currentYear, currentMonth);
      }
    }

    async function loadMonth(year, month) {
      try {
        const res = await fetch(\`/api/calendar/\${year}-\${month}\`);
        const data = await res.json();
        renderCalendar(data);
      } catch (e) {
        console.error('Failed to load calendar:', e);
      }
    }

    function renderCalendar(data) {
      document.getElementById('currentMonth').textContent = \`\${data.monthName} \${toPersianNum(data.year)}\`;
      
      // Render weekdays
      document.getElementById('weekdays').innerHTML = weekDaysShort
        .map((day, i) => \`<div class="weekday \${i === 6 ? 'friday' : ''}">\${day}</div>\`)
        .join('');

      // Render days
      const daysHtml = data.days.map(d => {
        let classes = ['day'];
        if (!d.isCurrentMonth) classes.push('other-month');
        if (d.isCurrentMonth && d.year === todayYear && d.month === todayMonth && d.day === todayDay) {
          classes.push('today');
        }
        if (d.isFriday) classes.push('friday');
        if (d.event) {
          const typeClass = d.event.type === 'nowruz' ? 'nowruz' : d.event.type === 'religious' ? 'religious' : d.event.type === 'national' ? 'national' : 'holiday';
          classes.push(typeClass);
        }
        
        return \`
          <div class="\${classes.join(' ')}" data-date="\${d.month}-\${d.day}" data-day="\${d.day}" data-month="\${d.month}" data-year="\${d.year}">
            <span class="day-number">\${toPersianNum(d.day)}</span>
            \${d.event ? '<div class="holiday-dot"></div>' : ''}
          </div>
        \`;
      }).join('');

      document.getElementById('daysGrid').innerHTML = daysHtml;

      // Add click handlers
      document.querySelectorAll('.day:not(.other-month)').forEach(dayEl => {
        dayEl.addEventListener('click', () => showDayEvents(dayEl));
      });
    }

    async function showDayEvents(dayEl) {
      const dateKey = dayEl.dataset.date;
      const day = dayEl.dataset.day;
      const month = dayEl.dataset.month;
      const year = dayEl.dataset.year;
      
      try {
        const res = await fetch(\`/api/events/\${dateKey}\`);
        const data = await res.json();
        
        document.getElementById('modalDate').textContent = \`\${toPersianNum(data.date.day)} \${data.date.monthName} \${toPersianNum(year)}\`;
        document.getElementById('modalDay').textContent = data.date.dayName;
        
        let html = '';
        if (data.event) {
          const iconSvg = data.event.type === 'nowruz' ? 
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>' :
            data.event.type === 'religious' ?
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>' :
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>';
          
          html = \`
            <li class="event-item">
              <div class="event-icon \${data.event.type}">\${iconSvg}</div>
              <div class="event-text">
                <div class="event-title">\${data.event.title}</div>
                <div class="event-desc">\${data.event.desc}</div>
              </div>
            </li>
          \`;
        } else {
          html = \`
            <li class="event-item">
              <div class="event-text">
                <div class="event-title">روز عادی</div>
                <div class="event-desc">مناسبت خاصی ثبت نشده</div>
              </div>
            </li>
          \`;
        }
        
        document.getElementById('eventList').innerHTML = html;
        document.getElementById('eventModal').classList.add('active');
      } catch (e) {
        console.error('Failed to load events:', e);
      }
    }

    document.getElementById('prevMonth').addEventListener('click', () => {
      currentMonth--;
      if (currentMonth < 1) { currentMonth = 12; currentYear--; }
      loadMonth(currentYear, currentMonth);
    });

    document.getElementById('nextMonth').addEventListener('click', () => {
      currentMonth++;
      if (currentMonth > 12) { currentMonth = 1; currentYear++; }
      loadMonth(currentYear, currentMonth);
    });

    document.getElementById('todayBtn').addEventListener('click', () => {
      currentYear = todayYear;
      currentMonth = todayMonth;
      loadMonth(currentYear, currentMonth);
    });

    document.getElementById('closeModal').addEventListener('click', () => {
      document.getElementById('eventModal').classList.remove('active');
    });

    document.getElementById('eventModal').addEventListener('click', (e) => {
      if (e.target === document.getElementById('eventModal')) {
        document.getElementById('eventModal').classList.remove('active');
      }
    });

    initCalendar();
  </script>
</body>
</html>`;
}
