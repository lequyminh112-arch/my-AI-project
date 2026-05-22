const { spawn } = require('child_process');
const path = require('path');

// ===== CHẠY SCRIPT CON =====
function runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`  Chạy: ${scriptName} ${args.join(' ')}`);
        console.log(`${'='.repeat(60)}\n`);

        const child = spawn('node', [scriptName, ...args], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`\n ${scriptName} hoàn thành\n`);
                resolve(code);
            } else {
                console.error(`\n ${scriptName} lỗi (exit code: ${code})\n`);
                reject(new Error(`${scriptName} failed`));
            }
        });

        child.on('error', (err) => {
            console.error(`\n Lỗi chạy ${scriptName}:`, err.message, '\n');
            reject(err);
        });
    });
}

// ===== CHƯƠNG TRÌNH CHÍNH =====
async function runNeo4jPipeline() {
    try {
        console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║         FULL NEO4J KNOWLEDGE GRAPH PIPELINE               ║
    ║   Import Data → Create Graph → Extract Entities → Query  ║
    ╚════════════════════════════════════════════════════════════╝
    `);

        // Bước 1: Import dữ liệu từ MongoDB sang Neo4j
        console.log('\n BƯỚC 1: Import dữ liệu từ MongoDB sang Neo4j');
        await runScript('neo4j_import.js');

        // Bước 2: Extract entities và tạo knowledge graph
        console.log('\n  BƯỚC 2: Extract entities và tạo relationships');
        await runScript('neo4j_entities.js');

        // Bước 3: Query và demo knowledge graph
        console.log('\n BƯỚC 3: Query và demo knowledge graph');
        await runScript('neo4j_query.js');

        console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                   PIPELINE HOÀN THÀNH                  ║
    ║                                                           ║
    ║  Knowledge Graph đã được tạo với:                       ║
    ║  - Chunk nodes (từ MongoDB)                              ║
    ║  - Entity nodes (Concepts & Keywords)                    ║
    ║  - Similarity relationships                              ║
    ║  - Entity relationships                                   ║
    ║                                                           ║
    ║   Neo4j Browser: http://localhost:7474                 ║
    ║     Username: neo4j                                       ║
    ║     Password: neo4j123                                    ║
    ╚════════════════════════════════════════════════════════════╝
    `);

    } catch (err) {
        console.error('\n Pipeline lỗi:', err.message);
        process.exit(1);
    }
}

runNeo4jPipeline();
