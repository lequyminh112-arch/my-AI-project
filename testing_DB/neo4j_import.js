const neo4j = require('neo4j-driver');
const { MongoClient } = require('mongodb');

// ===== CẤU HÌNH =====
const neo4jUri = 'neo4j://localhost:7687';
const neo4jUser = 'neo4j';
const neo4jPassword = 'neo4j123';

const mongoUrl = 'mongodb://admin:your_password@localhost:27017';
const mongoClient = new MongoClient(mongoUrl);
const dbName = 'chatbot_db';

// ===== KẾT NỐI NEO4J =====
let driver;

async function initNeo4j() {
    try {
        driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
        console.log('✓ Kết nối Neo4j thành công');
        return driver;
    } catch (err) {
        console.error('❌ Lỗi kết nối Neo4j:', err.message);
        throw err;
    }
}

// ===== LẤY DỮ LIỆU TỪ MONGODB =====
async function getChunksFromMongo() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const chunksCollection = db.collection('document_chunks');

        // Lấy chunks có embedding
        const chunks = await chunksCollection
            .find({
                embedding: { $exists: true },
                chunk_index: { $exists: true },
                book_id: { $exists: true }
            })
            .toArray();

        console.log(`✓ Lấy ${chunks.length} valid chunks từ MongoDB`);
        return chunks;

    } catch (err) {
        console.error('❌ Lỗi lấy dữ liệu từ MongoDB:', err.message);
        throw err;
    } finally {
        await mongoClient.close();
    }
}

// ===== TẠO NODES CHO CHUNKS =====
async function createChunkNodes(chunks) {
    const session = driver.session();

    try {
        console.log('📝 Tạo nodes cho chunks...');

        for (const chunk of chunks) {
            const query = `
        CREATE (c:Chunk {
          id: $id,
          chunk_index: $chunk_index,
          content: $content,
          book_id: $book_id,
          minio_path: $minio_path,
          embedding_dim: $embedding_dim,
          created_at: datetime($created_at)
        })
        RETURN c
      `;

            const id = chunk._id ? chunk._id.toString() : null;
            const bookId = chunk.book_id ? chunk.book_id.toString() : null;
            const content = typeof chunk.content === 'string' ? chunk.content.substring(0, 1000) : '';
            const createdAt = chunk.created_at ? new Date(chunk.created_at).toISOString() : new Date().toISOString();

            if (!id || bookId === null) {
                console.warn(`⚠️ Bỏ qua chunk không hợp lệ: ${JSON.stringify({ _id: chunk._id, chunk_index: chunk.chunk_index })}`);
                continue;
            }

            const result = await session.run(query, {
                id,
                chunk_index: chunk.chunk_index,
                content,
                book_id: bookId,
                minio_path: chunk.minio_path || '',
                embedding_dim: chunk.embedding_dim || null,
                created_at: createdAt
            });

            console.log(`✓ Tạo node cho chunk ${chunk.chunk_index}`);
        }

        console.log(`✅ Đã tạo ${chunks.length} chunk nodes`);

    } catch (err) {
        console.error('❌ Lỗi tạo chunk nodes:', err.message);
        throw err;
    } finally {
        await session.close();
    }
}

// ===== TẠO RELATIONSHIPS DỰA TRÊN SIMILARITY =====
async function createSimilarityRelationships(chunks, threshold = 0.7) {
    const session = driver.session();

    try {
        console.log('🔗 Tạo relationships dựa trên similarity...');

        let relationshipCount = 0;

        // So sánh từng cặp chunks
        for (let i = 0; i < chunks.length; i++) {
            for (let j = i + 1; j < chunks.length; j++) {
                const chunkA = chunks[i];
                const chunkB = chunks[j];

                // Tính cosine similarity
                const similarity = cosineSimilarity(chunkA.embedding, chunkB.embedding);

                // Chỉ tạo relationship nếu similarity > threshold
                if (similarity > threshold) {
                    const query = `
            MATCH (a:Chunk {id: $idA}), (b:Chunk {id: $idB})
            CREATE (a)-[:SIMILAR_TO {similarity: $similarity}]->(b)
          `;

                    await session.run(query, {
                        idA: chunkA._id.toString(),
                        idB: chunkB._id.toString(),
                        similarity: similarity
                    });

                    relationshipCount++;
                    console.log(`✓ Tạo relationship: Chunk ${chunkA.chunk_index} ↔ Chunk ${chunkB.chunk_index} (${(similarity * 100).toFixed(1)}%)`);
                }
            }
        }

        console.log(`✅ Đã tạo ${relationshipCount} similarity relationships`);

    } catch (err) {
        console.error('❌ Lỗi tạo relationships:', err.message);
        throw err;
    } finally {
        await session.close();
    }
}

// ===== HÀM COSINE SIMILARITY =====
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

// ===== TẠO BOOK NODE =====
async function createBookNode() {
    const session = driver.session();

    try {
        console.log('📚 Tạo book node...');

        // Lấy thông tin book từ MongoDB
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const booksCollection = db.collection('books');

        const book = await booksCollection.findOne();

        if (book) {
            const query = `
        CREATE (b:Book {
          id: $id,
          title: $title,
          author: $author,
          total_pages: $total_pages,
          minio_path: $minio_path
        })
        RETURN b
      `;

            await session.run(query, {
                id: book._id.toString(),
                title: book.title,
                author: book.author,
                total_pages: book.total_pages,
                minio_path: book.minio_path || ''
            });

            console.log('✓ Tạo book node thành công');
        }

    } catch (err) {
        console.error('❌ Lỗi tạo book node:', err.message);
        throw err;
    } finally {
        await session.close();
        await mongoClient.close();
    }
}

// ===== TẠO RELATIONSHIPS BOOK ↔ CHUNKS =====
async function createBookChunkRelationships() {
    const session = driver.session();

    try {
        console.log('🔗 Tạo relationships Book ↔ Chunks...');

        const query = `
      MATCH (b:Book), (c:Chunk {book_id: b.id})
      CREATE (b)-[:CONTAINS]->(c)
    `;

        const result = await session.run(query);
        console.log(`✓ Tạo ${result.summary.counters.relationshipsCreated} relationships Book ↔ Chunks`);

    } catch (err) {
        console.error('❌ Lỗi tạo book-chunk relationships:', err.message);
        throw err;
    } finally {
        await session.close();
    }
}

// ===== CHƯƠNG TRÌNH CHÍNH =====
async function main() {
    try {
        console.log('🚀 Bắt đầu import dữ liệu sang Neo4j Knowledge Graph\n');

        // Khởi tạo Neo4j
        await initNeo4j();

        // Lấy dữ liệu từ MongoDB
        const chunks = await getChunksFromMongo();
        console.log('');

        // Tạo book node
        await createBookNode();
        console.log('');

        // Tạo chunk nodes
        await createChunkNodes(chunks);
        console.log('');

        // Tạo book-chunk relationships
        await createBookChunkRelationships();
        console.log('');

        // Tạo similarity relationships (có thể mất thời gian)
        console.log('⚠️  Tạo similarity relationships có thể mất thời gian...');
        await createSimilarityRelationships(chunks, 0.8); // threshold 0.8
        console.log('');

        console.log('✅ Hoàn thành import dữ liệu sang Neo4j!');
        console.log('🌐 Truy cập Neo4j Browser: http://localhost:7474');
        console.log('   Username: neo4j');
        console.log('   Password: neo4j123');

    } catch (err) {
        console.error('💥 Lỗi:', err);
    } finally {
        if (driver) {
            await driver.close();
        }
    }
}

main();
