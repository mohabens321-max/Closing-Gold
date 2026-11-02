"""إعدادات المشروع من متغيرات البيئة."""
import os

# كلمة السر الافتراضية للوحة التحكم. تُستعمل فقط إذا لم يُعيَّن أي متغير بيئة،
# حتى لا تبقى اللوحة مقفولة نهائياً إذا نُسي الإعداد.
DEFAULT_ADMIN_TOKEN = 'Mohabens_123'

# أسماء متغيرات البيئة المقبولة، بالترتيب.
TOKEN_ENV = ('ADMIN_TOKEN', 'ADMIN_PASSWORD', 'ADMIN_PASS', 'ADMIN_KEY')


def _clean(value):
    """ينظّف القيمة: مسافات زائدة، أسطر، علامات تنصيص لصقها المستخدم."""
    return (value or '').strip().strip('"').strip("'").strip()


def admin_token():
    """الرمز السري الحالي، يُقرأ عند كل طلب حتى تُطبَّق تغييرات البيئة."""
    for name in TOKEN_ENV:
        value = _clean(os.getenv(name))
        if value:
            return value
    return ''


def admin_token_env():
    """اسم متغير البيئة المستعمل، أو '' إذا كنا على القيمة الافتراضية."""
    for name in TOKEN_ENV:
        if _clean(os.getenv(name)):
            return name
    return ''


class Config:
    ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', '')
    STORAGE = os.getenv('STORAGE', 'fs')            # fs = ملفات محلية | s3 = خدمة متوافقة مع S3
    DATA_DIR = os.getenv('DATA_DIR', 'data')
    S3_BUCKET = os.getenv('S3_BUCKET', '')
    S3_ENDPOINT = os.getenv('S3_ENDPOINT', '')
    S3_KEY = os.getenv('S3_KEY', '')
    S3_SECRET = os.getenv('S3_SECRET', '')
    S3_REGION = os.getenv('S3_REGION', 'auto')
    MAX_UPLOAD_MB = int(os.getenv('MAX_UPLOAD_MB', '24'))   # على Vercel استعمل 4
    CACHE_SECONDS = int(os.getenv('JSON_CACHE_SECONDS', '15'))
