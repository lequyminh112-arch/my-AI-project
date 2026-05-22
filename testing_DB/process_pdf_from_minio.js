const Minio = require('minio');
const pdf = require('pdf-parse');
const { MongoClient } = require('mongodb');

// ===== BƯỚC 1: Cấu hình MinIO =====
const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin123'
});

// ===== BƯỚC 2: Cấu hình MongoDB =====
const mongoUrl = 'mongodb://admin:your_password@localhost:27017';
const mongoClient = new MongoClient(mongoUrl);
const dbName = 'chatbot_db';
const collectionName = 'books';

// ===== BƯỚC 3: Cấu hình thông tin file PDF =====
const bucketName = 'pdf-resources';
const objectName = 'SGK_TIN11.pdf';
const bookTitle = 'Tin học 11 - Định hướng ứng dụng';
const bookAuthor = 'Phạm Thế Long';

// ===== BƯỚC 4: Hàm đọc file từ MinIO =====
async function readPdfFromMinio() {
  try {
    console.log(`📥 Đang đọc file từ MinIO: ${bucketName}/${objectName}`);
    
    // Dùng getObject để lấy stream
    const stream = await minioClient.getObject(bucketName, objectName);
    
    // Chuyển stream thành buffer
    let chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log(`✓ Đã đọc file thành công (${buffer.length} bytes)`);
    return buffer;
    
  } catch (err) {
    console.error('❌ Lỗi đọc file từ MinIO:', err.message);
    throw err;
  }
}

// ===== BƯỚC 5: Hàm xử lý PDF (pdf-parse) =====
async function processPdf(pdfBuffer) {
  try {
    console.log('📄 Đang xử lý PDF...');
    
    const data = await pdf(pdfBuffer);
    
    console.log(`✓ Xử lý PDF thành công`);
    console.log(`  - Số trang: ${data.numpages}`);
    console.log(`  - Độ dài nội dung: ${data.text.length} ký tự`);
    
    return data;
    
  } catch (err) {
    console.error('❌ Lỗi xử lý PDF:', err.message);
    throw err;
  }
}

// ===== BƯỚC 6: Hàm lưu metadata vào MongoDB =====
async function saveMetadataToMongo(pdfData) {
  try {
    console.log('💾 Đang lưu metadata vào MongoDB...');
    
    await mongoClient.connect();
    const db = mongoClient.db(dbName);
    const collection = db.collection(collectionName);
    
    const bookData = {
      title: bookTitle,
      author: bookAuthor,
      total_pages: pdfData.numpages,
      // ===== TRỌNG ĐIỂM: Lưu đường dẫn MinIO thay vì toàn bộ file PDF =====
      minio_bucket: bucketName,
      minio_object: objectName,
      minio_path: `s3://${bucketName}/${objectName}`,
      // Có thể lưu tạm tất cả text để demo, nhưng thực tế nên tách ra chunk
      raw_text: pdfData.text,
      uploaded_at: new Date(),
      status: 'uploaded'
    };
    
    const result = await collection.insertOne(bookData);
    
    console.log(`✓ Đã lưu metadata với ID: ${result.insertedId}`);
    console.log(`  - MinIO Path: ${bookData.minio_path}`);
    
    return result.insertedId;
    
  } catch (err) {
    console.error('❌ Lỗi lưu vào MongoDB:', err.message);
    throw err;
  } finally {
    await mongoClient.close();
  }
}

// ===== BƯỚC 7: Chương trình chính =====
async function main() {
  try {
    console.log('🚀 Bắt đầu pipeline xử lý PDF từ MinIO\n');
    
    // Bước 1: Đọc PDF từ MinIO
    const pdfBuffer = await readPdfFromMinio();
    console.log('');
    
    // Bước 2: Xử lý PDF
    const pdfData = await processPdf(pdfBuffer);
    console.log('');
    
    // Bước 3: Lưu metadata vào MongoDB
    const bookId = await saveMetadataToMongo(pdfData);
    console.log('');
    
    console.log('✅ Hoàn thành! Pipeline xử lý PDF thành công.');
    console.log(`   Book ID: ${bookId}`);
    
  } catch (err) {
    console.error('💥 Lỗi trong pipeline:', err);
    process.exit(1);
  }
}

main();
