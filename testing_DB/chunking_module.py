from langchain_text_splitters import RecursiveCharacterTextSplitter

def process_learning_material(text):
    # Cấu hình bộ chia văn bản
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=500,        # Mỗi đoạn khoảng 500 ký tự
        chunk_overlap=50,      # Giao nhau 50 ký tự để giữ ngữ cảnh
        length_function=len,
        separators=["\n\n", "\n", ".", " ", ""] # Ưu tiên ngắt ở đoạn văn, rồi đến câu
    )
    
    chunks = text_splitter.split_text(text)
    return chunks

# --- DỮ LIỆU HỌC TẬP MẪU ĐỂ TEST ---
study_material = """
Lập trình hướng đối tượng (OOP) là một phương pháp lập trình dựa trên khái niệm về "đối tượng". 
Đối tượng bao gồm dữ liệu (thuộc tính) và mã nguồn (phương thức).
Bốn tính chất chính của OOP bao gồm:
1. Tính đóng gói (Encapsulation): Che giấu chi tiết cài đặt và chỉ lộ ra những gì cần thiết.
2. Tính kế thừa (Inheritance): Cho phép một lớp con kế thừa các đặc tính từ lớp cha.
3. Tính đa hình (Polymorphism): Một đối tượng có thể thực hiện một hành động theo nhiều cách khác nhau.
4. Tính trừu tượng (Abstraction): Tập trung vào những đặc điểm cốt lõi của đối tượng, bỏ qua chi tiết rườm rà.
Trong phát triển AI tại ETECHS, việc hiểu rõ cấu trúc dữ liệu giúp tối ưu hóa bộ nhớ cho các Vector Database.
"""

if __name__ == "__main__":
    result_chunks = process_learning_material(study_material)
    
    print(f"--- Đã chia thành {len(result_chunks)} đoạn dữ liệu học tập ---")
    for i, chunk in enumerate(result_chunks):
        print(f"\n[Chunk {i+1}]:\n{chunk}")
        print("-" * 30)