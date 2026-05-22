const fs = require('fs');
const pdf = require('pdf-parse');
const { MongoClient } = require('mongodb');

// Cấu hình MongoDB (Lấy từ file docker-compose của bạn)
const url = 'mongodb://admin:your_password@localhost:27017';
const client = new MongoClient(url);
const dbName = 'chatbot_db';

async function run() {
    try {
        // 1. Đọc PDF
        const dataBuffer = fs.readFileSync('./SGK TIN 11 ICT KNTT (GOC).pdf');
        const data = await pdf(dataBuffer);

        // 2. Kết nối Mongo
        await client.connect();
        console.log("Đã kết nối MongoDB thành công!");
        const db = client.db(dbName);
        const collection = db.collection('books');

        // 3. Chuẩn bị dữ liệu để lưu (theo model của nhóm AI)
        const bookData = {
            title: "Tin học 11 - Định hướng ứng dụng",
            author: "Phạm Thế Long (Tổng Chủ biên)",
            total_pages: data.numpages,
            raw_text: data.text, // Lưu tạm toàn bộ text để kiểm tra
            created_at: new Date()
        };

        // 4. Lưu vào máy
        const result = await collection.insertOne(bookData);
        console.log(`Đã lưu sách vào MongoDB với ID: ${result.insertedId}`);

    } catch (err) {
        console.error("Lỗi rồi Minh ơi:", err);
    } finally {
        await client.close();
    }
}

run();