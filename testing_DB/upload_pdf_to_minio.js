const fs = require('fs');
const Minio = require('minio');

// Cấu hình MinIO
const minioClient = new Minio.Client({
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: 'minioadmin',
    secretKey: 'minioadmin123'
});

const bucketName = 'pdf-resources';
const objectName = 'SGK_TIN11.pdf';
const filePath = './SGK TIN 11 ICT KNTT (GOC).pdf';

async function upload() {
    try {
        const exists = await minioClient.bucketExists(bucketName);
        if (!exists) {
            await minioClient.makeBucket(bucketName, 'us-east-1');
            console.log(`Đã tạo bucket ${bucketName}`);
        }

        await minioClient.fPutObject(bucketName, objectName, filePath);
        console.log(`Đã upload ${objectName} vào bucket ${bucketName}`);
    } catch (err) {
        console.error(err);
    }
}

upload();