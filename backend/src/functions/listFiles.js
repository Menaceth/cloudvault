const { ListObjectsV2Command } = require("@aws-sdk/client-s3");
const { s3Client } = require("../utils/aws-clients");

module.exports.handler = async (event) => {
  try {
    const userId = event.headers?.authorization || event.headers?.Authorization || 'anonymous';

    const data = await s3Client.send(new ListObjectsV2Command({
      Bucket: process.env.FILE_BUCKET,
      Prefix: `${userId}/`
    }));

    const files = (data.Contents || []).map(obj => {
      const keyWithoutPrefix = obj.Key.replace(`${userId}/`, '');
      const dashIndex = keyWithoutPrefix.indexOf('-');
      const fileId = keyWithoutPrefix.substring(0, dashIndex);
      const fileName = decodeURIComponent(keyWithoutPrefix.substring(dashIndex + 1));
      return {
        fileId,
        fileName,
        fileSize: obj.Size,
        uploadDate: obj.LastModified,
        s3Key: obj.Key
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ files }),
    };
  } catch (error) {
    console.error("Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};
