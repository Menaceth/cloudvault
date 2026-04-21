const { DeleteObjectCommand, ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { s3Client } = require("../utils/aws-clients");

module.exports.handler = async (event) => {
  try {
    const userId = event.headers?.authorization || event.headers?.Authorization || 'anonymous';
    const { fileId } = event.pathParameters;

    const data = await s3Client.send(new ListObjectsV2Command({
      Bucket: process.env.FILE_BUCKET,
      Prefix: `${userId}/${fileId}-`
    }));

    if (!data.Contents || data.Contents.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "File not found" }) };
    }

    const s3Key = data.Contents[0].Key;

    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.FILE_BUCKET,
      Key: s3Key,
    }));

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "File deleted successfully" }),
    };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
