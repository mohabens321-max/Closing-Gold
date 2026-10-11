# MB 360° — منصة الجولات الافتراضية (Flask + Docker)

## الهيكل
```
mb360/
├── app.py                 نقطة الدخول (Flask)
├── backend/
│   ├── __init__.py        إنشاء التطبيق والصفحات
│   ├── config.py          الإعدادات من متغيرات البيئة
│   ├── storage.py         التخزين: ملفات محلية أو S3
│   ├── public_api.py      واجهة الزوار (البيت الفعّال فقط)
│   └── admin_api.py       واجهة الإدارة (برمز سري)
├── frontend/
│   ├── viewer/            صفحة الزوار والجولة والمخطط (HTML/CSS/JS)
│   ├── admin/             لوحة التحكم ومحرّر المخطط
│   └── shared/layout.js   ترتيب المخطط التلقائي
├── studio/MB360_Platform.html   أداتك الخاصة لصنع الجولات (لا ترسلها لأحد)
├── Dockerfile             لأي استضافة Docker ولتجربتك المحلية
├── Dockerfile.vercel      لـ Vercel
├── docker-compose.yml     تشغيل محلي أو على خادم
├── vercel.json            إعداد Vercel
└── .env.example           قالب المتغيرات
```

## تشغيل محلي
```bash
cp .env.example .env        # عدّل ADMIN_TOKEN
docker compose up --build   # ثم افتح http://localhost:8080/admin
```
بدون Docker: `pip install -r requirements.txt` ثم `ADMIN_TOKEN=... python app.py`.

## النشر على Vercel
**اقرأ هذا أولاً:**
1. خطة Hobby المجانية **للاستعمال الشخصي غير التجاري فقط**. بيع الخدمة للوكالات استعمال تجاري يحتاج خطة **Pro**.
2. Vercel يشغّل الحاوية كدالة **بلا قرص دائم**، فاستعمل `STORAGE=s3` مع خدمة تخزين خارجية متوافقة مع S3. التخزين المحلي يضيع.
3. حد الطلب والاستجابة **4.5 ميغابايت**. اجعل `MAX_UPLOAD_MB=4` وتجنّب خلفيات فيديو أكبر من ذلك.
4. ميزة Container Images قد تحتاج تفعيلاً على حسابك. راجع وثائق Vercel.

**الخطوات:**
1. أنشئ مستودع Git **خاصاً** وارفع المشروع (بدون `.env`).
2. في Vercel: Import Project من المستودع.
3. متغيرات البيئة (Settings ← Environment Variables):

| المتغير | القيمة |
|---|---|
| `ADMIN_TOKEN` | كلمة سر طويلة |
| `STORAGE` | `s3` |
| `S3_BUCKET` `S3_ENDPOINT` `S3_KEY` `S3_SECRET` | من مزوّد التخزين |
| `PORT` | `8080` |
| `MAX_UPLOAD_MB` | `4` |

4. Deploy، ثم افتح `/admin`.

أو بالأمر: `npm i -g vercel && vercel login && vercel deploy --prod`.

## النشر على استضافة Docker عادية (بقرص دائم)
`docker compose up -d --build` على خادمك. البيانات في المجلد `/data` (volume). لا حاجة لـ S3.

## الانتقال من نسخة Cloudflare
البيانات لا تنتقل تلقائياً. أعد رفع كل بيت من `studio` ← ⬇ تصدير ← `/admin` ← رفع.

## واجهة الخادم (ملخص)
| المسار | الوصف |
|---|---|
| `GET /api/a/<وكالة>[/<بيت>]` | كتالوج الوكالة أو بيت بعينه (فعّال فقط) |
| `GET /api/h/<رمز>` | بيت برمزه |
| `GET /img/<بيت>/<غرفة>` `/logo/<وكالة>` `/bg/<وكالة>` | الملفات (بعد فحص الحالة) |
| `/api/admin/*` | الإدارة، ترويسة `Authorization: Bearer ADMIN_TOKEN` |

## ملاحظات
- التغييرات (الإيقاف وغيره) تسري خلال `JSON_CACHE_SECONDS` (15 ثانية افتراضياً).
- لم تُختبر هذه النسخة بعد على استضافة حقيقية. جرّبها محلياً أولاً بـ Docker.
