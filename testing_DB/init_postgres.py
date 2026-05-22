import psycopg2

def init_postgres():
    conn = None
    try:
        conn = psycopg2.connect(
            host="127.0.0.1",
            port="5433",
            database="chatbot_db",
            user="admin",
            password="your_password"
        )
        cur = conn.cursor()
        
        print("--- Đang khởi tạo bảng... ---")
        
        # 1. Tạo bảng Users
        cur.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')

        # 2. Tạo bảng Chat History
        cur.execute('''
            CREATE TABLE IF NOT EXISTS chat_history (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                user_query TEXT NOT NULL,
                bot_response TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')

        # 3. Chèn dữ liệu mẫu
        cur.execute("INSERT INTO users (username, email) VALUES (%s, %s) ON CONFLICT DO NOTHING", 
                    ('lequyminh', 'minh@etechs.com'))
        
        conn.commit()
        print("--- Đã cài đặt Schema PostgreSQL và tạo dữ liệu mẫu thành công! ---")
        cur.close()

    except Exception as e:
        print(f"Lỗi rồi {e}")
    finally:
        if conn is not None:
            conn.close()

if __name__ == "__main__":
    init_postgres()