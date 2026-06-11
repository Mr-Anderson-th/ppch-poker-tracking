# แผนการปรับปรุง PPCH

ตอบคำถามสุดท้ายก่อน: **ได้ครับ** หลัง publish แล้ว นายยังกลับมาแก้ไขในแชทนี้ได้เรื่อยๆ ทุกการเปลี่ยนแปลง backend (database, server functions) จะ deploy ทันที ส่วน frontend ต้องกด **Update** ในหน้า Publish เพื่อให้ของใหม่ขึ้น production

---

## 1. Dark / Light Theme (ดำ-แดง เหมือนเว็บเดิม)

- เพิ่ม theme tokens ชุดที่สองใน `src/styles.css` ภายใต้ `.dark` — พื้นดำลึก (`oklch(0.12 0 0)`), accent แดงโป๊กเกอร์ (`oklch(0.60 0.22 25)`), surface ดำ-เทาเข้ม, border เรืองแดงจางๆ
- เพิ่ม `next-themes` provider ที่ `__root.tsx` (เก็บใน localStorage, default = light)
- ปุ่มสลับ theme (sun/moon icon) ที่ `AppShell` topbar
- ปุ่ม interactive: เพิ่ม variant ใหม่ใน button — hover scale + glow shadow ตามสี primary, active press-down, transition smooth (200ms). ใช้กับปุ่มหลักทุกหน้า

## 2. หน้า Round Details (`/rounds/$id`) — แก้ไขได้สำหรับ Admin

หน้า detail มีอยู่แล้ว แต่จะเสริม:

- **Timeline graph**: แสดงเส้นเวลาของรอบ (แกน X = เวลา/blind level, จุด = elimination ของผู้เล่นแต่ละคน, สัญลักษณ์ rebuy) ใช้ Recharts ScatterChart
- **ตารางผู้เล่น**: เพิ่มคอลัมน์ `Bust time` (นาทีที่ตกรอบ) + `Bust level` (blind level ตอนตก)
- **โหมด Edit (admin เท่านั้น)**: ปุ่ม "Edit round" → เปิด dialog แก้ทุก field: finish position, rebuys, bust_level, bust_sb/bb, points, payout, net_amount ของแต่ละผู้เล่น + ข้อมูลรอบ (date, buy-in, notes)
- เพิ่ม server function `updateRoundResults` (password-gated เหมือนเดิม)
- ต้องเพิ่ม column ใน DB: `round_results.bust_time_seconds` (integer, nullable) เพื่อเก็บนาทีที่ตกรอบ

## 3. หน้า Player Detail (`/players/$id`) — Analytics ลึกขึ้น

มีหน้าอยู่แล้ว เพิ่ม:

- **Bust level distribution**: histogram ว่าผู้เล่นมักจะตกรอบที่ blind level ไหน
- **Bust time average**: เฉลี่ยอยู่ในเกมกี่นาทีต่อรอบ + เทียบกับค่าเฉลี่ยของกลุ่ม
- **Percentage cards**: 
  - Win rate %, Top-3 rate %, ITM (in-the-money) rate %
  - ROI % = (total payout − total cost) / total cost × 100
  - Points share % = points ของเขา / total points ที่แจกทั้งหมด
- **Performance trend**: line chart แสดง finish position rolling average 5 รอบล่าสุด
- **Comparison radar**: เทียบกับค่าเฉลี่ยกลุ่ม (5 แกน: avg finish, ROI, top-3 rate, survival time, aggression = rebuys/round)

## 4. Admin: อัปโหลดรูปโปรไฟล์ผู้เล่น

- สร้าง Supabase Storage bucket `player-avatars` (public)
- เพิ่ม column `players.avatar_url` (text, nullable) — ยังเก็บ `avatar_color` เป็น fallback
- ใน `/admin` page ของแต่ละ player: ปุ่ม upload (drag-drop / click) → resize เป็น 256×256 ฝั่ง client → upload → save URL
- ทุกที่ที่ render avatar (AppShell, players list, round detail, player detail): ถ้ามี `avatar_url` แสดงรูป, ไม่งั้น fallback เป็นวงกลมสี + initials เหมือนเดิม
- ปุ่ม "Remove photo" ด้วย

## 5. ใช้ประโยชน์จาก Tournament Clock ให้สูงสุด

ปัจจุบันหน้า `/clock` มีแต่นาฬิกา แต่ไม่ได้บันทึก timeline กลับเข้า DB จริงจัง จะปรับ:

- ตอนกด **Knockout** ในนาฬิกา → บันทึก `bust_time_seconds` (จับจากเวลาที่ผ่านไปตั้งแต่เริ่มรอบ) + `bust_level` + `bust_sb/bb` อัตโนมัติ
- ตอนกด **Rebuy** → log timestamp ของ rebuy (เก็บใน `round_results.rebuy_times` jsonb array)
- ตอนจบรอบ (กด "Save round") → ทุกอย่างถูกบันทึกครบ ผู้เล่นไม่ต้องมานั่งกรอกเองที่หลัง
- ข้อมูลพวกนี้จะ feed เข้า graph ในข้อ 2 และ 3 โดยตรง

---

## Technical Notes

**DB migration (1 ครั้ง):**
```
ALTER TABLE round_results 
  ADD COLUMN bust_time_seconds integer,
  ADD COLUMN rebuy_times jsonb DEFAULT '[]'::jsonb;
ALTER TABLE players 
  ADD COLUMN avatar_url text;
```
+ create storage bucket `player-avatars` (public read, admin-gated write via server function)

**Server functions ใหม่** (ทั้งหมด password-gated):
- `updateRoundResults` — แก้ผลรอบ
- `updateRound` — แก้ meta ของรอบ
- `uploadPlayerAvatar` — รับ base64, upload ขึ้น storage, save URL
- `removePlayerAvatar`

**Files หลักที่แตะ:**
- `src/styles.css` — dark theme tokens, button variants
- `src/routes/__root.tsx` — theme provider
- `src/components/AppShell.tsx` — theme toggle, avatar render
- `src/routes/rounds.$id.tsx` — timeline chart, edit dialog
- `src/routes/players.$id.tsx` — analytics ใหม่
- `src/routes/admin.tsx` — avatar upload UI
- `src/routes/clock.tsx` — auto-log bust time + rebuy time
- `src/lib/api/admin.functions.ts` — server functions ใหม่
- `src/lib/queries.ts` — types ใหม่

---

## คำถามก่อนเริ่ม

1. **Dark theme**: อยากให้ default เป็น light แล้ว user สลับเองได้ (ผ่าน toggle) หรือว่าให้ระบบจำตาม OS preference?
2. **รูปโปรไฟล์**: จำกัดขนาดไฟล์เท่าไหร่ดี (เช่น max 2MB) และยอมรับ format ไหนบ้าง (jpg/png/webp)?
3. **Round edit ของ admin**: อยากให้แก้ทุก field รวมถึง finish position ที่อาจกระทบ payout/points auto-calc ใหม่ทันที หรือให้ admin กรอกตัวเลขเองทั้งหมด?
