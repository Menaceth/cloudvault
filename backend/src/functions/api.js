const getUploadUrl = require('./getUploadUrl');
const listFiles = require('./listFiles');
const getDownloadUrl = require('./getDownloadUrl');
const deleteFile = require('./deleteFile');
const shareFile = require('./shareFile');

module.exports.handler = async (event) => {
  try {
    const path = event.requestContext?.http?.path || event.rawPath || '';
    const method = event.requestContext?.http?.method || event.requestContext?.httpMethod || '';
    
    if (path === '/ping') {
      return { statusCode: 200, body: 'pong!' };
    }
    
    // Lambda URL path mapping
    if (path === '/files/upload' && method === 'GET') {
      return await getUploadUrl.handler(event);
    } else if (path === '/files' && method === 'GET') {
      return await listFiles.handler(event);
    } else if (path.startsWith('/files/') && path.endsWith('/share') && method === 'GET') {
      const fileId = path.split('/')[2];
      event.pathParameters = { fileId };
      return await shareFile.handler(event);
    } else if (path.startsWith('/files/') && method === 'GET') {
      const fileId = path.split('/')[2];
      event.pathParameters = { fileId };
      return await getDownloadUrl.handler(event);
    } else if (path.startsWith('/files/') && method === 'DELETE') {
      const fileId = path.split('/')[2];
      event.pathParameters = { fileId };
      return await deleteFile.handler(event);
    }

    return { statusCode: 404, body: 'Not Found: ' + path };
  } catch (error) {
    console.error('API Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message, stack: error.stack })
    };
  }
};
