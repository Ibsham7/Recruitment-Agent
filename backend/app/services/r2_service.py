import os
import uuid
from typing import Dict, Optional, List
from urllib.parse import urlparse
import boto3
from botocore.config import Config
from app.core.logging import logger

def get_r2_client():
    account_id = os.getenv("R2_ACCOUNT_ID")
    access_key = os.getenv("R2_ACCESS_KEY_ID")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY")

    if not all([account_id, access_key, secret_key]):
        raise ValueError("Missing Cloudflare R2 credentials in environment variables (R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY).")

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
        region_name="auto"
    )

def ensure_r2_bucket_cors(bucket_name: Optional[str] = None) -> bool:
    """
    Configures bucket CORS rules on Cloudflare R2 to allow direct browser uploads from frontend origins.
    """
    try:
        s3_client = get_r2_client()
        target_bucket = bucket_name or os.getenv("R2_BUCKET_NAME", "recruitment-cvs")
        cors_config = {
            'CORSRules': [
                {
                    'AllowedHeaders': ['*'],
                    'AllowedMethods': ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
                    'AllowedOrigins': ['*'],
                    'ExposeHeaders': ['ETag'],
                    'MaxAgeSeconds': 3600
                }
            ]
        }
        s3_client.put_bucket_cors(Bucket=target_bucket, CORSConfiguration=cors_config)
        logger.info(f"[R2 Service] Successfully verified and applied CORS rules on bucket '{target_bucket}'.")
        return True
    except Exception as e:
        logger.warning(f"[R2 Service] Could not apply CORS rules to R2 bucket: {e}")
        return False

def generate_presigned_upload_url(
    filename: str, 
    content_type: str = "application/pdf", 
    campaign_id: Optional[str] = None
) -> Dict[str, str]:
    """
    Generates a secure presigned PUT URL for direct browser uploads to Cloudflare R2.
    If campaign_id is provided, stores under campaigns/{campaign_id}/ prefix.
    """
    s3_client = get_r2_client()
    
    bucket_name = os.getenv("R2_BUCKET_NAME", "recruitment-cvs")
    public_base_url = os.getenv("R2_PUBLIC_URL", "").rstrip("/")

    if not public_base_url:
        raise ValueError("Missing R2_PUBLIC_URL environment variable.")

    clean_name = filename.replace(" ", "_")
    file_id = str(uuid.uuid4())
    
    if campaign_id and campaign_id.strip():
        clean_campaign_id = campaign_id.strip()
        object_key = f"campaigns/{clean_campaign_id}/{file_id}_{clean_name}"
    else:
        object_key = f"resumes/{file_id}_{clean_name}"

    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket_name,
            "Key": object_key,
            "ContentType": content_type
        },
        ExpiresIn=3600  # 1 hour expiry
    )

    public_url = f"{public_base_url}/{object_key}"
    
    logger.info(f"[R2 Service] Presigned PUT URL generated for '{filename}' -> key '{object_key}'")
    return {
        "uploadUrl": presigned_url,
        "fileUrl": public_url,
        "objectKey": object_key
    }

def generate_presigned_payment_screenshot_url(
    user_id: str,
    filename: str,
    content_type: str = "image/png"
) -> Dict[str, str]:
    """
    Generates a secure presigned PUT URL strictly scoped under payment-screenshots/{user_id}/
    for proof-of-payment image uploads to Cloudflare R2.
    """
    if not user_id or not isinstance(user_id, str):
        raise ValueError("Valid user_id is required for payment screenshot upload URL.")

    s3_client = get_r2_client()
    bucket_name = os.getenv("R2_BUCKET_NAME", "recruitment-cvs")
    public_base_url = os.getenv("R2_PUBLIC_URL", "").rstrip("/")

    if not public_base_url:
        raise ValueError("Missing R2_PUBLIC_URL environment variable.")

    clean_name = filename.replace(" ", "_").strip() or "payment_screenshot.png"
    file_id = str(uuid.uuid4())
    clean_user_id = user_id.strip()
    object_key = f"payment-screenshots/{clean_user_id}/{file_id}_{clean_name}"

    presigned_url = s3_client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": bucket_name,
            "Key": object_key,
            "ContentType": content_type or "image/png"
        },
        ExpiresIn=3600  # 1 hour expiry
    )

    public_url = f"{public_base_url}/{object_key}"

    logger.info(f"[R2 Service] Presigned payment screenshot PUT URL generated for user '{clean_user_id}' -> key '{object_key}'")
    return {
        "uploadUrl": presigned_url,
        "fileUrl": public_url,
        "objectKey": object_key
    }

def extract_object_key_from_url(file_url: str) -> Optional[str]:
    """Extracts object key from a full public R2 URL."""
    if not file_url or not isinstance(file_url, str):
        return None
    public_base_url = os.getenv("R2_PUBLIC_URL", "").rstrip("/")
    if public_base_url and file_url.startswith(public_base_url):
        return file_url[len(public_base_url):].lstrip("/")
    
    # Fallback to URL path extraction
    parsed = urlparse(file_url)
    return parsed.path.lstrip("/")

def delete_r2_object_by_url(file_url: str) -> bool:
    """Deletes a single object from Cloudflare R2 given its public URL."""
    object_key = extract_object_key_from_url(file_url)
    if not object_key:
        logger.warning(f"[R2 Service] Could not extract object key from URL: '{file_url}'")
        return False
        
    try:
        s3_client = get_r2_client()
        bucket_name = os.getenv("R2_BUCKET_NAME", "recruitment-cvs")
        s3_client.delete_object(Bucket=bucket_name, Key=object_key)
        logger.info(f"[R2 Service] Deleted object '{object_key}' from R2 bucket")
        return True
    except Exception as e:
        logger.error(f"[R2 Service] Failed to delete object '{object_key}' from R2: {e}")
        return False

def delete_r2_campaign_folder(campaign_id: str) -> int:
    """
    Deletes all objects under campaigns/{campaign_id}/ prefix from Cloudflare R2 bucket.
    Returns total count of deleted objects.
    """
    if not campaign_id or not isinstance(campaign_id, str):
        return 0
        
    prefix = f"campaigns/{campaign_id.strip()}/"
    bucket_name = os.getenv("R2_BUCKET_NAME", "recruitment-cvs")
    
    try:
        s3_client = get_r2_client()
        paginator = s3_client.get_paginator('list_objects_v2')
        deleted_total = 0
        
        for page in paginator.paginate(Bucket=bucket_name, Prefix=prefix):
            contents = page.get('Contents', [])
            if not contents:
                continue
                
            delete_keys = [{'Key': obj['Key']} for obj in contents]
            s3_client.delete_objects(
                Bucket=bucket_name,
                Delete={'Objects': delete_keys}
            )
            deleted_total += len(delete_keys)
            
        logger.info(f"[R2 Service] Deleted {deleted_total} files from R2 campaign folder '{prefix}'")
        return deleted_total
    except Exception as e:
        logger.error(f"[R2 Service] Failed to delete R2 campaign folder '{prefix}': {e}")
        return 0
