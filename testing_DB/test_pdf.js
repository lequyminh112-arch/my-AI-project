const fs = require('fs');
// Đối với phiên bản 2.4.5, bạn hãy thử gọi trực tiếp như thế này
const pdf = require('pdf-parse');

const filePath = './SGK TIN 11 ICT KNTT (GOC).pdf';

if (fs.existsSync(filePath)) {
    let dataBuffer = fs.readFileSync(filePath);

    // Kiểm tra xem pdf có phải là hàm không, nếu không thì lấy thuộc tính default
    const parse = typeof pdf === 'function' ? pdf : pdf.default;

    if (typeof parse !== 'function') {
        console.error("Lỗi: Không thể tìm thấy hàm xử lý trong thư viện pdf-parse.");
    } else {
        parse(dataBuffer).then(function (data) {
            console.log("--- KẾT QUẢ ĐỌC FILE THÀNH CÔNG ---");
            console.log("Số trang:", data.numpages);
            console.log("500 ký tự đầu tiên:", data.text.substring(0, 500));
        }).catch(function (error) {
            console.error("Lỗi xử lý nội dung PDF:", error);
        });
    }
} else {
    console.error("Lỗi: Không tìm thấy file PDF tại:", filePath);

} const document = {
    title: "Tin học 11 - Định hướng ứng dụng",
    bucket: "pdf-resources",
    object_name: "SGK_TIN11.pdf",
    minio_path: "minio://pdf-resources/SGK_TIN11.pdf",
    uploaded_at: new Date()
};