const { MongoClient } = require('mongodb');
const { spawn } = require('child_process');

const mongoUrl = 'mongodb://admin:your_password@localhost:27017';
const mongoClient = new MongoClient(mongoUrl);

async function main() {
    try {
        console.log(' Lấy book_id từ MongoDB...\n');

        await mongoClient.connect();
        const db = mongoClient.db('chatbot_db');
        const booksCollection = db.collection('books');

        // Lấy sách gần nhất được upload
        const latestBook = await booksCollection.findOne({}, { sort: { uploaded_at: -1 } });

        if (!latestBook) {
            console.error(' Không tìm thấy sách nào trong MongoDB');
            process.exit(1);
        }

        console.log(` Tìm thấy sách: ${latestBook.title}`);
        console.log(`  ID: ${latestBook._id}`);
        console.log(`  MinIO Path: ${latestBook.minio_path}\n`);

        await mongoClient.close();

        // Chạy chunking
        console.log(' Bắt đầu chunking...\n');
        const child = spawn('node', ['chunk_pdf_from_minio.js', latestBook._id.toString()]);

        child.stdout.on('data', (data) => {
            process.stdout.write(data);
        });

        child.stderr.on('data', (data) => {
            process.stderr.write(data);
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log('\n Toàn bộ pipeline hoàn thành!');
            } else {
                console.error(`\n Lỗi (exit code: ${code})`);
            }
            process.exit(code);
        });

    } catch (err) {
        console.error(' Lỗi:', err);
        process.exit(1);
    }
}

main();
