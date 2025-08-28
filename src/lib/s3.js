const AWS = require('aws-sdk');
const { v4: uuid } = require('uuid');

const REGION = process.env.S3_REGION;
const BUCKET = process.env.S3_BUCKET;
const CDN_BASE = process.env.CDN_BASE; // optional

const s3 = new AWS.S3({
  region: REGION,
  accessKeyId: process.env.S3_ACCESS_KEY,
  secretAccessKey: process.env.S3_SECRET_KEY,
  signatureVersion: 'v4'
});

/**
 * Return a presigned PUT URL. Client uploads file directly to S3.
 * After upload, use returned publicUrl in message.media.url
 */
async function getPresignedPutUrl({ mime }) {
  const extGuess = mime?.split('/')?.[1] || 'bin';
  const key = `media/${uuid()}.${extGuess}`;
  const url = await s3.getSignedUrlPromise('putObject', {
    Bucket: BUCKET,
    Key: key,
    ContentType: mime || 'application/octet-stream',
    ACL: 'public-read', // dev convenience; for prod prefer private + CloudFront/OAC
    Expires: 300
  });

  const publicUrl = CDN_BASE
    ? `${CDN_BASE.replace(/\/$/, '')}/${key}`
    : `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;

  return { url, key, publicUrl };
}

module.exports = { getPresignedPutUrl };
