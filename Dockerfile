# 1. Dùng bếp là Python phiên bản 3.9
FROM python:3.9-slim

# 2. Tạo một thư mục làm việc trong thùng container
WORKDIR /app

# 3. Copy file code của bạn vào thùng
COPY main.py .

# 4. Lệnh để chạy code khi mở thùng
CMD ["python", "main.py"]