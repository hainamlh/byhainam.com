# byhainam.com — Hướng dẫn cài đặt CMS (viết bài trực tiếp trên web)

## Sau khi cài xong, viết bài như thế nào?

1. Vào `byhainam.com/admin`
2. Đăng nhập bằng email đã được mời
3. Chọn "Letters (Blog)" → "New Letters"
4. Điền tiêu đề, mô tả ngắn, chọn màu thẻ, viết nội dung trong ô soạn thảo
   (có nút in đậm/in nghiêng/tiêu đề/trích dẫn/danh sách/**chèn ảnh**/chèn link — bôi đen chữ rồi bấm nút để định dạng, giống Google Docs)
5. Bấm **Publish** → khoảng 1 phút sau bài lên `byhainam.com/letters/...` thật

Không cần đụng vào file HTML nào nữa.

---

## Cài đặt lần đầu (chỉ làm 1 lần)

### Bước 1 — Đưa code lên GitHub
1. Tạo tài khoản GitHub (nếu chưa có): github.com
2. Tạo 1 repository mới, đặt tên tuỳ ý (vd `byhainam-web`)
3. Upload toàn bộ nội dung trong thư mục này lên repository đó
   (Cách dễ nhất: vào trang repo → "Add file" → "Upload files" → kéo thả tất cả file/folder vào, trừ thư mục `node_modules` nếu có)

### Bước 2 — Kết nối GitHub với Netlify
1. Vào app.netlify.com → **Add new site → Import an existing project**
2. Chọn GitHub, cho phép truy cập, chọn đúng repository vừa tạo
3. Ở phần build settings:
   - Build command: `npm run build`
   - Publish directory: `.` (dấu chấm — nghĩa là thư mục gốc)
4. Bấm **Deploy**

### Bước 3 — Bật Identity (hệ thống đăng nhập cho /admin)
1. Trong site vừa tạo trên Netlify → **Site configuration → Identity → Enable Identity**
2. Ở mục "Registration preferences" → chọn **Invite only** (để chỉ mình anh đăng nhập được)
3. Kéo xuống **Services → Git Gateway → Enable Git Gateway**
4. Quay lại tab Identity → **Invite users** → nhập email của anh → gửi lời mời
5. Mở email, bấm link xác nhận, đặt mật khẩu

### Bước 4 — Gắn tên miền
Làm theo hướng dẫn gắn domain đã trao đổi trước đó (`stock.byhainam.com`, `letters.byhainam.com` giữ nguyên như cũ — chỉ site `byhainam.com` này chuyển từ "kéo thả" sang "kết nối GitHub").

### Bước 5 — Xong, vào viết bài
Truy cập `byhainam.com/admin`, đăng nhập bằng email đã mời ở Bước 3 → bắt đầu viết.

---

## Cấu trúc thư mục (không cần hiểu để dùng, chỉ để tham khảo)

```
content/letters/*.md     ← nội dung từng bài (CMS tự động ghi vào đây khi Publish)
templates/                ← khung giao diện dùng chung
build.js                  ← script tự động tạo lại toàn bộ trang mỗi khi có bài mới
admin/                    ← trang quản trị CMS
style.css, avatar.jpg     ← giao diện & hình ảnh dùng chung
```

Mỗi lần anh bấm Publish trên `/admin`, Netlify sẽ tự chạy `node build.js` để tạo lại toàn bộ trang chủ, trang Letters, và trang bài viết mới — hoàn toàn tự động.
