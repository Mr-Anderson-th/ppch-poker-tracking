## Plan: แก้ `/rounds` และทำหน้า Round Details ให้ครบ

### เป้าหมาย
ทำให้ปุ่ม/แถว `View details` ใน `/rounds` เข้า `/rounds/$id` ได้จริง และหน้า detail แสดงข้อมูลรอบนั้นครบตามที่ต้องการ พร้อมปุ่มแก้ไข/ลบสำหรับ admin

### สิ่งที่จะทำ
1. **แก้ปัญหา View details กดแล้วไม่แสดงข้อมูล**
   - ตรวจ flow การ navigate จาก `/rounds` ไป `/rounds/$id`
   - ปรับปุ่มให้เป็นลิงก์ชัดเจนและไม่ชนกับ click handler ของแถว
   - เพิ่ม error/loading/empty state ที่อ่านง่าย ถ้ารอบไม่พบหรือข้อมูลยังโหลดไม่เสร็จ

2. **ออกแบบหน้า `/rounds/$id` ใหม่ให้ดูเป็น Round dashboard**
   - Header แสดงชื่อรอบ, วันที่, ระยะเวลาที่เล่น, จำนวนผู้เล่น, total pot, total re-buy
   - Summary ด้านล่างตามที่ขอ:
     - total pot
     - total re-buy
     - avg re-buy ต่อผู้เล่น
     - ระยะเวลาที่เล่น
     - % เทียบค่าเฉลี่ยของ season สำหรับ total re-buy
     - % เทียบค่าเฉลี่ยของ season สำหรับ avg re-buy
   - ถ้ายังไม่มีข้อมูล จะขึ้น `—` แทน ไม่ทำให้หน้าพัง

3. **ตารางผลผู้เล่นในรอบนั้น**
   - แสดงคอลัมน์:
     - อันดับ
     - ชื่อผู้เล่น
     - คะแนนที่ได้
     - เงินที่ได้ / payout
     - sb-bb ตอนตกรอบ
     - เวลาออก
     - re-buy
     - net
   - ข้อมูล bust time, sb/bb, rebuy_times จะดึงจากข้อมูลที่ clock บันทึกไว้

4. **กราฟ timeline**
   - แสดงจุดเวลาที่ผู้เล่นตกรอบ
   - แสดงจุด/สัญลักษณ์สำหรับ re-buy
   - Tooltip บอกชื่อผู้เล่น, เวลา, อันดับ, level/sb-bb ถ้ามีข้อมูล

5. **เพิ่ม Admin controls**
   - ปุ่ม `Edit round` สำหรับ admin
   - ปุ่ม `Delete round` สำหรับ admin
   - Dialog แก้ไขข้อมูลทั้งหมดที่มีอยู่ได้มากขึ้น:
     - round name/date
     - buy-in/re-buy amount
     - payout structure
     - blind settings: starting SB/BB, level minutes, multiplier
     - duration
     - notes
     - ผลผู้เล่น: position, points, payout, rebuys, bust sb/bb, bust level, bust time, rebuy times
   - หลัง save/delete จะ invalidate ข้อมูลที่เกี่ยวข้องให้หน้า `/homepage`, `/rounds`, `/players`, `/seasons` อัปเดตตาม

6. **ปรับ server function `updateRound` ให้รองรับการแก้ไขครบ**
   - เพิ่ม validation สำหรับ field ที่ยังแก้ไม่ได้ตอนนี้ เช่น payout_structure, level_minutes, starting_sb, starting_bb, blind_multiplier, duration_seconds, rebuy_times
   - คำนวณ total players, total rebuys, total pot, net amount ใหม่หลังแก้ไข
   - ลบ round จะยังใช้ฟังก์ชันเดิม แต่จะตรวจให้ invalidate ครบหลังลบ

### Technical notes
- ไม่ต้องเพิ่มตารางใหม่ ใช้ข้อมูลเดิมจาก `rounds`, `round_results`, `players`, `seasons`
- ใช้ค่า season average คำนวณใน frontend จาก `useRounds()` โดย filter `season_id` เดียวกัน
- ถ้ารอบไม่มี `season_id` จะเทียบกับค่าเฉลี่ยจากทุก round แทน หรือแสดง `—` เมื่อไม่มีข้อมูลพอ
- จะไม่แก้ auto-generated files เช่น `routeTree.gen.ts` หรือไฟล์ integration ที่ระบบสร้างให้

### ผลลัพธ์หลังทำเสร็จ
- กด `View details` หรือคลิกแถวใน `/rounds` แล้วเห็นหน้า detail ได้จริง
- หน้า detail มีตาราง, summary, timeline graph ครบ
- Admin แก้ไข/ลบ round ได้จากหน้า detail โดยตรง