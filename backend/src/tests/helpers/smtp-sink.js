import net from 'node:net';

// A tiny SMTP server for tests: accepts every message and keeps it, so e-mail features can be checked
// without Mailpit. Start it BEFORE importing the app (the mailer reads SMTP_HOST/SMTP_PORT at import time).
export async function startSmtpSink() {
  const mails = [];
  const server = net.createServer((sock) => {
    let inData = false;
    let buf = '';
    sock.write('220 sink ESMTP\r\n');
    const pump = () => {
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) return;
          mails.push(buf.slice(0, end));
          buf = buf.slice(end + 5);
          inData = false;
          sock.write('250 queued\r\n');
          continue;
        }
        const i = buf.indexOf('\r\n');
        if (i < 0) return;
        const line = buf.slice(0, i).toUpperCase();
        buf = buf.slice(i + 2);
        if (line.startsWith('EHLO') || line.startsWith('HELO')) sock.write('250 sink\r\n');
        else if (line.startsWith('DATA')) { sock.write('354 go\r\n'); inData = true; }
        else if (line.startsWith('QUIT')) { sock.write('221 bye\r\n'); sock.end(); return; }
        else sock.write('250 OK\r\n');
      }
    };
    sock.on('data', (c) => { buf += c.toString('latin1'); pump(); });
    sock.on('error', () => {});
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(server.address().port);

  // quoted-printable -> readable text, so assertions can look for words and links
  const decode = (raw) => raw.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  const to = (addr) => mails.map(decode).filter((m) => m.toLowerCase().includes(`<${addr.toLowerCase()}>`) || m.toLowerCase().includes(`to: ${addr.toLowerCase()}`));
  const wait = async (addr, pred = () => true) => {
    for (let i = 0; i < 40; i++) {
      const hit = to(addr).filter(pred);
      if (hit.length) return hit.at(-1);
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  };
  return { mails, to, wait, decode, close: () => server.close() };
}
