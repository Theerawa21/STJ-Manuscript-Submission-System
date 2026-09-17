# Saint Theresa Journal

เว็บไซต์และหน้าระบบทั้งหมดเผยแพร่ผ่าน GitHub Pages:
https://theerawa21.github.io/STJ-Manuscript-Submission-System/

- `index.html`: หน้าแรก ข้อมูลวารสาร และดาวน์โหลด Template
- `system.html`: สมัครสมาชิก เข้าสู่ระบบ ส่งบทความ ติดตามสถานะ และกองบรรณาธิการ
- `api-client.js`: เชื่อมต่อฐานข้อมูลผ่าน iframe และ postMessage ที่ตรวจสอบ origin/channel
- `backend/apps-script`: โค้ดบริการข้อมูลที่ใช้ Google Sheets และ Drive เดิม
- `downloads`: Template บทความ 4 ประเภท

GitHub Pages ให้บริการไฟล์เว็บไซต์แบบ static จึงใช้ Apps Script สำหรับบัญชีผู้ใช้ การจัดเก็บไฟล์ และสิทธิ์เข้าถึงข้อมูล โดยไม่ต้องเปลี่ยนหน้าออกจากเว็บไซต์ GitHub Pages

## เผยแพร่
GitHub Pages ใช้ branch `main` และโฟลเดอร์ `/` การ push จะเผยแพร่หน้าเว็บ ส่วนการปรับ backend ต้อง deploy Apps Script เป็น version ใหม่ด้วย deployment ID เดิมด้วย

## ตั้งค่าฐานข้อมูล
ใช้ Script Properties: `SPREADSHEET_ID`, `ROOT_FOLDER_ID`, `EDITORIAL_EMAIL`, `ADMIN_PASSWORD_HASH` และ `DATABASE_READY` ไม่ใส่รหัสผ่านหรือ token ลงใน repository
Bridge อนุญาต origin `https://theerawa21.github.io` เท่านั้น และ endpoint ทุกตัวตรวจสอบสิทธิ์บน server ตามประเภทข้อมูล

## ระบบวารสารครบกระบวนการ
ดู [คู่มือ workflow](docs/journal-workflow.md) สำหรับ reviewer, double-blind, revision, decision, proofreading, author proof, issue/publication และการแจ้งเตือน
