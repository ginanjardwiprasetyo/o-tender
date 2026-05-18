const axios = require('axios');

async function checkSlug(slug) {
    const url = `https://spse.inaproc.id/${slug}/lelang`;
    console.log(`Checking ${url}...`);
    try {
        const res = await axios.get(url, { timeout: 10000 });
        console.log(`Result for ${slug}: ${res.status} (Length: ${res.data.length})`);
        return true;
    } catch (e) {
        console.log(`Result for ${slug}: Error ${e.response ? e.response.status : e.message}`);
        return false;
    }
}

async function run() {
    await checkSlug('jateng');
    await checkSlug('jatengprov');
    await checkSlug('jatengkab');
}

run();
