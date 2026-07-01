"""Cloudflare R2 storage (S3-compatible via boto3).
Falls back to local disk when R2 is not configured so dev works without credentials."""
import io
import logging
import os
import tempfile

import boto3
from botocore.config import Config

from src.core.config import settings

logger = logging.getLogger(__name__)

PRESIGNED_URL_EXPIRY = 3600


def _r2_configured() -> bool:
    return bool(settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key)


def _client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_file(local_path: str, object_key: str, content_type: str = "application/octet-stream") -> str:
    if not _r2_configured():
        logger.warning("R2 not configured -- skipping upload, using local path")
        return local_path
    _client().upload_file(local_path, settings.r2_bucket_name, object_key, ExtraArgs={"ContentType": content_type})
    return object_key


def upload_bytes(data: bytes, object_key: str, content_type: str = "application/octet-stream") -> str:
    if not _r2_configured():
        raise RuntimeError("R2 not configured")
    _client().put_object(Bucket=settings.r2_bucket_name, Key=object_key, Body=data, ContentType=content_type)
    return object_key


def download_to_temp(object_key: str, suffix: str = "") -> str:
    """Download R2 object to a temp file. Returns temp path — caller must delete it."""
    if not _r2_configured():
        return object_key  # dev: key is already a local path
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    tmp.close()
    _client().download_file(settings.r2_bucket_name, object_key, tmp.name)
    return tmp.name


def download_bytes(object_key: str) -> bytes:
    if not _r2_configured():
        with open(object_key, "rb") as f:
            return f.read()
    buf = io.BytesIO()
    _client().download_fileobj(settings.r2_bucket_name, object_key, buf)
    return buf.getvalue()


def presigned_download_url(object_key: str, filename: str = "", expiry: int = PRESIGNED_URL_EXPIRY) -> str:
    if not _r2_configured():
        return f"/dev-local/{object_key}"
    params: dict = {"Bucket": settings.r2_bucket_name, "Key": object_key}
    if filename:
        params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
    return _client().generate_presigned_url("get_object", Params=params, ExpiresIn=expiry)


def delete_object(object_key: str) -> None:
    if not _r2_configured():
        try:
            os.remove(object_key)
        except FileNotFoundError:
            pass
        return
    _client().delete_object(Bucket=settings.r2_bucket_name, Key=object_key)


def delete_prefix(prefix: str) -> None:
    if not _r2_configured():
        return
    client = _client()
    paginator = client.get_paginator("list_objects_v2")
    for page in paginator.paginate(Bucket=settings.r2_bucket_name, Prefix=prefix):
        objects = [{"Key": obj["Key"]} for obj in page.get("Contents", [])]
        if objects:
            client.delete_objects(Bucket=settings.r2_bucket_name, Delete={"Objects": objects})
