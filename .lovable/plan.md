## แผนแก้ไข 6 ประเด็น

### 1) แก้ลิงก์ "View details" บน /rounds

- ตรวจสอบใน `src/routes/rounds.$id.tsx`: ตอนนี้ถ้า `useRound(id)` ยังโหลดอยู่จะแสดงแค่ "Loading…" และถ้า query error (เช่น 406 / RLS) จะค้างที่หน้าว่าง — เพิ่ม error state + skeleton loader ให้เห็นชัดเจน
- เพิ่ม `errorComponent` และ `pendingComponent` ให้ route `/rounds/$id`
- เปลี่ยน `useRound` ให้รองรับ retry และโชว์ข้อความเมื่อไม่พบ round
- ทดสอบจริง: เปิด preview แล้วกด View details ดูว่าหน้าโหลดข้อมูล round + results ครบ

### 2) เพิ่มประวัติซีซั่นในหน้าผู้เล่น

- ใน `src/routes/players.$id.tsx` เพิ่มการ์ดใหม่ **"Season history"**
- ดึง `useSeasonStandings()` (ทุกซีซั่น) + `useSeasons()` แล้ว filter เฉพาะของ player นี้
- แสดงตาราง: ซีซั่น | อันดับ (พร้อม medal) | คะแนน | ชนะ | รอบที่เล่น | Net | badge ที่ได้ในซีซั่นนั้น
- กดชื่อซีซั่นไปหน้า `/seasons/$id` ได้

### 3) Preview ก่อนจบซีซั่น

- ใน `SeasonsAdmin` ของ `src/routes/admin.tsx` เพิ่มส่วน **"Preview final standings"** ใน confirm dialog
- คำนวณ standings ปัจจุบันจาก `activeRounds` + `activeResults` (เรียงตาม points → wins → net)
- แสดงตาราง top 10 พร้อมไอคอน medal และระบุชัดว่า "ใครจะได้ badge อะไรบ้าง" โดยจับคู่กับ auto-rule badges (rank 1/2/3, biggest_win, perfect_attendance ฯลฯ)
- ผู้ใช้เห็นผลลัพธ์ก่อนกด Confirm

### 4) ตัวกรองในหน้า /rounds

- เพิ่มแถบ filter ด้านบนตาราง `src/routes/rounds.tsx`:
  - **Season** (dropdown: All / แต่ละซีซั่น)
  - **Player** (multi-select chip — แสดงเฉพาะ round ที่ผู้เล่นนั้นลงเล่น)
  - **Search by name** (ค้นชื่อรอบ)
  - **Date range** (from/to)
- เก็บ state ใน URL search params ผ่าน `validateSearch` (จำได้เวลา refresh / แชร์ลิงก์)
- โชว์จำนวนผลลัพธ์ + ปุ่ม "Clear filters"

### 5) Homepage รีเซ็ตข้อมูลตามซีซั่นปัจจุบัน

- ใน `src/routes/index.tsx` เพิ่มตัวเลือกบนสุด: **Season selector** (Current / All-time / past seasons)
- ค่า default = ซีซั่นปัจจุบัน (active season) → leaderboard, stats, highlights, chart "Last 10 rounds" ทั้งหมด filter ตามซีซั่นที่เลือก
- หลังจบซีซั่น: หน้า home จะโชว์ซีซั่นใหม่ (ว่าง) อัตโนมัติ — เพราะ active season เปลี่ยน
- เพิ่มแบนเนอร์เล็กๆ บนสุด: "Showing: [Season name] · [View past seasons →]"

### 6) แก้หน้า /seasons/$id ให้เห็นข้อมูลซีซั่นที่เลือก

- ปัญหาปัจจุบัน: ตาราง "Final standings" จะว่างถ้า `season_standings` ไม่ได้ snapshot ไว้ (เช่นซีซั่นที่ยังไม่ถูกปิดผ่าน endSeason หรือซีซั่น default "Season 1" ที่ backfill มา)
- แก้: ถ้า `standings.length === 0` → fallback คำนวณ standings สดจาก `rounds` + `results` ที่ `season_id === id` (เรียงเหมือน leaderboard บน home)
- เพิ่มส่วนแสดงรอบทั้งหมดของซีซั่น: ตาราง mini "Rounds in this season" (วันที่, ชื่อ, ผู้ชนะ, pot) → กดเข้า /rounds/$id ได้
- ถ้าเป็นซีซั่นที่ active แสดง badge "Active" บน header แทนวันที่จบ  
  
7) เก็บข้อมูลที่มีอยู่ตอนนี้ให้เป็น Past seasons ไปเลย แล้วเริ่มการนับคะแนนใหม่

## เทคนิค / ไฟล์ที่แก้

- `src/routes/rounds.$id.tsx` — error/pending components
- `src/routes/players.$id.tsx` — เพิ่ม Season history card
- `src/routes/admin.tsx` — preview standings + projected badges ใน end-season dialog
- `src/routes/rounds.tsx` — filter bar + `validateSearch` (season/player/search/date)
- `src/routes/index.tsx` — season selector + filter ทุกการคำนวณตาม `season_id`
- `src/routes/seasons.$id.tsx` — fallback compute standings + รายชื่อ rounds
- ไม่ต้องแก้ DB / migrations รอบนี้ — ใช้ข้อมูลที่มีอยู่แล้ว