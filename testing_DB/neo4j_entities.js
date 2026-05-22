const neo4j = require('neo4j-driver');
const { MongoClient } = require('mongodb');

// ===== CẤU HÌNH =====
const neo4jUri = 'neo4j://localhost:7687';
const neo4jUser = 'neo4j';
const neo4jPassword = 'neo4j123';

const mongoUrl = 'mongodb://admin:your_password@localhost:27017';
const mongoClient = new MongoClient(mongoUrl);
const dbName = 'chatbot_db';

let driver;

// ===== KẾT NỐI =====
async function initNeo4j() {
    driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
    return driver;
}

// ===== EXTRACT ENTITIES TỪ TEXT =====
function extractEntities(text) {
    const entities = {
        concepts: [],
        keywords: []
    };

    // Simple entity extraction (có thể nâng cấp với NLP library)
    const textLower = text.toLowerCase();

    // Extract concepts (có thể là tên chương, thuật ngữ kỹ thuật)
    const conceptPatterns = [
        /chương\s+\d+/gi,
        /bài\s+\d+/gi,
        /phần\s+\d+/gi,
        /máy tính/gi,
        /phần mềm/gi,
        /ứng dụng/gi,
        /công nghệ/gi,
        /thông tin/gi,
        /hệ thống/gi,
        /dữ liệu/gi,
        /mạng/gi,
        /internet/gi
    ];

    conceptPatterns.forEach(pattern => {
        const matches = textLower.match(pattern);
        if (matches) {
            entities.concepts.push(...matches);
        }
    });

    // Extract keywords (từ quan trọng)
    const keywordPatterns = [
        /\b[a-zàáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệđìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ]+\b/gi
    ];

    keywordPatterns.forEach(pattern => {
        const matches = text.match(pattern);
        if (matches) {
            // Lọc keywords dài hơn 3 ký tự
            const filtered = matches.filter(word => word.length > 3);
            entities.keywords.push(...filtered.slice(0, 10)); // Giới hạn 10 keywords
        }
    });

    // Unique values
    entities.concepts = [...new Set(entities.concepts)];
    entities.keywords = [...new Set(entities.keywords)];

    return entities;
}

// ===== TẠO ENTITY NODES =====
async function createEntityNodes() {
    const session = driver.session();

    try {
        console.log('🏷️  Tạo entity nodes...\n');

        // Lấy chunks từ MongoDB
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const chunksCollection = db.collection('document_chunks');

        const chunks = await chunksCollection.find({}).toArray();

        let entityCount = 0;

        for (const chunk of chunks) {
            const entities = extractEntities(chunk.content);

            // Tạo Concept nodes
            for (const concept of entities.concepts) {
                try {
                    const query = `
            MERGE (c:Concept {name: $name})
            ON CREATE SET c.created_at = datetime()
            RETURN c
          `;

                    await session.run(query, { name: concept });
                    entityCount++;
                } catch (err) {
                    // Ignore duplicate errors
                }
            }

            // Tạo Keyword nodes
            for (const keyword of entities.keywords) {
                try {
                    const query = `
            MERGE (k:Keyword {name: $name})
            ON CREATE SET k.created_at = datetime()
            RETURN k
          `;

                    await session.run(query, { name: keyword });
                    entityCount++;
                } catch (err) {
                    // Ignore duplicate errors
                }
            }

            console.log(`✓ Xử lý chunk ${chunk.chunk_index}: ${entities.concepts.length} concepts, ${entities.keywords.length} keywords`);
        }

        console.log(`\n✅ Đã tạo ${entityCount} entity nodes`);

    } catch (err) {
        console.error('❌ Lỗi tạo entity nodes:', err.message);
        throw err;
    } finally {
        await session.close();
        await mongoClient.close();
    }
}

