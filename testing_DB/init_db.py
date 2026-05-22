from pymongo import MongoClient
from datetime import datetime

# 1. Kết nối tới Docker MongoDB
# Sử dụng mật khẩu 'your_password' như trong file docker-compose
client = MongoClient("mongodb://admin:your_password@127.0.0.1:27017/")
db = client["chatbot_data"]

def create_schema():
    # 2. Tạo dữ liệu mẫu cho Collection 'documents'
    doc_meta = {
        "ten_sach": "Tin học 10",
        "loai": "Sách giáo khoa",
        "ngay_tao": datetime.now()
    }
    doc_id = db.documents.insert_one(doc_meta).inserted_id
    print(f"--- Đã tạo Document ID: {doc_id} ---")

    # 3. Tạo dữ liệu mẫu cho Collection 'document_chunks'
    chunk_data = {
        "book_id": doc_id,
        "so_trang": 5,
        "chuong": "Chủ đề 1: Máy tính và xã hội tri thức",
        "noi_dung": "Thông tin là những gì đem lại cho ta hiểu biết về thế giới xung quanh...",
        "vector_nhung": [], # Task tuần sau sẽ điền vào đây
        "created_at": datetime.now(),
        "updated_at": datetime.now()
    }
    db.document_chunks.insert_one(chunk_data)
    print("--- Đã cài đặt Schema và nạp dữ liệu mẫu thành công! ---")

if __name__ == "__main__":
    create_schema()