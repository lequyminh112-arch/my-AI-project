const { MongoClient } = require('mongodb');
const { pipeline, env } = require('@xenova/transformers');

// Cấu hình
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.allowWebOnly = false;

const mongoUrl = 'mongodb://admin:your_password@localhost:27017';
const mongoClient = new MongoClient(mongoUrl);
const dbName = 'chatbot_db';

let embeddingPipeline = null;

// ===== BƯỚC 1: Khởi tạo mô hình =====
async function initEmbeddingModel() {
    try {
        if (!embeddingPipeline) {
            embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }
        return embeddingPipeline;
    } catch (err) {
        console.error(' Lỗi khởi tạo mô hình:', err.message);
        throw err;
    }
}

// ===== BƯỚC 2: Tạo embedding cho query =====
async function generateQueryEmbedding(query) {
    try {
        const pipeline = await initEmbeddingModel();

        const limitedQuery = query.substring(0, 512);
        const result = await pipeline(limitedQuery, {
            pooling: 'mean',
            normalize: true
        });

        return Array.from(result.data);

    } catch (err) {
        console.error(' Lỗi tạo embedding query:', err.message);
        throw err;
    }
}

// ===== BƯỚC 3: Hàm cosine similarity =====
function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        magnitudeA += vecA[i] * vecA[i];
        magnitudeB += vecB[i] * vecB[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) return 0;

    return dotProduct / (magnitudeA * magnitudeB);
}

// ===== BƯỚC 4: Vector Search =====
async function vectorSearch(query, topK = 5) {
    try {
        console.log(`\n Tìm kiếm: "${query}"`);
        console.log(` Lấy top ${topK} kết quả\n`);

        // Tạo embedding cho query
        const queryEmbedding = await generateQueryEmbedding(query);
        console.log(`✓ Embedding query: [${queryEmbedding.slice(0, 3).map(x => x.toFixed(3)).join(', ')}...]`);

        // Lấy tất cả chunks có embedding
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const chunksCollection = db.collection('document_chunks');

        const chunks = await chunksCollection
            .find({ embedding: { $exists: true } })
            .toArray();

        if (chunks.length === 0) {
            console.log('  Không tìm thấy chunks có embedding');
            return [];
        }

        console.log(` Tìm thấy ${chunks.length} chunks\n`);

        // Tính similarity cho từng chunk
        const results = chunks.map(chunk => ({
            _id: chunk._id,
            book_id: chunk.book_id,
            chunk_index: chunk.chunk_index,
            content: chunk.content.substring(0, 200) + '...',
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // Sắp xếp theo similarity
        results.sort((a, b) => b.similarity - a.similarity);

        // Lấy top K
        const topResults = results.slice(0, topK);

        console.log(' Kết quả tìm kiếm:\n');
        topResults.forEach((result, idx) => {
            console.log(`${idx + 1}. Similarity: ${(result.similarity * 100).toFixed(2)}%`);
            console.log(`   Chunk #${result.chunk_index}`);
            console.log(`   Nội dung: ${result.content}`);
            console.log('');
        });

        return topResults;

    } catch (err) {
        console.error(' Lỗi tìm kiếm:', err.message);
        throw err;
    } finally {
        await mongoClient.close();
    }
}

// ===== BƯỚC 5: API tìm kiếm =====
async function searchFromQuery(query) {
    try {
        const topK = 5;
        const results = await vectorSearch(query, topK);
        return results;
    } catch (err) {
        console.error('Lỗi:', err);
        process.exit(1);
    }
}

// ===== Main =====
async function main() {
    const query = process.argv.slice(2).join(' ') || 'Máy tính';

    console.log(' Bắt đầu Vector Search\n');
    await searchFromQuery(query);
    console.log(' Tìm kiếm hoàn thành!');
}

main();
