# Landing page « Quand partir au Vietnam ? »

Landing page tĩnh (HTML/CSS/JS thuần, không cần build) cho từ khóa **quand partir au Vietnam** — Authentik Vietnam.

## Cấu trúc

```
authentikvietnam/                      ← gốc repo
├── .github/workflows/
│   └── meteo-quand-partir.yml         ← tự cập nhật thời tiết mỗi sáng
└── quand-partir-au-vietnam/
    ├── index.html                     ← toàn bộ nội dung trang
    ├── assets/css/style.css           ← giao diện (màu, font, responsive)
    ├── assets/js/main.js              ← menu, tab, valise, thời tiết, nút back-to-top
    ├── assets/img/                    ← logo, favicon, ảnh chia sẻ mạng xã hội
    ├── data/places.json               ← danh sách điểm xem thời tiết (sửa ở đây)
    ├── data/meteo.json                ← dữ liệu thời tiết 7 ngày (do workflow tự tạo)
    └── scripts/update-meteo.mjs       ← script lấy dữ liệu thời tiết
```

## Đưa lên GitHub (làm 1 lần)

1. **Tải code lên**: kéo thả thư mục `quand-partir-au-vietnam` vào gốc repo `authentikvietnam`.
2. **Thêm workflow**: file `.github/workflows/meteo-quand-partir.yml` phải nằm ở **gốc repo** (không nằm trong thư mục landing page).
   Nếu máy ẩn thư mục `.github` khi kéo thả: trên GitHub chọn *Add file → Create new file*, gõ tên `.github/workflows/meteo-quand-partir.yml` rồi dán nội dung file vào.
3. **Bật GitHub Pages** (nếu repo chưa bật): *Settings → Pages → Source: Deploy from a branch → main / (root)*.
   Trang sẽ ở địa chỉ `https://<tên-tài-khoản>.github.io/authentikvietnam/quand-partir-au-vietnam/` (hoặc tên miền riêng nếu repo đã gắn).
4. **Chạy thử workflow một lần**: tab *Actions → « Météo – quand partir au Vietnam » → Run workflow*. Sau đó workflow tự chạy **mỗi ngày lúc 5h17 sáng giờ Việt Nam**.
   Nếu bước commit báo lỗi quyền: *Settings → Actions → General → Workflow permissions → Read and write permissions*.
5. **SEO**: khi đã có địa chỉ chính thức, mở `index.html`, bỏ comment 2 dòng `canonical` và `og:url` ở đầu file và thay `VOTRE-DOMAINE` bằng địa chỉ thật.

## Thời tiết 7 ngày — hoạt động thế nào

- Nguồn: **MET Norway** (Viện Khí tượng Na Uy, api.met.no), miễn phí kể cả cho mục đích thương mại, giấy phép CC BY 4.0 (đã ghi nguồn trên trang).
- Mỗi sáng GitHub Actions gọi API cho từng điểm, tính nhiệt độ cao/thấp, lượng mưa và biểu tượng thời tiết theo ngày (giờ Việt Nam), rồi ghi vào `data/meteo.json`. Khách xem trang chỉ đọc file này → trang nhanh, không lộ API, không giới hạn lượt xem.
- Nếu một điểm lỗi khi lấy dữ liệu, script giữ lại dữ liệu cũ của điểm đó.
- Lưu ý: GitHub có thể tạm dừng workflow chạy theo lịch nếu repo không có hoạt động trong 60 ngày; khi đó vào tab *Actions* bấm *Enable workflow*.

### Thêm / bớt điểm du lịch

Sửa `data/places.json` (mỗi điểm: `id` không dấu và không trùng, `name`, `province`, `lat`, `lon`), chọn đúng miền `nord` / `centre` / `sud`, rồi chạy lại workflow (*Run workflow*). Lấy tọa độ: chuột phải vào địa điểm trên Google Maps → dòng đầu tiên là `lat, lon`.

## Sửa nội dung

Toàn bộ chữ nằm trong `index.html`, chia theo từng khối có chú thích `<!-- ============ ... ============ -->`:
navbar · hero (2 nút guide climat / bài viết « Quand partir ») · climat 3 miền · météo en direct · valise · santé & vaccins · blog · CTA devis · avis (Tripadvisor, Google, Trustpilot) · footer · nút WhatsApp & back-to-top.

- **Điểm đánh giá** (Tripadvisor 5,0 · Google 4,9 · Trustpilot 4,9 — lấy ngày 14/10/2026): sửa trực tiếp trong khối `AVIS + FOOTER`.
- **Ảnh blog**: đang lấy trực tiếp từ authentikvietnam.com (`/media/blog/450_230/...`). Đổi bài: thay link, tiêu đề và đường dẫn ảnh trong khối `À LIRE`.
- **Màu sắc**: các biến ở đầu `assets/css/style.css` (`--green`, `--rust`, …).
- **Tháng hiện tại** trong lịch và bảng khí hậu được tự động tô viền theo giờ Việt Nam.

## Chạy thử trên máy

```
cd authentikvietnam
python3 -m http.server 8000
# mở http://localhost:8000/quand-partir-au-vietnam/
```
(Mở thẳng file `index.html` bằng trình duyệt sẽ không tải được thời tiết, cần chạy qua server như trên.)
