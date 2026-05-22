from fastapi import FastAPI
from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId

app = FastAPI()

# Kết nối MongoDB (Docker)
client = MongoClient("mongodb://admin:your_password@localhost:27017/")
db = client["chatbot_data"]

@app.get("/api/tim-kiem")
def search_documents(ten_sach: str, so_trang: int):
    # 1. Tìm kiếm dữ liệu trong MongoDB
    # Ở đây tạm thời ta lọc theo số trang để demo
    query = {"so_trang": so_trang}
    results = list(db["document_chunks"].find(query))

    # 2. Định dạng lại danh sách kết quả (phần "ket_qua")
    formatted_results = []
    for item in results:
        formatted_results.append({
            "id": str(item["_id"]),
            "book_id": str(item.get("book_id", "")),
            "so_trang": item.get("so_trang"),
            "chuong": item.get("chuong", "N/A"),
            "noi_dung": item.get("noi_dung", ""),
            "vector_nhung": item.get("vector_nhung", []),
            "created_at": item.get("created_at", datetime.now()),
            "updated_at": item.get("updated_at", datetime.now())
        })

    # 3. Trả về cấu trúc tổng thể như ảnh demo
    return {
        "sach": ten_sach,
        "trang": str(so_trang),
        "so_luong_doan_van": len(formatted_results),
        "ket_qua": formatted_results
    }