// ===== TẠO RELATIONSHIPS CHUNK ↔ ENTITIES =====
async function createChunkEntityRelationships() {
    const session = driver.session();

    try {
        console.log('🔗 Tạo relationships Chunk ↔ Entities...\n');

        // Lấy chunks từ MongoDB
        await mongoClient.connect();
        const db = mongoClient.db(dbName);
        const chunksCollection = db.collection('document_chunks');

        const chunks = await chunksCollection.find({}).toArray();

        let relationshipCount = 0;

        for (const chunk of chunks) {
            const entities = extractEntities(chunk.content);

            // Link với concepts
            for (const concept of entities.concepts) {
                const query = `
          MATCH (c:Chunk {id: $chunkId}), (con:Concept {name: $conceptName})
          MERGE (c)-[:MENTIONS_CONCEPT]->(con)
        `;

                await session.run(query, {
                    chunkId: chunk._id.toString(),
                    conceptName: concept
                });

                relationshipCount++;
            }

            // Link với keywords
            for (const keyword of entities.keywords) {
                const query = `
          MATCH (c:Chunk {id: $chunkId}), (k:Keyword {name: $keywordName})
          MERGE (c)-[:CONTAINS_KEYWORD]->(k)
        `;

                await session.run(query, {
                    chunkId: chunk._id.toString(),
                    keywordName: keyword
                });

                relationshipCount++;
            }

            console.log(`✓ Link chunk ${chunk.chunk_index} với ${entities.concepts.length + entities.keywords.length} entities`);
        }

        console.log(`\n✅ Đã tạo ${relationshipCount} chunk-entity relationships`);

    } catch (err) {
        console.error('❌ Lỗi tạo relationships:', err.message);
        throw err;
    } finally {
        await session.close();
        await mongoClient.close();
    }
}

// ===== TẠO RELATIONSHIPS ENTITIES VỚI NHAU =====
async function createEntityRelationships() {
    const session = driver.session();

    try {
        console.log('🔗 Tạo relationships giữa entities...\n');

        // Concepts liên quan với keywords
        const conceptKeywordQuery = `
      MATCH (c:Chunk)-[:MENTIONS_CONCEPT]->(con:Concept),
            (c)-[:CONTAINS_KEYWORD]->(k:Keyword)
      MERGE (con)-[:RELATED_TO]->(k)
      ON CREATE SET con.created_at = datetime()
    `;

        const result1 = await session.run(conceptKeywordQuery);
        console.log(`✓ Tạo ${result1.summary.counters.relationshipsCreated} concept-keyword relationships`);

        // Keywords liên quan với nhau (cùng xuất hiện trong chunk)
        const keywordKeywordQuery = `
      MATCH (c:Chunk)-[:CONTAINS_KEYWORD]->(k1:Keyword),
            (c)-[:CONTAINS_KEYWORD]->(k2:Keyword)
      WHERE k1 <> k2
      MERGE (k1)-[:CO_OCCURS_WITH]->(k2)
    `;

        const result2 = await session.run(keywordKeywordQuery);
        console.log(`✓ Tạo ${result2.summary.counters.relationshipsCreated} keyword-keyword relationships`);

    } catch (err) {
        console.error('❌ Lỗi tạo entity relationships:', err.message);
        throw err;
    } finally {
        await session.close();
    }
}

// ===== THỐNG KÊ KNOWLEDGE GRAPH =====
async function getKnowledgeGraphStats() {
    const session = driver.session();

    try {
        console.log('📊 Thống kê Knowledge Graph với Entities:\n');

        // Đếm tất cả nodes
        const nodeQuery = `
      MATCH (n)
      RETURN labels(n) as labels, count(n) as count
      ORDER BY count DESC
    `;

        const nodeResult = await session.run(nodeQuery);
        console.log('📋 Nodes:');
        nodeResult.records.forEach(record => {
            const labels = record.get('labels');
            const count = record.get('count');
            console.log(`  ${labels.join(':')}: ${count}`);
        });

        // Đếm relationships
        const relQuery = `
      MATCH ()-[r]->()
      RETURN type(r) as type, count(r) as count
      ORDER BY count DESC
    `;

        const relResult = await session.run(relQuery);
        console.log('\n🔗 Relationships:');
        relResult.records.forEach(record => {
            const type = record.get('type');
            const count = record.get('count');
            console.log(`  ${type}: ${count}`);
        });

    } catch (err) {
        console.error('❌ Lỗi thống kê:', err.message);
    } finally {
        await session.close();
    }
}

// ===== CHƯƠNG TRÌNH CHÍNH =====
async function main() {
    try {
        console.log('🚀 Tạo Knowledge Graph với Entity Extraction\n');

        // Khởi tạo
        await initNeo4j();
        console.log('');

        // Bước 1: Tạo entity nodes
        await createEntityNodes();
        console.log('');

        // Bước 2: Tạo chunk-entity relationships
        await createChunkEntityRelationships();
        console.log('');

        // Bước 3: Tạo entity-entity relationships
        await createEntityRelationships();
        console.log('');

        // Bước 4: Thống kê
        await getKnowledgeGraphStats();
        console.log('');

        console.log('✅ Hoàn thành tạo Knowledge Graph!');
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
