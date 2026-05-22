from sentence_transformers import SentenceTransformer
from pymongo import MongoClient

# 1. Kết nối MongoDB
client = MongoClient("mongodb://admin:your_password@localhost:27017/?authSource=admin")
db = client["chatbot_db"]
collection = db["document_chunks"]

# 2. Tải mô hình Embedding
model = SentenceTransformer('all-MiniLM-L6-v2')

def embed_and_store(chunks):
    data_to_insert = []
    
    print(f"--- Đang tạo embedding cho {len(chunks)} đoạn văn... ---")
    
    for i, text in enumerate(chunks):
        # Tạo vector từ văn bản
        vector = model.encode(text).tolist()
        
        # Cấu trúc document để lưu trữ
        doc = {
            "chunk_id": i,
            "content": text,
            "embedding": vector,  # Đây là mảng số thực
            "metadata": {"subject": "OOP", "source": "Learning Material"}
        }
        data_to_insert.append(doc)
    
    # 3. Lưu vào MongoDB
    if data_to_insert:
        collection.insert_many(data_to_insert)
        print(f"--- Đã lưu thành công {len(data_to_insert)} vector vào MongoDB! ---")

chunks_from_prev_task = [
    "Lập trình hướng đối tượng (OOP) là một phương pháp lập trình dựa trên khái niệm về đối tượng.",
    "Bốn tính chất chính của OOP bao gồm: Tính đóng gói, Kế thừa, Đa hình và Trừu tượng."
]

if __name__ == "__main__":
    embed_and_store(chunks_from_prev_task)