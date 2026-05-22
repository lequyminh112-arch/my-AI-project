const neo4j = require('neo4j-driver');

// ===== CẤU HÌNH =====
const neo4jUri = 'neo4j://localhost:7687';
const neo4jUser = 'neo4j';
const neo4jPassword = 'neo4j123';

let driver;

// ===== KẾT NỐI NEO4J =====
async function initNeo4j() {
    try {
        driver = neo4j.driver(neo4jUri, neo4j.auth.basic(neo4jUser, neo4jPassword));
        console.log(' Kết nối Neo4j thành công');
        return driver;
    } catch (err) {
        console.error(' Lỗi kết nối Neo4j:', err.message);
        throw err;
    }
}

// ===== QUERY 1: THỐNG KÊ GRAPH =====
async function getGraphStats() {
    const session = driver.session();

    try {
        console.log(' Thống kê Knowledge Graph:\n');

        // Đếm nodes
        const nodeQuery = `
      MATCH (n)
      RETURN labels(n) as labels, count(n) as count
      ORDER BY count DESC
    `;

        const nodeResult = await session.run(nodeQuery);
        console.log(' Nodes:');
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
        console.log('\n Relationships:');
        relResult.records.forEach(record => {
            const type = record.get('type');
            const count = record.get('count');
            console.log(`  ${type}: ${count}`);
        });

    } catch (err) {
        console.error(' Lỗi query thống kê:', err.message);
    } finally {
        await session.close();
    }
}

// ===== QUERY 2: TÌM CHUNKS TƯƠNG TỰ =====
async function findSimilarChunks(chunkIndex, limit = 5) {
    const session = driver.session();

    try {
        console.log(` Tìm chunks tương tự với Chunk #${chunkIndex}:\n`);

        const query = `
      MATCH (c1:Chunk {chunk_index: $chunkIndex})-[r:SIMILAR_TO]-(c2:Chunk)
      RETURN c2.chunk_index as chunk_index,
             r.similarity as similarity,
             c2.content as content
      ORDER BY r.similarity DESC
      LIMIT $limit
    `;

        const result = await session.run(query, {
            chunkIndex: chunkIndex,
            limit: limit
        });

        console.log(` Top ${limit} chunks tương tự:`);
        result.records.forEach((record, idx) => {
            const chunkIdx = record.get('chunk_index');
            const similarity = record.get('similarity');
            const content = record.get('content').substring(0, 100) + '...';

            console.log(`${idx + 1}. Chunk #${chunkIdx} - Similarity: ${(similarity * 100).toFixed(1)}%`);
            console.log(`   Content: ${content}`);
            console.log('');
        });

    } catch (err) {
        console.error(' Lỗi tìm chunks tương tự:', err.message);
    } finally {
        await session.close();
    }
}

// ===== QUERY 3: TÌM CHUNKS THEO BOOK =====
async function getChunksByBook() {
    const session = driver.session();

    try {
        console.log(' Chunks theo sách:\n');

        const query = `
      MATCH (b:Book)-[:CONTAINS]->(c:Chunk)
      RETURN b.title as title,
             count(c) as chunk_count,
             collect(c.chunk_index) as chunk_indices
      ORDER BY chunk_count DESC
    `;

        const result = await session.run(query);

        result.records.forEach(record => {
            const title = record.get('title');
            const chunkCount = record.get('chunk_count');
            const chunkIndices = record.get('chunk_indices');

            console.log(` ${title}`);
            console.log(`   Số chunks: ${chunkCount}`);
            console.log(`   Chunk indices: [${chunkIndices.slice(0, 10).join(', ')}${chunkIndices.length > 10 ? '...' : ''}]`);
            console.log('');
        });

    } catch (err) {
        console.error(' Lỗi query chunks theo book:', err.message);
    } finally {
        await session.close();
    }
}

// ===== QUERY 4: TÌM CLUSTER CHUNKS =====
async function findChunkClusters(minSimilarity = 0.8) {
    const session = driver.session();

    try {
        console.log(` Tìm clusters chunks (similarity > ${(minSimilarity * 100).toFixed(0)}%):\n`);

        const query = `
      MATCH (c1:Chunk)-[r:SIMILAR_TO]-(c2:Chunk)
      WHERE r.similarity > $minSimilarity
      RETURN c1.chunk_index as chunk1,
             c2.chunk_index as chunk2,
             r.similarity as similarity
      ORDER BY r.similarity DESC
      LIMIT 10
    `;

        const result = await session.run(query, { minSimilarity: minSimilarity });

        console.log(' Top 10 relationships mạnh nhất:');
        result.records.forEach((record, idx) => {
            const chunk1 = record.get('chunk1');
            const chunk2 = record.get('chunk2');
            const similarity = record.get('similarity');

            console.log(`${idx + 1}. Chunk #${chunk1} ↔ Chunk #${chunk2} - ${(similarity * 100).toFixed(1)}%`);
        });

    } catch (err) {
        console.error(' Lỗi tìm clusters:', err.message);
    } finally {
        await session.close();
    }
}

// ===== QUERY 5: VISUALIZATION QUERIES =====
async function getVisualizationQueries() {
    console.log(' Queries để visualize trong Neo4j Browser:\n');

    console.log('1. Xem toàn bộ graph:');
    console.log('   MATCH (n)-[r]->(m) RETURN n,r,m LIMIT 50\n');

    console.log('2. Xem chunks và relationships:');
    console.log('   MATCH (c1:Chunk)-[r:SIMILAR_TO]-(c2:Chunk)');
    console.log('   WHERE r.similarity > 0.8');
    console.log('   RETURN c1,r,c2 LIMIT 20\n');

    console.log('3. Xem book và chunks:');
    console.log('   MATCH (b:Book)-[r:CONTAINS]->(c:Chunk)');
    console.log('   RETURN b,r,c LIMIT 25\n');

    console.log('4. Tìm path giữa chunks:');
    console.log('   MATCH path = (c1:Chunk)-[*1..3]-(c2:Chunk)');
    console.log('   WHERE c1.chunk_index = 0');
    console.log('   RETURN path LIMIT 10\n');
}

// ===== CHƯƠNG TRÌNH CHÍNH =====
async function main() {
    try {
        console.log(' Neo4j Knowledge Graph Queries\n');

        // Khởi tạo Neo4j
        await initNeo4j();
        console.log('');

        // Query 1: Thống kê
        await getGraphStats();
        console.log('');

        // Query 2: Chunks tương tự
        await findSimilarChunks(0, 3); // Tìm chunks tương tự với chunk #0
        console.log('');

        // Query 3: Chunks theo book
        await getChunksByBook();
        console.log('');

        // Query 4: Clusters
        await findChunkClusters(0.8);
        console.log('');

        // Query 5: Visualization
        getVisualizationQueries();

    } catch (err) {
        console.error(' Lỗi:', err);
    } finally {
        if (driver) {
            await driver.close();
        }
    }
}

// Chạy main hoặc export functions
if (require.main === module) {
    main();
}

module.exports = {
    initNeo4j,
    getGraphStats,
    findSimilarChunks,
    getChunksByBook,
    findChunkClusters
};
