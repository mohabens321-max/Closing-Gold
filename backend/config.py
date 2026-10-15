"""إعدادات المشروع من متغيرات البيئة."""
import os


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
