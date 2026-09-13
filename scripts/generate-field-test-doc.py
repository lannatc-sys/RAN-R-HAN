import os
import sys

if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

FONT_THAI = 'TH Sarabun PSK'
FONT_LATIN = 'Calibri'

COLOR_NAVY = RGBColor(0x1E, 0x3A, 0x8A)      # Primary Header
COLOR_BLUE = RGBColor(0x25, 0x63, 0xEB)      # Sub Header
COLOR_BODY = RGBColor(0x33, 0x41, 0x55)      # Slate Body
COLOR_MUTED = RGBColor(0x64, 0x74, 0x8B)     # Muted
COLOR_ALERT = RGBColor(0xB9, 0x1C, 0x1C)     # Red
COLOR_SUCCESS = RGBColor(0x15, 0x80, 0x3D)   # Green

def set_font(run, font_name=FONT_THAI, size_pt=14, bold=False, italic=False, color=COLOR_BODY):
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.italic = italic
    run.font.color.rgb = color
    rPr = run._r.get_or_add_rPr()
    rFonts = parse_xml(f'<w:rFonts {nsdecls("w")} w:ascii="{font_name}" w:hAnsi="{font_name}" w:cs="{font_name}" w:eastAsia="{font_name}"/>')
    rPr.append(rFonts)

def set_cell_bg(cell, fill_hex):
    shading = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shading)

def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_heading_styled(doc, text, level=1):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(12)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text)
    if level == 1:
        set_font(run, size_pt=20, bold=True, color=COLOR_NAVY)
    elif level == 2:
        set_font(run, size_pt=16, bold=True, color=COLOR_BLUE)
    elif level == 3:
        set_font(run, size_pt=14, bold=True, color=RGBColor(0x0F, 0x17, 0x2A))
    return p

