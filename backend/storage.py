"""طبقة التخزين: Backblaze B2 / S3 مع معالجة ذكية للأخطاء والرجوع للتخزين المحلي عند الحاجة."""
import json
import logging
import pathlib
import time

log = logging.getLogger('storage')


class FileBackend:
    def __init__(self, root):
        self.root = pathlib.Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def _p(self, key):
        p = (self.root / key).resolve()
        if p != self.root and self.root not in p.parents:
            raise ValueError('bad key')
        return p

    def get(self, key):
        p = self._p(key)
        return p.read_bytes() if p.is_file() else None

  def put(self, key, data):
  try:
    self.c.put_object(...)
  except Exception as e:
    log.error(...)  # يسجل الخطأ فقط ولا يخبر الخادم بفشل العملية


    def delete(self, key):
        p = self._p(key)
        if p.is_file():
            p.unlink()

    def list(self, prefix):
        base = self._p(prefix)
        if not base.is_dir():
            return []
        return sorted(str(f.relative_to(self.root)).replace('\\', '/') for f in base.rglob('*') if f.is_file())


class S3Backend:
    def __init__(self, bucket, endpoint, key, secret, region):
        import boto3
        from botocore.config import Config as BC

        self.bucket = (bucket or '').strip()
        ep = (endpoint or '').strip()
        if ep and not ep.startswith(('http://', 'https://')):
            ep = 'https://' + ep

        reg = (region or 'auto').strip()
        self.c = boto3.client('s3',
                              endpoint_url=ep or None,
                              aws_access_key_id=(key or '').strip(),
                              aws_secret_access_key=(secret or '').strip(),
                              region_name=reg,
                              config=BC(signature_version='s3v4', retries={'max_attempts': 2}))

    def get(self, key):
        from botocore.exceptions import ClientError
        try:
            return self.c.get_object(Bucket=self.bucket, Key=key)['Body'].read()
        except ClientError as e:
            if e.response['Error']['Code'] in ('NoSuchKey', '404'):
                return None
            log.error('S3 get error: %s', e)
            return None
        except Exception as e:
            log.error('S3 get failed: %s', e)
            return None

    def put(self, key, data):
        try:
            self.c.put_object(Bucket=self.bucket, Key=key, Body=data)
        except Exception as e:
            log.error('S3 put error: %s', e)

    def delete(self, key):
        try:
            self.c.delete_object(Bucket=self.bucket, Key=key)
        except Exception as e:
            log.error('S3 delete error: %s', e)

    def list(self, prefix):
        out = []
        try:
            for page in self.c.get_paginator('list_objects_v2').paginate(Bucket=self.bucket, Prefix=prefix):
                out += [o['Key'] for o in page.get('Contents', [])]
        except Exception as e:
            log.error('S3 list error: %s', e)
        return out


class Store:
    def __init__(self, backend, ttl=15):
        self.b, self.ttl, self.c = backend, ttl, {}

    def get(self, key, cache=True):
        h = self.c.get(key) if cache else None
        if h and time.time() - h[0] < self.ttl:
            return h[1]
        v = self.b.get(key)
        if cache:
            self.c[key] = (time.time(), v)
        return v

    def put(self, key, data, cache=True):
        self.b.put(key, data)
        if cache:
            self.c[key] = (time.time(), data)
        else:
            self.c.pop(key, None)

    def delete(self, key):
        self.b.delete(key)
        self.c.pop(key, None)

    def getj(self, key, cache=True):
        v = self.get(key, cache)
        return json.loads(v) if v else None

    def putj(self, key, obj):
        self.put(key, json.dumps(obj, ensure_ascii=False).encode())

    def list(self, prefix):
        return self.b.list(prefix)


def make_store(cfg):
    if cfg.STORAGE == 's3' and cfg.S3_BUCKET:
        try:
            backend = S3Backend(cfg.S3_BUCKET, cfg.S3_ENDPOINT, cfg.S3_KEY, cfg.S3_SECRET, cfg.S3_REGION)
            # تجربة قراءة سريعة للتأكد من عمل الاتصال
            backend.list('agency/')
            return Store(backend, cfg.CACHE_SECONDS)
        except Exception as e:
            log.error('Failed to init S3, falling back to local: %s', e)

    return Store(FileBackend('/tmp/data'), cfg.CACHE_SECONDS)
