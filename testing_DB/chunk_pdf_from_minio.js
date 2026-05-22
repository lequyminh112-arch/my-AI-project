const Minio = require('minio');
const pdf = require('pdf-parse');
const { MongoClient } = require('mongodb');

const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin123'
});

const mongoUrl = 'mongodb://admin:your_password@localhost:27017';
const mongoClient = new MongoClient(mongoUrl);
const dbName = 'chatbot_db';

// ===== BƯỚC 1: Lấy file từ MinIO theo minio_path =====
async function getPdfFromMinio(bucketName, objectName) {
  try {
    console.log(` Lấy file từ MinIO: ${bucketName}/${objectName}`);
    
    const stream = await minioClient.getObject(bucketName, objectName);
    let chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log(` Lấy file thành công (${buffer.length} bytes)`);
    return buffer;
    
  } catch (err) {
    console.error(' Lỗi lấy file từ MinIO:', err.message);
    throw err;
  }
}

// ===== BƯỚC 2: Xử lý PDF thành chunks =====
async function chunkPdfText(pdfData, chunkSize = 500) {
  try {
    console.log(` Chia PDF thành chunks (kích thước: ${chunkSize} ký tự)...`);
    
    const text = pdfData.text;
    const chunks = [];
    
    // Chia text thành chunks
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.substring(i, i + chunkSize);
      chunks.push({
        chunk_index: chunks.length,
        content: chunk,
        start_pos: i,
        end_pos: Math.min(i + chunkSize, text.length),
        length: chunk.length
      });
    }
    
    console.log(`✓ Chia thành ${chunks.length} chunks`);
    return chunks;
    
  } catch (err) {
    console.error(' Lỗi chia chunk:', err.message);
    throw err;
  }
}

// ===== BƯỚC 3: Lưu chunks vào MongoDB =====
async function saveChunksToMongo(bookId, chunks, minioPath) {
  try {
    console.log(' Lưu chunks vào MongoDB...');
    
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const chunksCollection = db.collection('document_chunks');
    
    // Chuẩn bị dữ liệu chunks với reference tới file gốc
    const chunkDocuments = chunks.map(chunk => ({
      book_id: bookId,
      minio_path: minioPath, // Reference tới file gốc
      ...chunk,
      created_at: new Date()
    }));
    
    const result = await chunksCollection.insertMany(chunkDocuments);
    
    console.log(`✓ Lưu ${result.insertedIds.length} chunks vào MongoDB`);
    return result.insertedIds;
    
  } catch (err) {
    console.error(' Lỗi lưu chunks:', err.message);
    throw err;
  } finally {
    await mongoClient.close();
  }
}

// ===== BƯỚC 4: Chương trình chính =====
async function main() {
  try {
    console.log(' Bắt đầu chunking PDF từ MinIO\n');
    
    // Giả sử book_id = '66403f...' từ bước trước
    const bookId = process.argv[2] || '66403f9f1234567890abcdef'; // Truyền từ CLI
    const bucketName = 'pdf-resources';
    const objectName = 'SGK_TIN11.pdf';
    const minioPath = `s3://${bucketName}/${objectName}`;
    
    // Bước 1: Lấy PDF từ MinIO
    const pdfBuffer = await getPdfFromMinio(bucketName, objectName);
    
    // Bước 2: Parse PDF
    console.log(' Parsing PDF...');
    const pdfData = await pdf(pdfBuffer);
    console.log(`✓ PDF có ${pdfData.numpages} trang`);
    console.log('');
    
    // Bước 3: Chia thành chunks
    const chunks = await chunkPdfText(pdfData, 500);
    console.log('');
    
    // Bước 4: Lưu vào MongoDB
    await saveChunksToMongo(bookId, chunks, minioPath);
    console.log('');
    
    console.log(' Hoàn thành chunking!');
    
  } catch (err) {
    console.error(' Lỗi:', err);
    process.exit(1);
  }
}

main();
