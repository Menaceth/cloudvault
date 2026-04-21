const { PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3Client } = require("../utils/aws-clients");
const crypto = require("crypto");

module.exports.handler = async (event) => {
  try {
    const userId = event.headers?.authorization || event.headers?.Authorization || 'anonymous';
    const { fileName, fileType } = event.queryStringParameters || {};

    if (!fileName || !fileType) {
      return { statusCode: 400, body: JSON.stringify({ error: "fileName and fileType are required" }) };
    }

    const fileId = crypto.randomUUID();
    const safeFileName = encodeURIComponent(fileName);
    const s3Key = `${userId}/${fileId}-${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.FILE_BUCKET,
      Key: s3Key,
      ContentType: fileType,
    });
    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return {
      statusCode: 200,
      body: JSON.stringify({ uploadUrl, fileId, s3Key }),
    };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
