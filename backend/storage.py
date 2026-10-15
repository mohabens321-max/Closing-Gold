"""طبقة التخزين: Backblaze B2 / S3 متوافقة مع Vercel Serverless."""
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

        self.bucket = (bucket or '').strip()
        ep = (endpoint or '').strip()
        if ep and not ep.startswith(('http://', 'https://')):
            ep = 'https://' + ep

        reg = (region or 'us-east-005').strip()
        self.c = boto3.client(
            's3',
            endpoint_url=ep or None,
            aws_access_key_id=(key or '').strip(),
            aws_secret_access_key=(secret or '').strip(),
            region_name=reg,
            config=BC(signature_version='s3v4', retries={'max_attempts': 3})
        )

    def get(self, key):
        from botocore.exceptions import ClientError
        try:
            return self.c.get_object(Bucket=self.bucket, Key=key)['Body'].read()
        except ClientError as e:
            if e.response.get('Error', {}).get('Code') in ('NoSuchKey', '404'):
                return None
            log.error('S3 get ClientError: %s', e)
            raise e

    def put(self, key, data):
        self.c.put_object(Bucket=self.bucket, Key=key, Body=data)

    def delete(self, key):
        self.c.delete_object(Bucket=self.bucket, Key=key)

    def list(self, prefix):
        out = []
        paginator = self.c.get_paginator('list_objects_v2')
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for obj in page.get('Contents', []):
                out.append(obj['Key'])
        return out


class Store:
    def __init__(self, backend, ttl=5):
        self.b, self.ttl, self.c = backend, ttl, {}

    def get(self, key, cache=False):
        return self.b.get(key)

    def put(self, key, data, cache=False):
        self.b.put(key, data)

    def delete(self, key):
        self.b.delete(key)

    def getj(self, key, cache=False):
        v = self.get(key, cache)
        return json.loads(v) if v else None

    def putj(self, key, obj):
        self.put(key, json.dumps(obj, ensure_ascii=False).encode())

    def list(self, prefix):
        return self.b.list(prefix)


def make_store(cfg):
    if cfg.STORAGE == 's3' and cfg.S3_BUCKET:
        log.info('Initializing S3 Backend for bucket: %s', cfg.S3_BUCKET)
        return Store(S3Backend(cfg.S3_BUCKET, cfg.S3_ENDPOINT, cfg.S3_KEY, cfg.S3_SECRET, cfg.S3_REGION), cfg.CACHE_SECONDS)

    log.warning('Fallback to local /tmp storage (temporary on serverless)')
    return Store(FileBackend('/tmp/data'), cfg.CACHE_SECONDS)
