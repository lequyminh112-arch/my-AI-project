const { MongoClient, ObjectId } = require('mongodb');
const { pipeline, env } = require('@xenova/transformers');

// Cấu hình Transformers (chạy tại local)
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.allowWebOnly = false;

// Cấu hình MongoDB
const mongoUrl = 'mongodb://admin:your_password@localhost:27017';
const mongoClient = new MongoClient(mongoUrl);
const dbName = 'chatbot_db';

// ===== BƯỚC 1: Khởi tạo mô hình embedding =====
let embeddingPipeline = null;

async function initEmbeddingModel() {
    try {
        console.log('🔧 Khởi tạo mô hình embedding...');

        // Dùng mô hình Sentence Transformers lẹ + nhẹ
        embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

        console.log(' Mô hình embedding sẵn sàng\n');
    } catch (err) {
        console.error(' Lỗi khởi tạo mô hình:', err.message);
        throw err;
    }
}

// ===== BƯỚC 2: Tạo embedding cho text =====
async function generateEmbedding(text) {
    try {
        // Giới hạn độ dài text (tránh quá lâu)
        const limitedText = text.substring(0, 512);

        // Tạo embedding
        const result = await embeddingPipeline(limitedText, {
            pooling: 'mean',
            normalize: true
        });

        // Chuyển từ Tensor thành array
        const embedding = Array.from(result.data);

        return embedding;

    } catch (err) {
        console.error(' Lỗi tạo embedding:', err.message);
        throw err;
    }
}

// ===== BƯỚC 3: Lưu embedding vào MongoDB =====
async function saveEmbeddingToMongo(chunkId, embedding, content) {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const chunksCollection = db.collection('document_chunks');

        // Cập nhật chunk với embedding
        const result = await chunksCollection.updateOne(
            { _id: new ObjectId(chunkId) },
            {
                $set: {
                    embedding: embedding,
                    embedding_model: 'Xenova/all-MiniLM-L6-v2',
                    embedding_dim: embedding.length,
                    embedded_at: new Date()
                }
            }
        );

        return result.modifiedCount > 0;

    } catch (err) {
        console.error(' Lỗi lưu embedding:', err.message);
        throw err;
    } finally {
        await mongoClient.close();
    }
}

// ===== BƯỚC 4: Tạo embedding cho tất cả chunks =====
async function generateEmbeddingsForAllChunks(bookId = null) {
    try {
        console.log(' Lấy chunks từ MongoDB...');

        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const chunksCollection = db.collection('document_chunks');

        // Lọc chunks chưa có embedding
        let query = { embedding: { $exists: false } };
        if (bookId) {
            query.book_id = new ObjectId(bookId);
        }

        const chunks = await chunksCollection.find(query).toArray();

        if (chunks.length === 0) {
            console.log(' Không có chunks cần embedding\n');
            return;
        }

        console.log(`✓ Tìm thấy ${chunks.length} chunks cần embedding\n`);

        // Tạo embedding cho từng chunk
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            process.stdout.write(`\r Xử lý chunk ${i + 1}/${chunks.length}...`);

            try {
                // Tạo embedding
                const embedding = await generateEmbedding(chunk.content);

                // Lưu embedding vào MongoDB
                const chunksColl = db.collection('document_chunks');
                await chunksColl.updateOne(
                    { _id: chunk._id },
                    {
                        $set: {
                            embedding: embedding,
                            embedding_model: 'Xenova/all-MiniLM-L6-v2',
                            embedding_dim: embedding.length,
                            embedded_at: new Date()
                        }
                    }
                );

            } catch (err) {
                console.error(`\n Lỗi chunk ${i + 1}:`, err.message);
            }
        }

        console.log(`\n Hoàn thành! Tạo embedding cho ${chunks.length} chunks\n`);

    } catch (err) {
        console.error(' Lỗi:', err.message);
        throw err;
    } finally {
        await mongoClient.close();
    }
}

// ===== BƯỚC 5: Chương trình chính =====
async function main() {
    try {
        console.log(' Bắt đầu tạo embeddings\n');

        // Khởi tạo mô hình
        await initEmbeddingModel();

        // Lấy bookId từ command line (tùy chọn)
        const bookId = process.argv[2] || null;

        // Tạo embeddings
        await generateEmbeddingsForAllChunks(bookId);

        console.log(' Tất cả embeddings đã được tạo và lưu vào MongoDB!');

    } catch (err) {
        console.error(' Lỗi:', err);
        process.exit(1);
    }
}

main();
