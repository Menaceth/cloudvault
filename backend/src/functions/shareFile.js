const { GetObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3Client } = require("../utils/aws-clients");

module.exports.handler = async (event) => {
  try {
    const userId = event.headers?.authorization || event.headers?.Authorization || 'anonymous';
    const { fileId } = event.pathParameters;
    const { expiresInHours } = event.queryStringParameters || {};
    let hours = parseInt(expiresInHours) || 24;
    if (hours > 168) hours = 168;

    const data = await s3Client.send(new ListObjectsV2Command({
      Bucket: process.env.FILE_BUCKET,
      Prefix: `${userId}/${fileId}-`
    }));

    if (!data.Contents || data.Contents.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "File not found" }) };
    }

    const s3Key = data.Contents[0].Key;
    const fileName = decodeURIComponent(s3Key.replace(`${userId}/${fileId}-`, ''));

    const command = new GetObjectCommand({
      Bucket: process.env.FILE_BUCKET,
      Key: s3Key,
      ResponseContentDisposition: `attachment; filename="${fileName}"`
    });
    const shareUrl = await getSignedUrl(s3Client, command, { expiresIn: hours * 3600 });

    return {
      statusCode: 200,
      body: JSON.stringify({ shareUrl, expiresInHours: hours }),
    };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
