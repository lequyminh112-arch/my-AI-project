const { spawn } = require('child_process');
const path = require('path');

// ===== BƯỚC 1: Chạy script con =====
function runScript(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`▶️  Chạy: ${scriptName} ${args.join(' ')}`);
        console.log(`${'='.repeat(60)}\n`);

        const child = spawn('node', [scriptName, ...args], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        child.on('close', (code) => {
            if (code === 0) {
                console.log(`\n✅ ${scriptName} hoàn thành\n`);
                resolve(code);
            } else {
                console.error(`\n❌ ${scriptName} lỗi (exit code: ${code})\n`);
                reject(new Error(`${scriptName} failed`));
            }
        });

        child.on('error', (err) => {
            console.error(`\n❌ Lỗi chạy ${scriptName}:`, err.message, '\n');
            reject(err);
        });
    });
}

// ===== BƯỚC 2: Main pipeline =====
async function runFullPipeline() {
    try {
        console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║     FULL PIPELINE: Upload → Process → Chunk → Embed       ║
    ║                    ↓ Search                                ║
    ╚════════════════════════════════════════════════════════════╝
    `);

        // Bước 1: Upload PDF tới MinIO
        console.log('\n📤 BƯỚC 1: Upload PDF tới MinIO');
        await runScript('upload_pdf_to_minio.js');

        // Bước 2: Xử lý PDF + lưu metadata
        console.log('\n📄 BƯỚC 2: Xử lý PDF + lưu metadata');
        await runScript('process_pdf_from_minio.js');

        // Bước 3: Chunking
        console.log('\n✂️  BƯỚC 3: Chia PDF thành chunks');
        await runScript('run_full_pipeline.js');

        // Bước 4: Tạo embeddings
        console.log('\n🧠 BƯỚC 4: Tạo embeddings cho chunks');
        await runScript('generate_embeddings.js');

        // Bước 5: Tìm kiếm (demo)
        console.log('\n🔍 BƯỚC 5: Demo tìm kiếm ngữ nghĩa');
        await runScript('semantic_search.js', ['máy tính']);

        console.log(`
    ╔════════════════════════════════════════════════════════════╗
    ║                    ✅ PIPELINE HOÀN THÀNH                 ║
    ║                                                             ║
    ║  Dữ liệu đã được xử lý và lưu trong:                      ║
    ║  - MinIO: File PDF gốc                                    ║
    ║  - MongoDB: Metadata, chunks, embeddings                  ║
    ║                                                             ║
    ║  Bạn có thể chạy tìm kiếm bất kỳ lúc nào:                 ║
    ║  $ node semantic_search.js "tìm kiếm gì"                  ║
    ╚════════════════════════════════════════════════════════════╝
    `);

    } catch (err) {
        console.error('\n💥 Pipeline lỗi:', err.message);
        process.exit(1);
    }
}

runFullPipeline();
