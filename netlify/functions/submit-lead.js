exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let data;
  try { data = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { name, email, phone, budget, goal } = data;
  if (!name || !email || !phone) {
    return { statusCode: 400, body: 'Missing required fields' };
  }

  const firstName = name.split(' ')[0];
  const lastName  = name.split(' ').slice(1).join(' ') || '';

  await Promise.allSettled([
    addToHubSpot({ firstName, lastName, email, phone, budget, goal }),
    addToBrevo({ firstName, email, phone, budget, goal }),
    sendTelegram({ name, email, phone, budget, goal }),
    sendFormspree({ name, email, phone, budget, goal })
  ]);

  return {
    statusCode: 200,
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ ok: true })
  };
};

async function addToHubSpot({ firstName, lastName, email, phone, budget, goal }) {
  const portalId = process.env.HUBSPOT_PORTAL_ID;
  const formId   = process.env.HUBSPOT_FORM_ID;
  if (!portalId || !formId) return;
  await fetch(`https://api.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: [
        { name: 'firstname', value: firstName },
        { name: 'lastname',  value: lastName },
        { name: 'email',     value: email },
        { name: 'phone',     value: phone },
        { name: 'message',   value: `Budget: ${budget} | Goal: ${goal}` }
      ],
      context: { pageUri: 'dxbpropertyexpert.com', pageName: 'Landing Page' }
    })
  });
}

async function addToBrevo({ firstName, email, phone, budget, goal }) {
  const url = process.env.BREVO_FORM_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({
      email,
      attributes: { FIRSTNAME: firstName, SMS: phone, BUDGET: budget, GOAL: goal },
      listIds: [3],
      updateEnabled: true
    })
  });
}

async function sendTelegram({ name, email, phone, budget, goal }) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const text = `🔔 NEW LEAD — dxbpropertyexpert.com\n\n👤 Name: ${name}\n📧 Email: ${email}\n📱 WhatsApp: ${phone}\n💰 Budget: ${budget}\n🎯 Goal: ${goal}`;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text })
  });
}

async function sendFormspree({ name, email, phone, budget, goal }) {
  const url = process.env.FORMSPREE_URL;
  if (!url) return;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ name, email, phone, budget, goal, _subject: `🔔 New Lead: ${name} — ${budget}` })
  });
}
