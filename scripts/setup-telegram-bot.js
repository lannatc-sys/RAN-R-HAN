const token = '8740185324:AAE2mwww-8WzGUzx0wjCGOYrIUFcF2-RqfI';

async function setup() {
  // 1. setMyDescription
  const descRes = await fetch(`https://api.telegram.org/bot${token}/setMyDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: 'ระบบแจ้งเตือนสถานะออเดอร์และคิวอาหารอัตโนมัติ สำหรับร้านอาหารในระบบ RAN-R-HAN (รับอาหาร)\n\nเมื่อคุณสั่งอาหารผ่านหน้าร้าน สามารถกดปุ่มเชื่อมต่อเพื่อรับการแจ้งเตือนเมื่ออาหารเริ่มทำ และเมื่ออาหารพร้อมเสิร์ฟได้ทันที ฟรี 100%'
    })
  });
  console.log('Description set:', await descRes.json());

  // 2. setMyShortDescription
  const shortRes = await fetch(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      short_description: 'ระบบแจ้งเตือนสถานะคิวอาหารอัตโนมัติ RAN-R-HAN'
    })
  });
  console.log('Short description set:', await shortRes.json());

  // 3. setMyCommands
  const cmdRes = await fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      commands: [
        { command: 'start', description: 'เริ่มต้นใช้งานและดูวิธีรับแจ้งเตือน' }
      ]
    })
  });
  console.log('Commands set:', await cmdRes.json());
}

setup().catch(console.error);