def create_document():
    doc = Document()

    # Set page margins to standard 1 inch
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.9)
        section.right_margin = Inches(0.9)

    # Title
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_after = Pt(2)
    r_title = p_title.add_run("📱 คู่มือและเช็กลิสต์ทดสอบภาคสนาม (Physical Field Test Runbook)")
    set_font(r_title, size_pt=22, bold=True, color=COLOR_NAVY)

    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_after = Pt(12)
    r_sub = p_sub.add_run("โครงการ RAN-R-HAN — สำหรับออกทดสอบฮาร์ดแวร์มือถือจริงรอบเดียว (Gate 6 Physical E2E)")
    set_font(r_sub, size_pt=14, italic=True, color=COLOR_MUTED)

    # Notice Box (Callout)
    callout_tbl = doc.add_table(rows=1, cols=1)
    callout_tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    callout_cell = callout_tbl.cell(0, 0)
    set_cell_bg(callout_cell, 'FEF3C7') # Light amber
    set_cell_margins(callout_cell, top=140, bottom=140, left=200, right=200)
    p_callout = callout_cell.paragraphs[0]
    p_callout.paragraph_format.space_after = Pt(0)
    r_callout_h = p_callout.add_run("⚠️ จุดประสงค์ของเอกสารนี้:\n")
    set_font(r_callout_h, size_pt=13, bold=True, color=COLOR_ALERT)
    r_callout_t = p_callout.add_run(
        "ส่วนของระบบหลังบ้าน โค้ดเบส ฐานข้อมูล และการจำลอง (Simulation) ได้รับการทดสอบผ่านหมดแล้ว (Gate 1-5, 7-8)\n"
        "เอกสารนี้รวบรวมเฉพาะ 'สิ่งที่ต้องออกไปทำบนเครื่องจริงในพื้นที่ อ.เมือง แม่ฮ่องสอน รอบเดียว' เพื่อปลดล็อก Gate 6 ให้ผ่านจริงสมบูรณ์ก่อนเปิด Closed Pilot\n\n"
        "⏸️ ขอบเขตที่ยังไม่อยู่ในการทดสอบรอบนี้ (ยังเป็นแผนงานในอนาคต):\n"
        "• Telegram Rider แยกบอท: ปัจจุบันใช้บอทหลักร่วมกัน ยังไม่มีบอทแยกเฉพาะไรเดอร์\n"
        "• ระบบ Preorder: ยังมี P0 ค้างตาม tasks/todo.md ต้องปิดไว้ก่อน ห้ามเปิดทดสอบรอบนี้\n"
        "• Customer Account & ระบบหลักฐานข้อพิพาท: ตั้งใจพักไว้ก่อนจนกว่าจะยืนยัน Core Flow สำเร็จ"
    )
    set_font(r_callout_t, size_pt=12, color=RGBColor(0x78, 0x35, 0x0F))

    # --- Section 1: Preparation ---
    add_heading_styled(doc, "1. สิ่งที่ต้องเตรียมก่อนออกจากบ้าน (Equipment Checklist)", level=1)
    
    items = [
        ("มือถือเครื่องที่ 1 (Android)", "ติดตั้งเบราว์เซอร์ Chrome, มีอินเทอร์เน็ต 4G/5G, มีกล้องหลังคมชัด, เปิด GPS ระบุตำแหน่งความแม่นยำสูง"),
        ("มือถือเครื่องที่ 2 (iPhone)", "ใช้งาน Safari (iOS 16.4 ขึ้นไป), มีอินเทอร์เน็ต 4G/5G, มีกล้องหลังคมชัด, เปิด Location Services"),
        ("อุปกรณ์เปิดครัว KDS (แท็บเล็ต/มือถือเครื่องที่ 3/หรือเปิดบนคอม)", "สำหรับกดรับออเดอร์ในครัว (KDS) PIN: 0000 หรือสลับเปิดหน้าเบราว์เซอร์บนมือถือ"),
        ("แอปพลิเคชันธนาคารพร้อมเงินโอนจริง (20-60 บาท)", "สำหรับทดสอบสแกน PromptPay QR Code จ่ายจริง และบันทึกรูปสลิปเพื่อทดสอบ SlipOK"),
        ("ยานพาหนะ (มอเตอร์ไซค์/รถยนต์)", "สำหรับเคลื่อนที่ใน อ.เมือง แม่ฮ่องสอน เพื่อทดสอบพิกัด GPS เคลื่อนที่ตามจริง")
    ]

    for title, desc in items:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.left_indent = Inches(0.2)
        r_box = p.add_run("☐  ")
        set_font(r_box, size_pt=14, bold=True, color=COLOR_NAVY)
        r_title = p.add_run(f"{title}: ")
        set_font(r_title, size_pt=13, bold=True, color=COLOR_BODY)
        r_desc = p.add_run(desc)
        set_font(r_desc, size_pt=13, color=COLOR_BODY)

    # --- Section 2: Quick Links & QR Codes ---
    add_heading_styled(doc, "2. ข้อมูลระบบและ QR Code สำหรับสแกนบนมือถือ", level=1)

    qr_dir = os.path.join(os.getcwd(), 'public', 'qr')
    qr_rider = os.path.join(qr_dir, 'qr-rider-pwa.png')
    qr_cust = os.path.join(qr_dir, 'qr-customer-menu.png')
    qr_kds = os.path.join(qr_dir, 'qr-kds-kitchen.png')

    qr_table = doc.add_table(rows=3, cols=3)
    qr_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    headers = [
        ("1. ไรเดอร์ (Rider PWA)", qr_rider, "https://ran-r-han.vercel.app/rider", "User: rider1.kruapa@gmail.com\nPass: <ดูจาก .env.local ตัวแปร PILOT_RIDER_PASSWORD>\n(เครื่องไรเดอร์)"),
        ("2. ลูกค้า (Customer Menu)", qr_cust, "https://ran-r-han.vercel.app/krua-pa-daeng", "ร้าน: ครัวป้าแดง อาหารตามสั่ง\nเลือกแท็บ: Delivery\n(เครื่องลูกค้า)"),
        ("3. ครัวร้านค้า (KDS)", qr_kds, "https://ran-r-han.vercel.app/admin/orders", "PIN เข้าใช้งาน: 0000\nจัดการสถานะปรุงอาหาร\n(จอครัว/แอดมิน)")
    ]

    for col_idx, (head, img_path, url, note) in enumerate(headers):
        # Row 0: Header
        c0 = qr_table.cell(0, col_idx)
        set_cell_bg(c0, 'F1F5F9')
        set_cell_margins(c0, top=100, bottom=100, left=120, right=120)
        p0 = c0.paragraphs[0]
        p0.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r0 = p0.add_run(head)
        set_font(r0, size_pt=13, bold=True, color=COLOR_NAVY)

        # Row 1: Image
        c1 = qr_table.cell(1, col_idx)
        set_cell_margins(c1, top=100, bottom=100, left=120, right=120)
        p1 = c1.paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        if os.path.exists(img_path):
            p1.add_run().add_picture(img_path, width=Inches(1.8))
        else:
            p1.add_run("[QR Code Image]")

        # Row 2: URL & Note
        c2 = qr_table.cell(2, col_idx)
        set_cell_margins(c2, top=100, bottom=100, left=120, right=120)
        p2 = c2.paragraphs[0]
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r_url = p2.add_run(f"{url}\n")
        set_font(r_url, size_pt=10, color=COLOR_BLUE)
        r_note = p2.add_run(note)
        set_font(r_note, size_pt=11, color=COLOR_MUTED)

    doc.add_paragraph().paragraph_format.space_after = Pt(8)

    # --- Section 3: The Single-Trip Action Steps ---
    add_heading_styled(doc, "3. แผนปฏิบัติการทดสอบภาคสนาม 8 ขั้นตอน (ออกทำรอบเดียว)", level=1)

    steps = [
        ("สเต็ป 1: ตั้งค่า PWA และสิทธิ์บนมือถือทั้งสองเครื่อง (ณ จุดเริ่มต้น)", [
            "บนเครื่อง Android: เปิด Chrome ไปที่ URL ไรเดอร์ -> กดเมนู 3 จุด -> 'Add to Home Screen' (เพิ่มไปยังหน้าจอหลัก)",
            "บนเครื่อง iPhone: เปิด Safari ไปที่ URL ไรเดอร์ -> กดปุ่ม Share (แชร์) -> 'Add to Home Screen'",
            "กดเข้าแอปจากหน้าจอหลัก (Standalone PWA mode) ดูว่าเปิดเต็มหน้าจอไม่มี URL Bar กวนสายตา",
            "ล็อกอินด้วย rider1.kruapa@gmail.com / <ดูจาก .env.local ตัวแปร PILOT_RIDER_PASSWORD>",
            "กดปุ่มอนุญาต Location Permission (เลือก 'While using the app')",
            "กดปุ่มอนุญาต Notifications (การแจ้งเตือน)",
            "กดปุ่มสีเขียว 'เปิดรับงาน (Start Work Session)' -> สถานะเปลี่ยนเป็น Online สีเขียว"
        ]),
        ("สเต็ป 2: ทดสอบ Background GPS ระหว่างขับขี่ (เดินทางไปร้านครัวป้าแดง)", [
            "ออกเดินทางมุ่งหน้าสู่ร้านครัวป้าแดง (พิกัดเทศบาลเมืองแม่ฮ่องสอน: 19.3005, 97.9678)",
            "ระหว่างขับขี่ เปิดหน้าแอปไรเดอร์ไว้: สังเกตว่าพิกัดปัจจุบันอัปเดตตามระยะทางจริง",
            "ลองล็อกหน้าจอ (Lock screen) หรือสลับไปแอปอื่นสัก 1-2 นาที แล้วปลดล็อกกลับมา: แอปต้องไม่หลุดและยังคงสถานะ Online"
        ]),
        ("สเต็ป 3: ลูกค้าสร้างออเดอร์ Delivery + ชำระเงินจริงด้วย SlipOK", [
            "ใช้มือถือเครื่องลูกค้า เปิด https://ran-r-han.vercel.app/krua-pa-daeng",
            "เลือกแท็บ 'Delivery (จัดส่ง)' -> ปักหมุดที่อยู่จัดส่งจริงในเมืองแม่ฮ่องสอน",
            "กรอกชื่อลูกค้า และเบอร์โทรศัพท์จริง -> เลือกอาหาร 1 อย่างใส่ตะกร้า -> กดยืนยันออเดอร์",
            "หน้าจอแสดง PromptPay QR Code พร้อมยอดเงินจริง",
            "ใช้แอปธนาคารสแกนโอนเงินจริงเข้าบัญชี ธนัชชา ศรีมณี (0615125679)",
            "บันทึกรูปสลิป -> กดปุ่ม 'แนบสลิป / อัปโหลดสลิป' ในหน้าเว็บ",
            "ตรวจผลลัพธ์: ระบบ SlipOK ต้องตรวจจับสลิปอัตโนมัติ และสถานะเปลี่ยนเป็น 'ชำระเงินสำเร็จ (Verified)' ภายใน 1-3 วินาที"
        ]),
        ("สเต็ป 4: ครัวรับออเดอร์ใน KDS และสั่ง Auto-Dispatch", [
            "เปิดหน้า KDS (/admin/orders) ด้วย PIN 0000",
            "ดูบัตรออเดอร์ที่เพิ่งจ่ายเงินเข้ามาในคอลัมน์ 'รอปรุง'",
            "กดปุ่ม 'กำลังปรุง (Cooking)' -> จับเวลาปรุง",
            "กดปุ่ม 'ปรุงเสร็จแล้ว / พร้อมส่ง (Ready for Delivery)' เพื่อสั่งให้อัลกอริทึม Dispatch ทำงาน"
        ]),
        ("สเต็ป 5: ตรวจสอบ Web Push และการสั่นเตือนบนมือถือไรเดอร์", [
            "สังเกตมือถือไรเดอร์: ต้องมีการสั่นเตือน (Vibration) หรือเสียงเตือนเข้ามา",
            "หน้าจอไรเดอร์เด้ง Card งานใหม่: 'มีงานใหม่เข้ามา!' พร้อมเวลานับถอยหลัง 30 วินาที",
            "แสดงระยะทางจากร้านไปบ้านลูกค้า และแสดงค่ารอบถูกต้อง",
            "ไรเดอร์กดปุ่ม 'รับงาน (Accept Offer)' ก่อนเวลานับถอยหลังหมดลง"
        ]),
        ("สเต็ป 6: นำส่งอาหารตามพิกัดแผนที่ (Delivery Route)", [
            "เมื่อรับอาหารจากร้านแล้ว กดปุ่ม 'รับอาหารแล้ว (Picked Up)'",
            "สถานะใน KDS และหน้าจอลูกค้าเปลี่ยนเป็น 'กำลังจัดส่ง (Delivering)'",
            "ขับขี่ไปยังจุดส่งลูกค้าตามหมุดแผนที่ Leaflet/Mapbox บนหน้าจอ"
        ]),
        ("สเต็ป 7: ถ่ายรูปส่งมอบจริงด้วยกล้องมือถือ (POD - Proof of Delivery)", [
            "เมื่อถึงจุดส่งลูกค้า กดปุ่ม 'ส่งมอบอาหาร (Complete Delivery)'",
            "กล้องจริงของมือถือต้องเปิดขึ้นมาโดยอัตโนมัติ (ไม่ใช่แค่เลือกไฟล์)",
            "ถ่ายภาพอาหารยื่นให้ลูกค้า หรือวางไว้ ณ จุดรับสินค้า",
            "กดยืนยันการส่งมอบ: รูปถ่ายต้องถูกอัปโหลดขึ้น Cloud Storage สำเร็จ",
            "สถานะออเดอร์เปลี่ยนเป็น 'จัดส่งสำเร็จ (Completed)' ทั้งฝั่งลูกค้าและร้านค้า"
        ]),
        ("สเต็ป 8: สรุปยอดเงิน Settlement และปิดกะตรวจสอบ PDPA", [
            "บนมือถือไรเดอร์ ดูที่แท็บสรุปรายได้: ต้องมียอดเงินค่ารอบบวกเพิ่มขึ้นจริง",
            "กดปุ่มสีแดง 'ปิดกะทำงาน (Close Work Session)'",
            "ตรวจสอบความปลอดภัย PDPA: เมื่อปิดกะแล้ว พิกัด GPS สดของไรเดอร์จะต้องถูกลบออกจากฐานข้อมูลทันที"
        ])
    ]

    for step_title, sub_steps in steps:
        add_heading_styled(doc, step_title, level=2)
        for s in sub_steps:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.left_indent = Inches(0.25)
            r_chk = p.add_run("☐  ")
            set_font(r_chk, size_pt=13, bold=True, color=COLOR_BLUE)
            r_txt = p.add_run(s)
            set_font(r_txt, size_pt=13, color=COLOR_BODY)

    # --- Section 4: Pass/Fail Evaluation Criteria ---
    add_heading_styled(doc, "4. เกณฑ์การประเมินผลผ่าน / ไม่ผ่าน (Gate 6 Criteria)", level=1)

    eval_table = doc.add_table(rows=7, cols=3)
    eval_table.alignment = WD_TABLE_ALIGNMENT.CENTER

    eval_data = [
        ("หัวข้อทดสอบฮาร์ดแวร์จริง", "เกณฑ์ที่ต้องผ่าน (Acceptance Criteria)", "ผลการตรวจ"),
        ("1. PWA Standby", "Android และ iPhone ติดตั้ง PWA บน Home screen ได้ เปิดเต็มจอ ไม่หลุด", "[ ] ผ่าน  [ ] ไม่ผ่าน"),
        ("2. Real SlipOK", "สลิปจริงตรวจผ่านภายใน 3 วินาที ยอดเงินตรง สถานะออเดอร์ confirmed", "[ ] ผ่าน  [ ] ไม่ผ่าน"),
        ("3. Offer & Push", "Offer เด้งบนมือถือไรเดอร์ มีเสียงเตือน/สั่น นับถอยหลัง 30 วิ กดรับได้", "[ ] ผ่าน  [ ] ไม่ผ่าน"),
        ("4. GPS Real Tracking", "พิกัดไรเดอร์อัปเดตตามการเคลื่อนที่จริงในเขตเทศบาลเมืองแม่ฮ่องสอน", "[ ] ผ่าน  [ ] ไม่ผ่าน"),
        ("5. Camera POD", "กล้องมือถือเปิดถ่ายรูปได้จริง ภาพอัปโหลดสำเร็จ ไม่ error", "[ ] ผ่าน  [ ] ไม่ผ่าน"),
        ("6. Settlement & PDPA", "ค่ารอบขึ้นตรง ปิดกะแล้วลบพิกัดสดทันทีตามกฎหมาย PDPA", "[ ] ผ่าน  [ ] ไม่ผ่าน")
    ]

    for r_idx, row_data in enumerate(eval_data):
        for c_idx, val in enumerate(row_data):
            cell = eval_table.cell(r_idx, c_idx)
            set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            if r_idx == 0:
                set_cell_bg(cell, '1E3A8A')
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
                r = p.add_run(val)
                set_font(r, size_pt=12, bold=True, color=RGBColor(0xFF, 0xFF, 0xFF))
            else:
                if r_idx % 2 == 1:
                    set_cell_bg(cell, 'F8FAFC')
                r = p.add_run(val)
                set_font(r, size_pt=12, color=COLOR_BODY)

    # Sign-off Box
    doc.add_paragraph().paragraph_format.space_after = Pt(14)
    sign_table = doc.add_table(rows=2, cols=2)
    sign_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    for r in range(2):
        for c in range(2):
            cell = sign_table.cell(r, c)
            set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
            p = cell.paragraphs[0]
            if r == 0 and c == 0:
                p.add_run("ผู้ทำการทดสอบภาคสนาม: ________________________\nวันที่ทดสอบ: _____ / _____ / _________")
            elif r == 0 and c == 1:
                p.add_run("ผู้รับรองผลการทดสอบ (Lead/Owner): ___________________\nผลสรุป: [ ] GO (เปิด Closed Pilot)   [ ] NO-GO (แก้ไขต่อ)")
            elif r == 1:
                p.add_run("บันทึกปัญหาที่พบระหว่างทาง (ถ้ามี):\n\n")

    # Save documents
    out_dir = os.path.join(os.getcwd(), 'docs')
    os.makedirs(out_dir, exist_ok=True)
    
    file_th = os.path.join(out_dir, 'คู่มือทดสอบภาคสนาม_Core_Flow_มือถือจริง.docx')
    file_en = os.path.join(out_dir, 'mobile-field-test-guide.docx')
    
    doc.save(file_th)
    doc.save(file_en)
    
    print(f"Successfully generated:")
    print(f"  1. {file_th}")
    print(f"  2. {file_en}")

if __name__ == '__main__':
    create_document()
