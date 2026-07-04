## เป้าหมาย

รื้อหน้า `/players` และ `/players/$id` ใหม่ให้ Season filter ทำงานเหมือน homepage, กราฟ Radar 5 แกนสไตล์ gaming, และ admin จัดการ badge ได้ครบ

---

## 1. `/players` (list) — เพิ่ม Season filter

- เพิ่ม `<Select>` "Season" ที่หัวหน้า (All-time / แต่ละ season) — pattern เดียวกับหน้า Dashboard
- state เก็บใน URL search param `?season=<id>` เพื่อให้ share ได้
- เมื่อเลือก season: กรอง `results` เฉพาะ round ที่ `season_id === selected` แล้วคำนวณ points/wins/rounds/net ใหม่ + rank ตาม season นั้น
- Card ของแต่ละ player ยังเป็น `<Link to="/players/$id" params={{id}} search={{season}}>` เพื่อพา season selection ไปหน้า detail

## 2. `/players/$id` (view performance) — เขียนใหม่ทั้งหน้า

### Layout สไตล์ Gaming (dark, neon accent, glow shadows)

```
┌───────────────────────────────────────────────┐
│ [Avatar]  Name · nickname     [Season ▾]     │
│           🏆🎖️🌟 (badges + admin edit)         │
├───────────────────────────────────────────────┤
│  KPI grid (6 การ์ด · แสดงค่า + Δ% vs avg)     │
│  ITM% · Win%(#) · Rounds · Points · Money · AvgRebuy │
├───────────────────────────────────────────────┤
│  [ Radar Chart 5 แกน (0-10) ]  │  Score table │
│   Gaming style + Animation     │  ต่อแกน      │
├───────────────────────────────────────────────┤
│  Recent Rounds table (last 10-20 rounds)      │
└───────────────────────────────────────────────┘
```

### Season selector

- `<Select>` เหมือน `/players` list; sync กับ URL `?season=`
- ทุก metric/รอบ/radar คำนวณจาก `results` ที่กรองด้วย season นั้น (All-time = ไม่กรอง)

### Header block

- `PlayerAvatar size="xl"` + name/nickname
- แถว badge ทั้งหมด (all-time) — ปุ่ม `Grant` และปุ่ม `X` ลบต่อ badge (มีอยู่แล้ว, ขัดเกลา UI)

### KPI cards (6 การ์ด vs ค่าเฉลี่ยผู้เล่นคนอื่น)

สำหรับแต่ละ metric คำนวณ `myVal` และ `groupAvg` (เฉลี่ยจากทุกผู้เล่นที่มี rounds > 0 ใน season ที่เลือก), แสดง `▲/▼ X%` เทียบ groupAvg สไตล์เดียวกับ `/rounds/$id`:


| Card             | สูตร                                                                 |
| ---------------- | -------------------------------------------------------------------- |
| ITM Rate         | `payout>0 count / rounds * 100`                                      |
| Win Rate (#wins) | `wins/rounds * 100`                                                  |
| Rounds Played    | นับตรง ๆ                                                             |
| Points           | รวม `points_awarded`                                                 |
| Money Won        | รวม `payout` (หรือ `net_amount` — จะใช้ payout ตามคำขอ "เงินที่ได้") |
| Avg Rebuy        | `sum(rebuys) / rounds`                                               |


### Radar Chart 5 แกน (0-10) — component ใหม่ `PlayerRadar.tsx`

Props: `{ survival, efficiency, aggression, potDominance, consistency: number /* 0-10 */ }`

สูตรคำนวณ (ต่อรอบแล้วเฉลี่ยข้าม rounds ของ player):

1. **Survival** = `avg( bust_time_seconds / round.duration_seconds ) * 10`
2. **Efficiency** = `avg( min(10, points_awarded / (rebuys + 1) * 0.1) )`
3. **Aggression** = `avg( bust_bb / maxBbInMatch ) * 10` — `maxBbInMatch` = BB ของ level สูงสุดที่ round นั้นแตะ (คำนวณจาก `buildBlindLevels` โดยดู `bust_level` สูงสุดใน round; fallback = BB ที่ level ของผู้ชนะ)
4. **Pot Dominance** = `avg( payout / round.total_pot ) * 10`
5. **Consistency** = `avg( (1 - (finish_position - 1) / round.total_players) ) * 10`

Rounds ที่ข้อมูลไม่ครบ (เช่น `bust_bb` null) จะข้ามในแกนที่เกี่ยวข้อง

Styling (Gaming theme):

- พื้นหลัง dark radial gradient + grid neon (สี `--primary` glow)
- 2 layer: player = fill สี primary translucent + stroke neon glow (`filter: drop-shadow`); group avg = dashed stroke สีจาง
- Animation: recharts `Radar` มี `isAnimationActive` + custom `animationBegin` + `animationDuration=1200` easing `ease-out`, พร้อม CSS `@keyframes` pulse บนจุด vertex
- ข้าง ๆ radar: ตารางเล็กแสดงคะแนน 0-10 แต่ละแกน + bar สั้น ๆ

### Recent Rounds table (ด้านล่าง)

คอลัมน์: Date · Round · Finish · Points · Payout · Net · Rebuys · Bust BB

- แถวคลิกได้ → `/rounds/$id`
- แสดง 20 รอบล่าสุดของ player (กรองตาม season)

## 3. Admin badge editing (ปรับปรุงจากของเดิม)

- ปุ่ม `Grant badge` เปิด dialog เลือก badge + optional note + optional season → เรียก `grantBadge` (มีอยู่แล้ว)
- ปุ่ม `X` บน badge → `revokeBadge` (มีอยู่แล้ว)
- เพิ่ม hover state ให้ชัดขึ้น + confirm dialog สวยขึ้น

---

## Files ที่แตะ

- `src/routes/players.tsx` — เพิ่ม Season `<Select>` + filter logic + URL search param
- `src/routes/players.$id.tsx` — เขียนใหม่: season selector, KPI vs avg, radar, table
- `src/components/PlayerRadar.tsx` — **ใหม่** radar 5-axis gaming style + animation
- `src/lib/points.ts` — export helper `computePlayerAxes(results, rounds, playerId)` คืนคะแนน 0-10 ทั้ง 5 แกน
- `src/styles.css` — เพิ่ม keyframes `radar-pulse`, utility `.neon-glow` (ถ้ายังไม่มี)

## ไม่แตะ

- ไม่มี migration; ข้อมูลทั้งหมดใช้จากตารางเดิม (`rounds`, `round_results`, `player_badges`)
- ไม่แตะ server functions ยกเว้นใช้ `grantBadge` / `revokeBadge` ที่มีอยู่

## จุดที่อยากคอนเฟิร์ม (ทำต่อได้เลยด้วย default ถ้าไม่ตอบ)

1. "เงินที่ได้" = **payout** (เงินรางวัลรวม) ไม่ใช่ net — default ใช้ payout
2. Efficiency factor `0.1` — ใช้ตามสูตรที่ให้; ถ้า points ต่ำมากในระบบนี้ (max ~100) คะแนนจะเต็ม 10 ง่าย → default คงไว้ 0.1 ตามที่ระบุ
3. Recent rounds table แสดง 20 แถวล่าสุด (มีปุ่ม "ดูทั้งหมด" ไป `/rounds`)