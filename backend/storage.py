"""طبقة التخزين: ملفات محلية أو أي خدمة متوافقة مع S3، مع ذاكرة مؤقتة قصيرة للقراءات."""
import json
import pathlib
import time


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
        p = self._p(key)
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_bytes(data)

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
        self.bucket = bucket
        self.c = boto3.client('s3', endpoint_url=endpoint or None, aws_access_key_id=key,
                              aws_secret_access_key=secret, region_name=region or 'auto',
                              config=BC(signature_version='s3v4', retries={'max_attempts': 3}))

    def get(self, key):
        from botocore.exceptions import ClientError
        try:
            return self.c.get_object(Bucket=self.bucket, Key=key)['Body'].read()
        except ClientError as e:
            if e.response['Error']['Code'] in ('NoSuchKey', '404'):
                return None
            raise

    def put(self, key, data):
        self.c.put_object(Bucket=self.bucket, Key=key, Body=data)

    def delete(self, key):
        self.c.delete_object(Bucket=self.bucket, Key=key)

    def list(self, prefix):
        out = []
        for page in self.c.get_paginator('list_objects_v2').paginate(Bucket=self.bucket, Prefix=prefix):
            out += [o['Key'] for o in page.get('Contents', [])]
        return out


class Store:
    """JSON ونصوص وملفات ثنائية. الصور لا تُخزَّن في الذاكرة المؤقتة أبداً."""

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
    # إذا كانت إعدادات S3 موجودة يستعمل S3، وإلا يرجع تلقائياً للتخزين المؤقت المحلي
    if cfg.STORAGE == 's3' and cfg.S3_BUCKET:
        backend = S3Backend(cfg.S3_BUCKET, cfg.S3_ENDPOINT, cfg.S3_KEY, cfg.S3_SECRET, cfg.S3_REGION)
    else:
        backend = FileBackend('/tmp/data')
    return Store(backend, cfg.CACHE_SECONDS)
