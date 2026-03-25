exports.handler = async function(event, context) {
  const NOTION_TOKEN = process.env.NOTION_TOKEN;
  const DATABASE_ID = '4759b22acb004e86b2c5d0d442fe8360';

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (!NOTION_TOKEN) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'NOTION_TOKEN not configured' }) };
  }

  try {
    let allResults = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const reqBody = { page_size: 100 };
      if (startCursor) reqBody.start_cursor = startCursor;

      const response = await fetch('https://api.notion.com/v1/databases/' + DATABASE_ID + '/query', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqBody)
      });

      if (!response.ok) {
        const errText = await response.text();
        return { statusCode: response.status, headers, body: JSON.stringify({ error: 'Notion API error: ' + errText }) };
      }

      const data = await response.json();
      allResults = allResults.concat(data.results || []);
      hasMore = data.has_more || false;
      startCursor = data.next_cursor;
    }

    const items = allResults.map(function(page) {
      const p = page.properties || {};
      const getTitle = function(prop) {
        if (!prop || !prop.title) return '';
        return prop.title.map(function(t) { return t.plain_text; }).join('');
      };
      const getRichText = function(prop) {
        if (!prop || !prop.rich_text) return '';
        return prop.rich_text.map(function(t) { return t.plain_text; }).join('');
      };
      const getSelect = function(prop) {
        if (!prop || !prop.select) return '';
        return prop.select.name || '';
      };
      const getDate = function(prop) {
        if (!prop || !prop.date) return '';
        return prop.date.start || '';
      };
      const getUniqueId = function(prop) {
        if (!prop) return 0;
        if (prop.unique_id) return prop.unique_id.number || 0;
        if (prop.number !== undefined) return prop.number || 0;
        return 0;
      };

      var idNum = getUniqueId(p['ID']);
      return {
        id: 'ERP-' + idNum,
        konu: getTitle(p['Konu']),
        kategori: getSelect(p['Kategori']),
        altKategori: getSelect(p['Alt Kategori']),
        durum: getSelect(p['Durum']),
        oncelik: getSelect(p['Öncelik']),
        sorumlu: getRichText(p['Sorumlu']),
        ilkGorulme: getDate(p['İlk Görülme']),
        cozumTarihi: getDate(p['Çözüm Tarihi']),
        terminSuresi: getDate(p['Termin Süresi'])
      };
    });

    items.sort(function(a, b) {
      var na = parseInt(a.id.replace('ERP-', '')) || 0;
      var nb = parseInt(b.id.replace('ERP-', '')) || 0;
      return na - nb;
    });

    return { statusCode: 200, headers, body: JSON.stringify(items) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
};
